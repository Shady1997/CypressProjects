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
exports.InterceptRequest = void 0;
const lodash_1 = __importDefault(require("lodash"));
const network_1 = require("../../../../network");
const debug_1 = __importDefault(require("debug"));
const url_1 = __importDefault(require("url"));
const types_1 = require("../../types");
const route_matching_1 = require("../route-matching");
const util_1 = require("../util");
const intercepted_request_1 = require("../intercepted-request");
const debug = (0, debug_1.default)('cypress:net-stubbing:server:intercept-request');
/**
 * Called when a new request is received in the proxy layer.
 */
const InterceptRequest = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if ((0, route_matching_1.matchesRoutePreflight)(this.netStubbingState.routes, this.req)) {
            // send positive CORS preflight response
            return (0, util_1.sendStaticResponse)(this, {
                statusCode: 204,
                headers: {
                    'access-control-max-age': '-1',
                    'access-control-allow-credentials': 'true',
                    'access-control-allow-origin': this.req.headers.origin || '*',
                    'access-control-allow-methods': this.req.headers['access-control-request-method'] || '*',
                    'access-control-allow-headers': this.req.headers['access-control-request-headers'] || '*',
                },
            });
        }
        const matchingRoutes = [];
        const populateMatchingRoutes = (prevRoute) => {
            const route = (0, route_matching_1.getRouteForRequest)(this.netStubbingState.routes, this.req, prevRoute);
            if (!route) {
                return;
            }
            matchingRoutes.push(route);
            populateMatchingRoutes(route);
        };
        populateMatchingRoutes();
        if (!matchingRoutes.length) {
            // not intercepted, carry on normally...
            return this.next();
        }
        const request = new intercepted_request_1.InterceptedRequest({
            continueRequest: this.next,
            onError: this.onError,
            onResponse: (incomingRes, resStream) => {
                (0, util_1.setDefaultHeaders)(this.req, incomingRes);
                this.onResponse(incomingRes, resStream);
            },
            req: this.req,
            res: this.res,
            socket: this.socket,
            state: this.netStubbingState,
            matchingRoutes,
        });
        debug('intercepting request %o', { requestId: request.id, req: lodash_1.default.pick(this.req, 'url') });
        // attach requestId to the original req object for later use
        this.req.requestId = request.id;
        this.netStubbingState.requests[request.id] = request;
        const req = lodash_1.default.extend(lodash_1.default.pick(request.req, types_1.SERIALIZABLE_REQ_PROPS), {
            url: request.req.proxiedUrl,
        });
        request.res.once('finish', () => __awaiter(this, void 0, void 0, function* () {
            request.handleSubscriptions({
                eventName: 'after:response',
                data: request.includeBodyInAfterResponse ? {
                    finalResBody: request.res.body,
                } : {},
                mergeChanges: lodash_1.default.noop,
            });
            debug('request/response finished, cleaning up %o', { requestId: request.id });
            delete this.netStubbingState.requests[request.id];
        }));
        const ensureBody = () => {
            return new Promise((resolve) => {
                if (req.body) {
                    return resolve();
                }
                request.req.pipe((0, network_1.concatStream)((reqBody) => {
                    req.body = reqBody;
                    resolve();
                }));
            });
        };
        yield ensureBody();
        if (!lodash_1.default.isString(req.body) && !lodash_1.default.isBuffer(req.body)) {
            throw new Error('req.body must be a string or a Buffer');
        }
        const bodyEncoding = (0, util_1.getBodyEncoding)(req);
        const bodyIsBinary = bodyEncoding === 'binary';
        if (bodyIsBinary) {
            debug('req.body contained non-utf8 characters, treating as binary content %o', { requestId: request.id, req: lodash_1.default.pick(this.req, 'url') });
        }
        // leave the requests that send a binary buffer unchanged
        // but we can work with the "normal" string requests
        if (!bodyIsBinary) {
            req.body = req.body.toString('utf8');
        }
        request.req.body = req.body;
        const mergeChanges = (before, after) => {
            if (before.headers['content-length'] === after.headers['content-length']) {
                // user did not purposely override content-length, let's set it
                after.headers['content-length'] = String(Buffer.from(after.body).byteLength);
            }
            // resolve and propagate any changes to the URL
            request.req.proxiedUrl = after.url = url_1.default.resolve(request.req.proxiedUrl, after.url);
            (0, util_1.mergeWithPreservedBuffers)(before, lodash_1.default.pick(after, types_1.SERIALIZABLE_REQ_PROPS));
            (0, util_1.mergeDeletedHeaders)(before, after);
        };
        const modifiedReq = yield request.handleSubscriptions({
            eventName: 'before:request',
            data: req,
            mergeChanges,
        });
        mergeChanges(req, modifiedReq);
        // @ts-ignore
        mergeChanges(request.req, req);
        if (request.responseSent) {
            // request has been fulfilled with a response already, do not send the request outgoing
            // @see https://github.com/cypress-io/cypress/issues/15841
            return this.end();
        }
        return request.continueRequest();
    });
};
exports.InterceptRequest = InterceptRequest;
