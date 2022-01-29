"use strict";
/// <reference types='chrome'/>
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdpAutomation = exports.isHostOnlyCookie = exports._cookieMatches = exports._domainIsWithinSuperdomain = exports.screencastOpts = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const network_1 = require("../../../network");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const debugVerbose = (0, debug_1.default)('cypress-verbose:server:browsers:cdp_automation');
function screencastOpts(everyNthFrame = Number(process.env.CYPRESS_EVERY_NTH_FRAME || 5)) {
    return {
        format: 'jpeg',
        everyNthFrame,
    };
}
exports.screencastOpts = screencastOpts;
function convertSameSiteExtensionToCdp(str) {
    return str ? ({
        'no_restriction': 'None',
        'lax': 'Lax',
        'strict': 'Strict',
    })[str] : str;
}
function convertSameSiteCdpToExtension(str) {
    if (lodash_1.default.isUndefined(str)) {
        return str;
    }
    if (str === 'None') {
        return 'no_restriction';
    }
    return str.toLowerCase();
}
const _domainIsWithinSuperdomain = (domain, suffix) => {
    const suffixParts = suffix.split('.').filter(lodash_1.default.identity);
    const domainParts = domain.split('.').filter(lodash_1.default.identity);
    return lodash_1.default.isEqual(suffixParts, domainParts.slice(domainParts.length - suffixParts.length));
};
exports._domainIsWithinSuperdomain = _domainIsWithinSuperdomain;
const _cookieMatches = (cookie, filter) => {
    if (filter.domain && !(cookie.domain && (0, exports._domainIsWithinSuperdomain)(cookie.domain, filter.domain))) {
        return false;
    }
    if (filter.path && filter.path !== cookie.path) {
        return false;
    }
    if (filter.name && filter.name !== cookie.name) {
        return false;
    }
    return true;
};
exports._cookieMatches = _cookieMatches;
// without this logic, a cookie being set on 'foo.com' will only be set for 'foo.com', not other subdomains
function isHostOnlyCookie(cookie) {
    if (cookie.domain[0] === '.')
        return false;
    const parsedDomain = network_1.cors.parseDomain(cookie.domain);
    // make every cookie non-hostOnly
    // unless it's a top-level domain (localhost, ...) or IP address
    return parsedDomain && parsedDomain.tld !== cookie.domain;
}
exports.isHostOnlyCookie = isHostOnlyCookie;
const normalizeGetCookieProps = (cookie) => {
    if (cookie.expires === -1) {
        // @ts-ignore
        delete cookie.expires;
    }
    if (isHostOnlyCookie(cookie)) {
        // @ts-ignore
        cookie.hostOnly = true;
    }
    // @ts-ignore
    cookie.sameSite = convertSameSiteCdpToExtension(cookie.sameSite);
    // @ts-ignore
    cookie.expirationDate = cookie.expires;
    // @ts-ignore
    delete cookie.expires;
    // @ts-ignore
    return cookie;
};
const normalizeGetCookies = (cookies) => {
    return lodash_1.default.map(cookies, normalizeGetCookieProps);
};
const normalizeSetCookieProps = (cookie) => {
    // this logic forms a SetCookie request that will be received by Chrome
    // see MakeCookieFromProtocolValues for information on how this cookie data will be parsed
    // @see https://cs.chromium.org/chromium/src/content/browser/devtools/protocol/network_handler.cc?l=246&rcl=786a9194459684dc7a6fded9cabfc0c9b9b37174
    const setCookieRequest = (0, lodash_1.default)({
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: convertSameSiteExtensionToCdp(cookie.sameSite),
        expires: cookie.expirationDate,
    })
        // Network.setCookie will error on any undefined/null parameters
        .omitBy(lodash_1.default.isNull)
        .omitBy(lodash_1.default.isUndefined)
        // set name and value at the end to get the correct typing
        .extend({
        name: cookie.name || '',
        value: cookie.value || '',
    })
        .value();
    // without this logic, a cookie being set on 'foo.com' will only be set for 'foo.com', not other subdomains
    if (!cookie.hostOnly && isHostOnlyCookie(cookie)) {
        setCookieRequest.domain = `.${cookie.domain}`;
    }
    if (cookie.hostOnly && !isHostOnlyCookie(cookie)) {
        // @ts-ignore
        delete cookie.hostOnly;
    }
    if (setCookieRequest.name.startsWith('__Host-')) {
        setCookieRequest.url = `https://${cookie.domain}`;
        delete setCookieRequest.domain;
    }
    return setCookieRequest;
};
const normalizeResourceType = (resourceType) => {
    resourceType = resourceType ? resourceType.toLowerCase() : 'unknown';
    if (validResourceTypes.includes(resourceType)) {
        return resourceType;
    }
    if (resourceType === 'img') {
        return 'image';
    }
    return ffToStandardResourceTypeMap[resourceType] || 'other';
};
// the intersection of what's valid in CDP and what's valid in FFCDP
// Firefox: https://searchfox.org/mozilla-central/rev/98a9257ca2847fad9a19631ac76199474516b31e/remote/cdp/domains/parent/Network.jsm#22
// CDP: https://chromedevtools.github.io/devtools-protocol/tot/Network/#type-ResourceType
const validResourceTypes = ['fetch', 'xhr', 'websocket', 'stylesheet', 'script', 'image', 'font', 'cspviolationreport', 'ping', 'manifest', 'other'];
const ffToStandardResourceTypeMap = {
    'img': 'image',
    'csp': 'cspviolationreport',
    'webmanifest': 'manifest',
};
class CdpAutomation {
    constructor(sendDebuggerCommandFn, onFn, automation) {
        this.sendDebuggerCommandFn = sendDebuggerCommandFn;
        this.automation = automation;
        this.onNetworkRequestWillBeSent = (params) => {
            var _a, _b;
            debugVerbose('received networkRequestWillBeSent %o', params);
            let url = params.request.url;
            // in Firefox, the hash is incorrectly included in the URL: https://bugzilla.mozilla.org/show_bug.cgi?id=1715366
            if (url.includes('#'))
                url = url.slice(0, url.indexOf('#'));
            // Firefox: https://searchfox.org/mozilla-central/rev/98a9257ca2847fad9a19631ac76199474516b31e/remote/cdp/domains/parent/Network.jsm#397
            // Firefox lacks support for urlFragment and initiator, two nice-to-haves
            const browserPreRequest = {
                requestId: params.requestId,
                method: params.request.method,
                url,
                headers: params.request.headers,
                resourceType: normalizeResourceType(params.type),
                originalResourceType: params.type,
            };
            (_b = (_a = this.automation).onBrowserPreRequest) === null || _b === void 0 ? void 0 : _b.call(_a, browserPreRequest);
        };
        this.onResponseReceived = (params) => {
            var _a, _b;
            const browserResponseReceived = {
                requestId: params.requestId,
                status: params.response.status,
                headers: params.response.headers,
            };
            (_b = (_a = this.automation).onRequestEvent) === null || _b === void 0 ? void 0 : _b.call(_a, 'response:received', browserResponseReceived);
        };
        this.getAllCookies = (filter) => {
            return this.sendDebuggerCommandFn('Network.getAllCookies')
                .then((result) => {
                return normalizeGetCookies(result.cookies)
                    .filter((cookie) => {
                    const matches = (0, exports._cookieMatches)(cookie, filter);
                    debugVerbose('cookie matches filter? %o', { matches, cookie, filter });
                    return matches;
                });
            });
        };
        this.getCookiesByUrl = (url) => {
            return this.sendDebuggerCommandFn('Network.getCookies', {
                urls: [url],
            })
                .then((result) => {
                return normalizeGetCookies(result.cookies)
                    .filter((cookie) => {
                    return !(url.startsWith('http:') && cookie.secure);
                });
            });
        };
        this.getCookie = (filter) => {
            return this.getAllCookies(filter)
                .then((cookies) => {
                return lodash_1.default.get(cookies, 0, null);
            });
        };
        this.onRequest = (message, data) => {
            let setCookie;
            switch (message) {
                case 'get:cookies':
                    if (data.url) {
                        return this.getCookiesByUrl(data.url);
                    }
                    return this.getAllCookies(data);
                case 'get:cookie':
                    return this.getCookie(data);
                case 'set:cookie':
                    setCookie = normalizeSetCookieProps(data);
                    return this.sendDebuggerCommandFn('Network.setCookie', setCookie)
                        .then((result) => {
                        if (!result.success) {
                            // i wish CDP provided some more detail here, but this is really it in v1.3
                            // @see https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-setCookie
                            throw new Error(`Network.setCookie failed to set cookie: ${JSON.stringify(setCookie)}`);
                        }
                        return this.getCookie(data);
                    });
                case 'set:cookies':
                    setCookie = data.map((cookie) => normalizeSetCookieProps(cookie));
                    return this.sendDebuggerCommandFn('Network.clearBrowserCookies')
                        .then(() => {
                        return this.sendDebuggerCommandFn('Network.setCookies', { cookies: setCookie });
                    });
                case 'clear:cookie':
                    return this.getCookie(data)
                        // tap, so we can resolve with the value of the removed cookie
                        // also, getting the cookie via CDP first will ensure that we send a cookie `domain` to CDP
                        // that matches the cookie domain that is really stored
                        .tap((cookieToBeCleared) => {
                        if (!cookieToBeCleared) {
                            return;
                        }
                        return this.sendDebuggerCommandFn('Network.deleteCookies', lodash_1.default.pick(cookieToBeCleared, 'name', 'domain'));
                    });
                case 'clear:cookies':
                    return bluebird_1.default.mapSeries(data, (cookie) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                        // resolve with the value of the removed cookie
                        // also, getting the cookie via CDP first will ensure that we send a cookie `domain` to CDP
                        // that matches the cookie domain that is really stored
                        const cookieToBeCleared = yield this.getCookie(cookie);
                        if (!cookieToBeCleared)
                            return;
                        yield this.sendDebuggerCommandFn('Network.deleteCookies', lodash_1.default.pick(cookieToBeCleared, 'name', 'domain'));
                        return cookieToBeCleared;
                    }));
                case 'is:automation:client:connected':
                    return true;
                case 'remote:debugger:protocol':
                    return this.sendDebuggerCommandFn(data.command, data.params);
                case 'take:screenshot':
                    return this.sendDebuggerCommandFn('Page.captureScreenshot', { format: 'png' })
                        .catch((err) => {
                        throw new Error(`The browser responded with an error when Cypress attempted to take a screenshot.\n\nDetails:\n${err.message}`);
                    })
                        .then(({ data }) => {
                        return `data:image/png;base64,${data}`;
                    });
                default:
                    throw new Error(`No automation handler registered for: '${message}'`);
            }
        };
        onFn('Network.requestWillBeSent', this.onNetworkRequestWillBeSent);
        onFn('Network.responseReceived', this.onResponseReceived);
        sendDebuggerCommandFn('Network.enable', {
            maxTotalBufferSize: 0,
            maxResourceBufferSize: 0,
            maxPostDataSize: 0,
        });
    }
}
exports.CdpAutomation = CdpAutomation;
