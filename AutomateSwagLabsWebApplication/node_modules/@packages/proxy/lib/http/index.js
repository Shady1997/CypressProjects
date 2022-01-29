"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Http = exports._runStage = exports.defaultMiddleware = exports.HttpStages = void 0;
const lodash_1 = __importDefault(require("lodash"));
const debug_1 = __importDefault(require("debug"));
const error_middleware_1 = __importDefault(require("./error-middleware"));
const buffers_1 = require("./util/buffers");
const prerequests_1 = require("./util/prerequests");
const bluebird_1 = __importDefault(require("bluebird"));
const request_middleware_1 = __importDefault(require("./request-middleware"));
const response_middleware_1 = __importDefault(require("./response-middleware"));
const rewriter_1 = require("../../../rewriter");
const debugRequests = (0, debug_1.default)('cypress-verbose:proxy:http');
var HttpStages;
(function (HttpStages) {
    HttpStages[HttpStages["IncomingRequest"] = 0] = "IncomingRequest";
    HttpStages[HttpStages["IncomingResponse"] = 1] = "IncomingResponse";
    HttpStages[HttpStages["Error"] = 2] = "Error";
})(HttpStages = exports.HttpStages || (exports.HttpStages = {}));
exports.defaultMiddleware = {
    [HttpStages.IncomingRequest]: request_middleware_1.default,
    [HttpStages.IncomingResponse]: response_middleware_1.default,
    [HttpStages.Error]: error_middleware_1.default,
};
const READONLY_MIDDLEWARE_KEYS = [
    'buffers',
    'config',
    'getFileServerToken',
    'getRemoteState',
    'netStubbingState',
    'next',
    'end',
    'onResponse',
    'onError',
    'skipMiddleware',
];
function _runStage(type, ctx, onError) {
    ctx.stage = HttpStages[type];
    const runMiddlewareStack = () => {
        const middlewares = ctx.middleware[type];
        // pop the first pair off the middleware
        const middlewareName = lodash_1.default.keys(middlewares)[0];
        if (!middlewareName) {
            return bluebird_1.default.resolve();
        }
        const middleware = middlewares[middlewareName];
        ctx.middleware[type] = lodash_1.default.omit(middlewares, middlewareName);
        return new bluebird_1.default((resolve) => {
            let ended = false;
            function copyChangedCtx() {
                lodash_1.default.chain(fullCtx)
                    .omit(READONLY_MIDDLEWARE_KEYS)
                    .forEach((value, key) => {
                    if (ctx[key] !== value) {
                        ctx[key] = value;
                    }
                })
                    .value();
            }
            function _end(retval) {
                if (ended) {
                    return;
                }
                ended = true;
                copyChangedCtx();
                resolve(retval);
            }
            if (!middleware) {
                return resolve();
            }
            const fullCtx = Object.assign({ next: () => {
                    copyChangedCtx();
                    _end(runMiddlewareStack());
                }, end: () => _end(), onResponse: (incomingRes, resStream) => {
                    ctx.incomingRes = incomingRes;
                    ctx.incomingResStream = resStream;
                    _end();
                }, onError: (error) => {
                    ctx.debug('Error in middleware %o', { middlewareName, error });
                    if (type === HttpStages.Error) {
                        return;
                    }
                    ctx.error = error;
                    onError(error);
                    _end(_runStage(HttpStages.Error, ctx, onError));
                }, skipMiddleware: (name) => {
                    ctx.middleware[type] = lodash_1.default.omit(ctx.middleware[type], name);
                } }, ctx);
            try {
                middleware.call(fullCtx);
            }
            catch (err) {
                fullCtx.onError(err);
            }
        });
    };
    return runMiddlewareStack();
}
exports._runStage = _runStage;
function getUniqueRequestId(requestId) {
    const match = /^(.*)-retry-([\d]+)$/.exec(requestId);
    if (match) {
        return `${match[1]}-retry-${Number(match[2]) + 1}`;
    }
    return `${requestId}-retry-1`;
}
class Http {
    constructor(opts) {
        this.preRequests = new prerequests_1.PreRequests();
        this.renderedHTMLOrigins = {};
        this.getRenderedHTMLOrigins = () => {
            return this.renderedHTMLOrigins;
        };
        this.buffers = new buffers_1.HttpBuffers();
        this.deferredSourceMapCache = new rewriter_1.DeferredSourceMapCache(opts.request);
        this.config = opts.config;
        this.shouldCorrelatePreRequests = opts.shouldCorrelatePreRequests || (() => false);
        this.getFileServerToken = opts.getFileServerToken;
        this.getRemoteState = opts.getRemoteState;
        this.middleware = opts.middleware;
        this.netStubbingState = opts.netStubbingState;
        this.socket = opts.socket;
        this.request = opts.request;
        if (typeof opts.middleware === 'undefined') {
            this.middleware = exports.defaultMiddleware;
        }
    }
    handle(req, res) {
        const ctx = {
            req,
            res,
            buffers: this.buffers,
            config: this.config,
            shouldCorrelatePreRequests: this.shouldCorrelatePreRequests,
            getFileServerToken: this.getFileServerToken,
            getRemoteState: this.getRemoteState,
            request: this.request,
            middleware: lodash_1.default.cloneDeep(this.middleware),
            netStubbingState: this.netStubbingState,
            socket: this.socket,
            debug: (formatter, ...args) => {
                debugRequests(`%s %s %s ${formatter}`, ctx.req.method, ctx.req.proxiedUrl, ctx.stage, ...args);
            },
            deferSourceMapRewrite: (opts) => {
                this.deferredSourceMapCache.defer(Object.assign({ resHeaders: ctx.incomingRes.headers }, opts));
            },
            getRenderedHTMLOrigins: this.getRenderedHTMLOrigins,
            getPreRequest: (cb) => {
                this.preRequests.get(ctx.req, ctx.debug, cb);
            },
        };
        const onError = () => {
            if (ctx.req.browserPreRequest) {
                // browsers will retry requests in the event of network errors, but they will not send pre-requests,
                // so try to re-use the current browserPreRequest for the next retry after incrementing the ID.
                const preRequest = Object.assign(Object.assign({}, ctx.req.browserPreRequest), { requestId: getUniqueRequestId(ctx.req.browserPreRequest.requestId) });
                ctx.debug('Re-using pre-request data %o', preRequest);
                this.addPendingBrowserPreRequest(preRequest);
            }
        };
        return _runStage(HttpStages.IncomingRequest, ctx, onError)
            .then(() => {
            if (ctx.incomingRes) {
                return _runStage(HttpStages.IncomingResponse, ctx, onError);
            }
            return ctx.debug('Warning: Request was not fulfilled with a response.');
        });
    }
    handleSourceMapRequest(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sm = yield this.deferredSourceMapCache.resolve(req.params.id, req.headers);
                if (!sm) {
                    throw new Error('no sourcemap found');
                }
                res.json(sm);
            }
            catch (err) {
                res.status(500).json({ err });
            }
        });
    }
    reset() {
        this.buffers.reset();
    }
    setBuffer(buffer) {
        return this.buffers.set(buffer);
    }
    addPendingBrowserPreRequest(browserPreRequest) {
        this.preRequests.addPending(browserPreRequest);
    }
}
exports.Http = Http;
