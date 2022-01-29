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
exports.getBodyEncoding = exports.mergeWithPreservedBuffers = exports.mergeDeletedHeaders = exports.getBodyStream = exports.sendStaticResponse = exports.setResponseFromFixture = exports.setDefaultHeaders = exports.getAllStringMatcherFields = exports.emit = void 0;
const lodash_1 = __importDefault(require("lodash"));
const debug_1 = __importDefault(require("debug"));
const is_html_1 = __importDefault(require("is-html"));
const http_1 = require("http");
const types_1 = require("../types");
const stream_1 = require("stream");
const net_1 = require("net");
const throttle_1 = __importDefault(require("throttle"));
const mime_types_1 = __importDefault(require("mime-types"));
const util_1 = require("../util");
// TODO: move this into net-stubbing once cy.route is removed
const xhrs_1 = require("../../../server/lib/controllers/xhrs");
const istextorbinary_1 = require("istextorbinary");
const debug = (0, debug_1.default)('cypress:net-stubbing:server:util');
function emit(socket, eventName, data) {
    if (debug.enabled) {
        debug('sending event to driver %o', { eventName, data: lodash_1.default.chain(data).cloneDeep().omit('res.body').value() });
    }
    socket.toDriver('net:stubbing:event', eventName, data);
}
exports.emit = emit;
function getAllStringMatcherFields(options) {
    return lodash_1.default.concat(lodash_1.default.filter(types_1.STRING_MATCHER_FIELDS, lodash_1.default.partial(lodash_1.default.has, options)), 
    // add the nested DictStringMatcher values to the list of fields
    lodash_1.default.flatten(lodash_1.default.filter(types_1.DICT_STRING_MATCHER_FIELDS.map((field) => {
        const value = options[field];
        if (value) {
            return lodash_1.default.keys(value).map((key) => {
                return `${field}.${key}`;
            });
        }
        return '';
    }))));
}
exports.getAllStringMatcherFields = getAllStringMatcherFields;
/**
 * Generate a "response object" that looks like a real Node HTTP response.
 * Instead of directly manipulating the response by using `res.status`, `res.setHeader`, etc.,
 * generating an IncomingMessage allows us to treat the response the same as any other "real"
 * HTTP response, which means the proxy layer can apply response middleware to it.
 */
function _getFakeClientResponse(opts) {
    const clientResponse = new http_1.IncomingMessage(new net_1.Socket);
    // be nice and infer this content-type for the user
    if (!(0, util_1.caseInsensitiveGet)(opts.headers || {}, 'content-type') && (0, is_html_1.default)(opts.body)) {
        opts.headers['content-type'] = 'text/html';
    }
    lodash_1.default.merge(clientResponse, opts);
    return clientResponse;
}
function setDefaultHeaders(req, res) {
    const setDefaultHeader = (lowercaseHeader, defaultValueFn) => {
        if (!(0, util_1.caseInsensitiveHas)(res.headers, lowercaseHeader)) {
            res.headers[lowercaseHeader] = defaultValueFn();
        }
    };
    // https://github.com/cypress-io/cypress/issues/15050
    // Check if res.headers has a custom header.
    // If so, set access-control-expose-headers to '*'.
    const hasCustomHeader = Object.keys(res.headers).some((header) => {
        // The list of header items that can be accessed from cors request
        // without access-control-expose-headers
        // @see https://stackoverflow.com/a/37931084/1038927
        return ![
            'cache-control',
            'content-language',
            'content-type',
            'expires',
            'last-modified',
            'pragma',
        ].includes(header.toLowerCase());
    });
    // We should not override the user's access-control-expose-headers setting.
    if (hasCustomHeader && !res.headers['access-control-expose-headers']) {
        setDefaultHeader('access-control-expose-headers', lodash_1.default.constant('*'));
    }
    setDefaultHeader('access-control-allow-origin', () => (0, util_1.caseInsensitiveGet)(req.headers, 'origin') || '*');
    setDefaultHeader('access-control-allow-credentials', lodash_1.default.constant('true'));
}
exports.setDefaultHeaders = setDefaultHeaders;
function setResponseFromFixture(getFixtureFn, staticResponse) {
    return __awaiter(this, void 0, void 0, function* () {
        const { fixture } = staticResponse;
        if (!fixture) {
            return;
        }
        const data = yield getFixtureFn(fixture.filePath, { encoding: fixture.encoding });
        const { headers } = staticResponse;
        if (!headers || !(0, util_1.caseInsensitiveGet)(headers, 'content-type')) {
            // attempt to detect mimeType based on extension, fall back to regular cy.fixture inspection otherwise
            const mimeType = mime_types_1.default.lookup(fixture.filePath) || (0, xhrs_1.parseContentType)(data);
            lodash_1.default.set(staticResponse, 'headers.content-type', mimeType);
        }
        function getBody() {
            // NOTE: for backwards compatibility with cy.route
            if (data === null) {
                return JSON.stringify('');
            }
            if (!lodash_1.default.isBuffer(data) && !lodash_1.default.isString(data)) {
                // TODO: probably we can use another function in fixtures.js that doesn't require us to remassage the fixture
                return JSON.stringify(data);
            }
            return data;
        }
        staticResponse.body = getBody();
    });
}
exports.setResponseFromFixture = setResponseFromFixture;
/**
 * Using an existing response object, send a response shaped by a StaticResponse object.
 * @param backendRequest BackendRequest object.
 * @param staticResponse BackendStaticResponse object.
 */
function sendStaticResponse(backendRequest, staticResponse) {
    return __awaiter(this, void 0, void 0, function* () {
        const { onError, onResponse } = backendRequest;
        if (staticResponse.forceNetworkError) {
            debug('forcing network error');
            const err = new Error('forceNetworkError called');
            return onError(err);
        }
        const statusCode = staticResponse.statusCode || 200;
        const headers = staticResponse.headers || {};
        const body = backendRequest.res.body = lodash_1.default.isUndefined(staticResponse.body) ? '' : staticResponse.body;
        const incomingRes = _getFakeClientResponse({
            statusCode,
            headers,
            body,
        });
        const bodyStream = yield getBodyStream(body, lodash_1.default.pick(staticResponse, 'throttleKbps', 'delay'));
        onResponse(incomingRes, bodyStream);
    });
}
exports.sendStaticResponse = sendStaticResponse;
function getBodyStream(body, options) {
    return __awaiter(this, void 0, void 0, function* () {
        const { delay, throttleKbps } = options;
        const pt = new stream_1.PassThrough();
        const sendBody = () => {
            let writable = pt;
            if (throttleKbps) {
                // ThrottleStream must be instantiated after any other delays because it uses a `Date.now()`
                // called at construction-time to decide if it's behind on throttling bytes
                writable = new throttle_1.default({ bps: throttleKbps * 1024 });
                writable.pipe(pt);
            }
            if (!lodash_1.default.isUndefined(body)) {
                if (body.pipe) {
                    return body.pipe(writable);
                }
                writable.write(body);
            }
            return writable.end();
        };
        delay ? yield wait(sendBody, delay) : sendBody();
        return pt;
    });
}
exports.getBodyStream = getBodyStream;
function wait(fn, ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(fn());
        }, ms);
    });
}
function mergeDeletedHeaders(before, after) {
    for (const k in before.headers) {
        // a header was deleted from `after` but was present in `before`, delete it in `before` too
        !after.headers[k] && delete before.headers[k];
    }
}
exports.mergeDeletedHeaders = mergeDeletedHeaders;
function mergeWithPreservedBuffers(before, after) {
    // lodash merge converts Buffer into Array (by design)
    // https://github.com/lodash/lodash/issues/2964
    // @see https://github.com/cypress-io/cypress/issues/15898
    lodash_1.default.mergeWith(before, after, (_a, b) => {
        if (b instanceof Buffer) {
            return b;
        }
        return undefined;
    });
}
exports.mergeWithPreservedBuffers = mergeWithPreservedBuffers;
function getBodyEncoding(req) {
    if (!req || !req.body) {
        return null;
    }
    // a simple heuristic for detecting UTF8 encoded requests
    if (req.headers && req.headers['content-type']) {
        const contentTypeHeader = req.headers['content-type'];
        const contentType = contentTypeHeader.toLowerCase();
        if (contentType.includes('charset=utf-8') || contentType.includes('charset="utf-8"')) {
            return 'utf8';
        }
    }
    // with fallback to inspecting the buffer using
    // https://github.com/bevry/istextorbinary
    return (0, istextorbinary_1.getEncoding)(req.body);
}
exports.getBodyEncoding = getBodyEncoding;
