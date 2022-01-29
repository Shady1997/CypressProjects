"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const charset_1 = __importDefault(require("charset"));
const network_1 = require("../../../network");
const debug_1 = __importDefault(require("debug"));
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const net_stubbing_1 = require("../../../net-stubbing");
const stream_1 = require("stream");
const rewriter = __importStar(require("./util/rewriter"));
const zlib_1 = __importDefault(require("zlib"));
const debug = (0, debug_1.default)('cypress:proxy:http:response-middleware');
// https://github.com/cypress-io/cypress/issues/1756
const zlibOptions = {
    flush: zlib_1.default.Z_SYNC_FLUSH,
    finishFlush: zlib_1.default.Z_SYNC_FLUSH,
};
// https://github.com/cypress-io/cypress/issues/1543
function getNodeCharsetFromResponse(headers, body) {
    const httpCharset = ((0, charset_1.default)(headers, body, 1024) || '').toLowerCase();
    debug('inferred charset from response %o', { httpCharset });
    if (iconv_lite_1.default.encodingExists(httpCharset)) {
        return httpCharset;
    }
    // browsers default to latin1
    return 'latin1';
}
function reqMatchesOriginPolicy(req, remoteState) {
    if (remoteState.strategy === 'http') {
        return network_1.cors.urlMatchesOriginPolicyProps(req.proxiedUrl, remoteState.props);
    }
    if (remoteState.strategy === 'file') {
        return req.proxiedUrl.startsWith(remoteState.origin);
    }
    return false;
}
function reqWillRenderHtml(req) {
    // will this request be rendered in the browser, necessitating injection?
    // https://github.com/cypress-io/cypress/issues/288
    // don't inject if this is an XHR from jquery
    if (req.headers['x-requested-with']) {
        return;
    }
    // don't inject if we didn't find both text/html and application/xhtml+xml,
    const accept = req.headers['accept'];
    return accept && accept.includes('text/html') && accept.includes('application/xhtml+xml');
}
function resContentTypeIs(res, contentType) {
    return (res.headers['content-type'] || '').includes(contentType);
}
function resContentTypeIsJavaScript(res) {
    return lodash_1.default.some(['application/javascript', 'application/x-javascript', 'text/javascript']
        .map(lodash_1.default.partial(resContentTypeIs, res)));
}
function isHtml(res) {
    return !resContentTypeIsJavaScript(res);
}
function resIsGzipped(res) {
    return (res.headers['content-encoding'] || '').includes('gzip');
}
function setCookie(res, k, v, domain) {
    let opts = { domain };
    if (!v) {
        v = '';
        opts.expires = new Date(0);
    }
    return res.cookie(k, v, opts);
}
function setInitialCookie(res, remoteState, value) {
    // dont modify any cookies if we're trying to clear the initial cookie and we're not injecting anything
    // dont set the cookies if we're not on the initial request
    if ((!value && !res.wantsInjection) || !res.isInitial) {
        return;
    }
    return setCookie(res, '__cypress.initial', value, remoteState.domainName);
}
// "autoplay *; document-domain 'none'" => { autoplay: "*", "document-domain": "'none'" }
const parseFeaturePolicy = (policy) => {
    const pairs = policy.split('; ').map((directive) => directive.split(' '));
    return lodash_1.default.fromPairs(pairs);
};
// { autoplay: "*", "document-domain": "'none'" } => "autoplay *; document-domain 'none'"
const stringifyFeaturePolicy = (policy) => {
    const pairs = lodash_1.default.toPairs(policy);
    return pairs.map((directive) => directive.join(' ')).join('; ');
};
const LogResponse = function () {
    debug('received response %o', {
        req: lodash_1.default.pick(this.req, 'method', 'proxiedUrl', 'headers'),
        incomingRes: lodash_1.default.pick(this.incomingRes, 'headers', 'statusCode'),
    });
    this.next();
};
const AttachPlainTextStreamFn = function () {
    this.makeResStreamPlainText = function () {
        debug('ensuring resStream is plaintext');
        if (!this.isGunzipped && resIsGzipped(this.incomingRes)) {
            debug('gunzipping response body');
            const gunzip = zlib_1.default.createGunzip(zlibOptions);
            this.incomingResStream = this.incomingResStream.pipe(gunzip).on('error', this.onError);
            this.isGunzipped = true;
        }
    };
    this.next();
};
const PatchExpressSetHeader = function () {
    const { incomingRes } = this;
    const originalSetHeader = this.res.setHeader;
    // Node uses their own Symbol object, so use this to get the internal kOutHeaders
    // symbol - Symbol.for('kOutHeaders') will not work
    const getKOutHeadersSymbol = () => {
        const findKOutHeadersSymbol = () => {
            return lodash_1.default.find(Object.getOwnPropertySymbols(this.res), (sym) => {
                return sym.toString() === 'Symbol(kOutHeaders)';
            });
        };
        let sym = findKOutHeadersSymbol();
        if (sym) {
            return sym;
        }
        // force creation of a new header field so the kOutHeaders key is available
        this.res.setHeader('X-Cypress-HTTP-Response', 'X');
        this.res.removeHeader('X-Cypress-HTTP-Response');
        sym = findKOutHeadersSymbol();
        if (!sym) {
            throw new Error('unable to find kOutHeaders symbol');
        }
        return sym;
    };
    let kOutHeaders;
    this.res.setHeader = function (name, value) {
        // express.Response.setHeader does all kinds of silly/nasty stuff to the content-type...
        // but we don't want to change it at all!
        if (name === 'content-type') {
            value = incomingRes.headers['content-type'] || value;
        }
        // run the original function - if an "invalid header char" error is raised,
        // set the header manually. this way we can retain Node's original error behavior
        try {
            return originalSetHeader.call(this, name, value);
        }
        catch (err) {
            if (err.code !== 'ERR_INVALID_CHAR') {
                throw err;
            }
            debug('setHeader error ignored %o', { name, value, code: err.code, err });
            if (!kOutHeaders) {
                kOutHeaders = getKOutHeadersSymbol();
            }
            // https://github.com/nodejs/node/blob/42cce5a9d0fd905bf4ad7a2528c36572dfb8b5ad/lib/_http_outgoing.js#L483-L495
            let headers = this[kOutHeaders];
            if (!headers) {
                this[kOutHeaders] = headers = Object.create(null);
            }
            headers[name.toLowerCase()] = [name, value];
        }
    };
    this.next();
};
const SetInjectionLevel = function () {
    this.res.isInitial = this.req.cookies['__cypress.initial'] === 'true';
    const isRenderedHTML = reqWillRenderHtml(this.req);
    if (isRenderedHTML) {
        const origin = new URL(this.req.proxiedUrl).origin;
        this.getRenderedHTMLOrigins()[origin] = true;
    }
    const isReqMatchOriginPolicy = reqMatchesOriginPolicy(this.req, this.getRemoteState());
    const getInjectionLevel = () => {
        if (this.incomingRes.headers['x-cypress-file-server-error'] && !this.res.isInitial) {
            return 'partial';
        }
        if (!resContentTypeIs(this.incomingRes, 'text/html') || !isReqMatchOriginPolicy) {
            return false;
        }
        if (this.res.isInitial) {
            return 'full';
        }
        if (!isRenderedHTML) {
            return false;
        }
        return 'partial';
    };
    if (!this.res.wantsInjection) {
        this.res.wantsInjection = getInjectionLevel();
    }
    this.res.wantsSecurityRemoved = this.config.modifyObstructiveCode && isReqMatchOriginPolicy && ((this.res.wantsInjection === 'full')
        || resContentTypeIsJavaScript(this.incomingRes));
    debug('injection levels: %o', lodash_1.default.pick(this.res, 'isInitial', 'wantsInjection', 'wantsSecurityRemoved'));
    this.next();
};
// https://github.com/cypress-io/cypress/issues/6480
const MaybeStripDocumentDomainFeaturePolicy = function () {
    const { 'feature-policy': featurePolicy } = this.incomingRes.headers;
    if (featurePolicy) {
        const directives = parseFeaturePolicy(featurePolicy);
        if (directives['document-domain']) {
            delete directives['document-domain'];
            const policy = stringifyFeaturePolicy(directives);
            if (policy) {
                this.res.set('feature-policy', policy);
            }
            else {
                this.res.removeHeader('feature-policy');
            }
        }
    }
    this.next();
};
const OmitProblematicHeaders = function () {
    const headers = lodash_1.default.omit(this.incomingRes.headers, [
        'set-cookie',
        'x-frame-options',
        'content-length',
        'transfer-encoding',
        'content-security-policy',
        'content-security-policy-report-only',
        'connection',
    ]);
    this.res.set(headers);
    this.next();
};
const MaybePreventCaching = function () {
    // do not cache injected responses
    // TODO: consider implementing etag system so even injected content can be cached
    if (this.res.wantsInjection) {
        this.res.setHeader('cache-control', 'no-cache, no-store, must-revalidate');
    }
    this.next();
};
const CopyCookiesFromIncomingRes = function () {
    const cookies = this.incomingRes.headers['set-cookie'];
    if (cookies) {
        [].concat(cookies).forEach((cookie) => {
            try {
                this.res.append('Set-Cookie', cookie);
            }
            catch (err) {
                debug('failed to Set-Cookie, continuing %o', { err, cookie });
            }
        });
    }
    this.next();
};
const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];
// TODO: this shouldn't really even be necessary?
const MaybeSendRedirectToClient = function () {
    const { statusCode, headers } = this.incomingRes;
    const newUrl = headers['location'];
    if (!REDIRECT_STATUS_CODES.includes(statusCode) || !newUrl) {
        return this.next();
    }
    setInitialCookie(this.res, this.getRemoteState(), true);
    debug('redirecting to new url %o', { statusCode, newUrl });
    this.res.redirect(Number(statusCode), newUrl);
    return this.end();
};
const CopyResponseStatusCode = function () {
    this.res.status(Number(this.incomingRes.statusCode));
    this.next();
};
const ClearCyInitialCookie = function () {
    setInitialCookie(this.res, this.getRemoteState(), false);
    this.next();
};
const MaybeEndWithEmptyBody = function () {
    if (network_1.httpUtils.responseMustHaveEmptyBody(this.req, this.incomingRes)) {
        this.res.end();
        return this.end();
    }
    this.next();
};
const MaybeInjectHtml = function () {
    if (!this.res.wantsInjection) {
        return this.next();
    }
    this.skipMiddleware('MaybeRemoveSecurity'); // we only want to do one or the other
    debug('injecting into HTML');
    this.makeResStreamPlainText();
    this.incomingResStream.pipe((0, network_1.concatStream)((body) => __awaiter(this, void 0, void 0, function* () {
        const nodeCharset = getNodeCharsetFromResponse(this.incomingRes.headers, body);
        const decodedBody = iconv_lite_1.default.decode(body, nodeCharset);
        const injectedBody = yield rewriter.html(decodedBody, {
            domainName: this.getRemoteState().domainName,
            wantsInjection: this.res.wantsInjection,
            wantsSecurityRemoved: this.res.wantsSecurityRemoved,
            isHtml: isHtml(this.incomingRes),
            useAstSourceRewriting: this.config.experimentalSourceRewriting,
            url: this.req.proxiedUrl,
            deferSourceMapRewrite: this.deferSourceMapRewrite,
        });
        const encodedBody = iconv_lite_1.default.encode(injectedBody, nodeCharset);
        const pt = new stream_1.PassThrough;
        pt.write(encodedBody);
        pt.end();
        this.incomingResStream = pt;
        this.next();
    }))).on('error', this.onError);
};
const MaybeRemoveSecurity = function () {
    if (!this.res.wantsSecurityRemoved) {
        return this.next();
    }
    debug('removing JS framebusting code');
    this.makeResStreamPlainText();
    this.incomingResStream.setEncoding('utf8');
    this.incomingResStream = this.incomingResStream.pipe(rewriter.security({
        isHtml: isHtml(this.incomingRes),
        useAstSourceRewriting: this.config.experimentalSourceRewriting,
        url: this.req.proxiedUrl,
        deferSourceMapRewrite: this.deferSourceMapRewrite,
    })).on('error', this.onError);
    this.next();
};
const GzipBody = function () {
    if (this.isGunzipped) {
        debug('regzipping response body');
        this.incomingResStream = this.incomingResStream.pipe(zlib_1.default.createGzip(zlibOptions)).on('error', this.onError);
    }
    this.next();
};
const SendResponseBodyToClient = function () {
    this.incomingResStream.pipe(this.res).on('error', this.onError);
    this.res.on('end', () => this.end());
};
exports.default = {
    LogResponse,
    AttachPlainTextStreamFn,
    InterceptResponse: net_stubbing_1.InterceptResponse,
    PatchExpressSetHeader,
    SetInjectionLevel,
    OmitProblematicHeaders,
    MaybePreventCaching,
    MaybeStripDocumentDomainFeaturePolicy,
    CopyCookiesFromIncomingRes,
    MaybeSendRedirectToClient,
    CopyResponseStatusCode,
    ClearCyInitialCookie,
    MaybeEndWithEmptyBody,
    MaybeInjectHtml,
    MaybeRemoveSecurity,
    GzipBody,
    SendResponseBodyToClient,
};
