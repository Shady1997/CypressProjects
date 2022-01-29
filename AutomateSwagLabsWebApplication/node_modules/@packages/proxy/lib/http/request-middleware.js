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
const lodash_1 = __importDefault(require("lodash"));
const network_1 = require("../../../network");
const net_stubbing_1 = require("../../../net-stubbing");
const debug_1 = __importDefault(require("debug"));
const debug = (0, debug_1.default)('cypress:proxy:http:request-middleware');
const LogRequest = function () {
    debug('proxying request %o', {
        req: lodash_1.default.pick(this.req, 'method', 'proxiedUrl', 'headers'),
    });
    this.next();
};
const CorrelateBrowserPreRequest = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.shouldCorrelatePreRequests()) {
            return this.next();
        }
        if (this.req.headers['x-cypress-resolving-url']) {
            this.debug('skipping prerequest for resolve:url');
            delete this.req.headers['x-cypress-resolving-url'];
            const requestId = `cy.visit-${Date.now()}`;
            this.req.browserPreRequest = {
                requestId,
                method: this.req.method,
                url: this.req.proxiedUrl,
                // @ts-ignore
                headers: this.req.headers,
                resourceType: 'document',
                originalResourceType: 'document',
            };
            this.res.on('close', () => {
                this.socket.toDriver('request:event', 'response:received', {
                    requestId,
                    headers: this.res.getHeaders(),
                    status: this.res.statusCode,
                });
            });
            return this.next();
        }
        this.debug('waiting for prerequest');
        this.getPreRequest(((browserPreRequest) => {
            this.req.browserPreRequest = browserPreRequest;
            this.next();
        }));
    });
};
const SendToDriver = function () {
    const { browserPreRequest } = this.req;
    if (browserPreRequest) {
        this.socket.toDriver('request:event', 'incoming:request', browserPreRequest);
    }
    this.next();
};
const MaybeEndRequestWithBufferedResponse = function () {
    const buffer = this.buffers.take(this.req.proxiedUrl);
    if (buffer) {
        this.debug('ending request with buffered response');
        this.res.wantsInjection = 'full';
        return this.onResponse(buffer.response, buffer.stream);
    }
    this.next();
};
const RedirectToClientRouteIfUnloaded = function () {
    // if we have an unload header it means our parent app has been navigated away
    // directly and we need to automatically redirect to the clientRoute
    if (this.req.cookies['__cypress.unload']) {
        this.res.redirect(this.config.clientRoute);
        return this.end();
    }
    this.next();
};
const EndRequestsToBlockedHosts = function () {
    const { blockHosts } = this.config;
    if (blockHosts) {
        const matches = network_1.blocked.matches(this.req.proxiedUrl, blockHosts);
        if (matches) {
            this.res.set('x-cypress-matched-blocked-host', matches);
            this.debug('blocking request %o', { matches });
            this.res.status(503).end();
            return this.end();
        }
    }
    this.next();
};
const StripUnsupportedAcceptEncoding = function () {
    // Cypress can only support plaintext or gzip, so make sure we don't request anything else
    const acceptEncoding = this.req.headers['accept-encoding'];
    if (acceptEncoding) {
        if (acceptEncoding.includes('gzip')) {
            this.req.headers['accept-encoding'] = 'gzip';
        }
        else {
            delete this.req.headers['accept-encoding'];
        }
    }
    this.next();
};
function reqNeedsBasicAuthHeaders(req, { auth, origin }) {
    //if we have auth headers, this request matches our origin, protection space, and the user has not supplied auth headers
    return auth && !req.headers['authorization'] && network_1.cors.urlMatchesOriginProtectionSpace(req.proxiedUrl, origin);
}
const MaybeSetBasicAuthHeaders = function () {
    const remoteState = this.getRemoteState();
    if (remoteState.auth && reqNeedsBasicAuthHeaders(this.req, remoteState)) {
        const { auth } = remoteState;
        const base64 = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        this.req.headers['authorization'] = `Basic ${base64}`;
    }
    this.next();
};
const SendRequestOutgoing = function () {
    const requestOptions = {
        timeout: this.req.responseTimeout,
        strictSSL: false,
        followRedirect: this.req.followRedirect || false,
        retryIntervals: [],
        url: this.req.proxiedUrl,
    };
    const requestBodyBuffered = !!this.req.body;
    const { strategy, origin, fileServer } = this.getRemoteState();
    if (strategy === 'file' && requestOptions.url.startsWith(origin)) {
        this.req.headers['x-cypress-authorization'] = this.getFileServerToken();
        requestOptions.url = requestOptions.url.replace(origin, fileServer);
    }
    if (requestBodyBuffered) {
        lodash_1.default.assign(requestOptions, lodash_1.default.pick(this.req, 'method', 'body', 'headers'));
    }
    const req = this.request.create(requestOptions);
    req.on('error', this.onError);
    req.on('response', (incomingRes) => this.onResponse(incomingRes, req));
    this.req.socket.on('close', () => {
        this.debug('request aborted');
        req.abort();
    });
    if (!requestBodyBuffered) {
        // pipe incoming request body, headers to new request
        this.req.pipe(req);
    }
    this.outgoingReq = req;
};
exports.default = {
    LogRequest,
    MaybeEndRequestWithBufferedResponse,
    CorrelateBrowserPreRequest,
    SendToDriver,
    InterceptRequest: net_stubbing_1.InterceptRequest,
    RedirectToClientRouteIfUnloaded,
    EndRequestsToBlockedHosts,
    StripUnsupportedAcceptEncoding,
    MaybeSetBasicAuthHeaders,
    SendRequestOutgoing,
};
