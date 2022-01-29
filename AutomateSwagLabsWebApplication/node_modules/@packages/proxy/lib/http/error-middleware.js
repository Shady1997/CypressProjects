"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DestroyResponse = exports.UnpipeResponse = exports.AbortRequest = void 0;
const debug_1 = __importDefault(require("debug"));
const net_stubbing_1 = require("../../../net-stubbing");
const errors_1 = __importDefault(require("../../../server/lib/errors"));
const debug = (0, debug_1.default)('cypress:proxy:http:error-middleware');
const LogError = function () {
    debug('error proxying request %o', {
        error: this.error,
        url: this.req.url,
        headers: this.req.headers,
    });
    this.next();
};
const SendToDriver = function () {
    if (this.req.browserPreRequest) {
        this.socket.toDriver('request:event', 'request:error', {
            requestId: this.req.browserPreRequest.requestId,
            error: errors_1.default.clone(this.error),
        });
    }
    this.next();
};
const AbortRequest = function () {
    if (this.outgoingReq) {
        debug('aborting outgoingReq');
        this.outgoingReq.abort();
    }
    this.next();
};
exports.AbortRequest = AbortRequest;
const UnpipeResponse = function () {
    if (this.incomingResStream) {
        debug('unpiping resStream from response');
        this.incomingResStream.unpipe();
    }
    this.next();
};
exports.UnpipeResponse = UnpipeResponse;
const DestroyResponse = function () {
    this.res.destroy();
    this.end();
};
exports.DestroyResponse = DestroyResponse;
exports.default = {
    LogError,
    SendToDriver,
    InterceptError: net_stubbing_1.InterceptError,
    AbortRequest: exports.AbortRequest,
    UnpipeResponse: exports.UnpipeResponse,
    DestroyResponse: exports.DestroyResponse,
};
