"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cookies = exports.normalizeGetCookieProps = exports.normalizeGetCookies = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const extension_1 = (0, tslib_1.__importDefault)(require("../../../extension"));
const cdp_automation_1 = require("../browsers/cdp_automation");
// match the w3c webdriver spec on return cookies
// https://w3c.github.io/webdriver/webdriver-spec.html#cookies
const COOKIE_PROPERTIES = 'name value path domain secure httpOnly expiry hostOnly sameSite'.split(' ');
const debug = (0, debug_1.default)('cypress:server:automation:cookies');
const normalizeCookies = (cookies) => {
    return lodash_1.default.map(cookies, normalizeCookieProps);
};
const normalizeCookieProps = function (props) {
    if (!props) {
        return props;
    }
    const cookie = lodash_1.default.pick(props, COOKIE_PROPERTIES);
    if (props.expiry != null) {
        // when sending cookie props we need to convert
        // expiry to expirationDate
        delete cookie.expiry;
        cookie.expirationDate = props.expiry;
    }
    else if (props.expirationDate != null) {
        // and when receiving cookie props we need to convert
        // expirationDate to expiry and always remove url
        delete cookie.expirationDate;
        delete cookie.url;
        cookie.expiry = props.expirationDate;
    }
    return cookie;
};
const normalizeGetCookies = (cookies) => {
    return lodash_1.default.chain(cookies)
        .map(exports.normalizeGetCookieProps)
        // sort in order of expiration date, ascending
        .sortBy(lodash_1.default.partialRight(lodash_1.default.get, 'expiry', Number.MAX_SAFE_INTEGER))
        .value();
};
exports.normalizeGetCookies = normalizeGetCookies;
const normalizeGetCookieProps = (props) => {
    if (!props) {
        return props;
    }
    if (props.hostOnly === false || (props.hostOnly && !(0, cdp_automation_1.isHostOnlyCookie)(props))) {
        delete props.hostOnly;
    }
    return normalizeCookieProps(props);
};
exports.normalizeGetCookieProps = normalizeGetCookieProps;
class Cookies {
    constructor(cyNamespace, cookieNamespace) {
        this.cyNamespace = cyNamespace;
        this.cookieNamespace = cookieNamespace;
        this.isNamespaced = (cookie) => {
            const name = cookie && cookie.name;
            // if the cookie has no name, return false
            if (!name) {
                return false;
            }
            return name.startsWith(this.cyNamespace) || (name === this.cookieNamespace);
        };
        this.throwIfNamespaced = (data) => {
            if (this.isNamespaced(data)) {
                throw new Error('Sorry, you cannot modify a Cypress namespaced cookie.');
            }
        };
    }
    getCookies(data, automate) {
        debug('getting:cookies %o', data);
        return automate('get:cookies', data)
            .then((cookies) => {
            cookies = (0, exports.normalizeGetCookies)(cookies);
            cookies = lodash_1.default.reject(cookies, (cookie) => this.isNamespaced(cookie));
            debug('received get:cookies %o', cookies);
            return cookies;
        });
    }
    getCookie(data, automate) {
        debug('getting:cookie %o', data);
        return automate(data)
            .then((cookie) => {
            if (this.isNamespaced(cookie)) {
                throw new Error('Sorry, you cannot get a Cypress namespaced cookie.');
            }
            else {
                cookie = (0, exports.normalizeGetCookieProps)(cookie);
                debug('received get:cookie %o', cookie);
                return cookie;
            }
        });
    }
    setCookie(data, automate) {
        this.throwIfNamespaced(data);
        const cookie = normalizeCookieProps(data);
        // lets construct the url ourselves right now
        // unless we already have a URL
        cookie.url = data.url != null ? data.url : extension_1.default.getCookieUrl(data);
        debug('set:cookie %o', cookie);
        return automate(cookie)
            .then((cookie) => {
            cookie = (0, exports.normalizeGetCookieProps)(cookie);
            debug('received set:cookie %o', cookie);
            return cookie;
        });
    }
    setCookies(cookies, automate) {
        cookies = cookies.map((data) => {
            this.throwIfNamespaced(data);
            const cookie = normalizeCookieProps(data);
            // lets construct the url ourselves right now
            // unless we already have a URL
            cookie.url = data.url != null ? data.url : extension_1.default.getCookieUrl(data);
            return cookie;
        });
        debug('set:cookies %o', cookies);
        return automate('set:cookies', cookies)
            // .tap(console.log)
            .return(cookies);
    }
    clearCookie(data, automate) {
        this.throwIfNamespaced(data);
        debug('clear:cookie %o', data);
        return automate(data)
            .then((cookie) => {
            cookie = normalizeCookieProps(cookie);
            debug('received clear:cookie %o', cookie);
            return cookie;
        });
    }
    clearCookies(data, automate) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const cookiesToClear = data;
            const cookies = lodash_1.default.reject(normalizeCookies(cookiesToClear), this.isNamespaced);
            debug('clear:cookies %o', cookies.length);
            return automate('clear:cookies', cookies)
                .mapSeries(normalizeCookieProps);
        });
    }
    changeCookie(data) {
        const c = normalizeCookieProps(data.cookie);
        if (this.isNamespaced(c)) {
            return;
        }
        const msg = data.removed ?
            `Cookie Removed: '${c.name}'`
            :
                `Cookie Set: '${c.name}'`;
        return {
            cookie: c,
            message: msg,
            removed: data.removed,
        };
    }
}
exports.Cookies = Cookies;
Cookies.normalizeCookies = normalizeCookies;
Cookies.normalizeCookieProps = normalizeCookieProps;
