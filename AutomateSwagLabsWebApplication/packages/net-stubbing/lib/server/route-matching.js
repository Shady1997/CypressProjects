"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesRoutePreflight = exports.getRouteForRequest = exports._getMatchableForRequest = exports._doesRouteMatch = void 0;
const lodash_1 = __importDefault(require("lodash"));
const minimatch_1 = __importDefault(require("minimatch"));
const url_1 = __importDefault(require("url"));
const util_1 = require("./util");
/**
 * Returns `true` if `req` matches all supplied properties on `routeMatcher`, `false` otherwise.
 */
function _doesRouteMatch(routeMatcher, req) {
    const matchable = _getMatchableForRequest(req);
    // get a list of all the fields which exist where a rule needs to be succeed
    const stringMatcherFields = (0, util_1.getAllStringMatcherFields)(routeMatcher);
    const booleanFields = lodash_1.default.filter(lodash_1.default.keys(routeMatcher), lodash_1.default.partial(lodash_1.default.includes, ['https']));
    const numberFields = lodash_1.default.filter(lodash_1.default.keys(routeMatcher), lodash_1.default.partial(lodash_1.default.includes, ['port']));
    for (let i = 0; i < stringMatcherFields.length; i++) {
        const field = stringMatcherFields[i];
        let matcher = lodash_1.default.get(routeMatcher, field);
        let value = lodash_1.default.get(matchable, field, '');
        // for convenience, attempt to match `url` against `path`?
        const shouldTryMatchingPath = field === 'url';
        const stringMatch = (value, matcher) => {
            return (value === matcher ||
                (0, minimatch_1.default)(value, matcher, { matchBase: true }) ||
                (field === 'url' && (
                // be nice and match paths that are missing leading slashes
                (value[0] === '/' && matcher[0] !== '/' && stringMatch(value, `/${matcher}`)))));
        };
        if (typeof value !== 'string') {
            value = String(value);
        }
        if (matcher.test) {
            if (!matcher.test(value) && (!shouldTryMatchingPath || !matcher.test(matchable.path))) {
                return false;
            }
            continue;
        }
        if (field === 'method') {
            // case-insensitively match on method
            // @see https://github.com/cypress-io/cypress/issues/9313
            value = value.toLowerCase();
            matcher = matcher.toLowerCase();
        }
        if (!stringMatch(value, matcher) && (!shouldTryMatchingPath || !stringMatch(matchable.path, matcher))) {
            return false;
        }
    }
    for (let i = 0; i < booleanFields.length; i++) {
        const field = booleanFields[i];
        const matcher = lodash_1.default.get(routeMatcher, field);
        const value = lodash_1.default.get(matchable, field);
        if (matcher !== value) {
            return false;
        }
    }
    for (let i = 0; i < numberFields.length; i++) {
        const field = numberFields[i];
        const matcher = lodash_1.default.get(routeMatcher, field);
        const value = lodash_1.default.get(matchable, field);
        if (matcher.length) {
            if (!matcher.includes(value)) {
                return false;
            }
            continue;
        }
        if (matcher !== value) {
            return false;
        }
    }
    return true;
}
exports._doesRouteMatch = _doesRouteMatch;
function _getMatchableForRequest(req) {
    let matchable = lodash_1.default.pick(req, ['headers', 'method']);
    const authorization = req.headers['authorization'];
    if (authorization) {
        const [mechanism, credentials] = authorization.split(' ', 2);
        if (mechanism && credentials && mechanism.toLowerCase() === 'basic') {
            const [username, password] = Buffer.from(credentials, 'base64').toString().split(':', 2);
            matchable.auth = { username, password };
        }
    }
    const proxiedUrl = url_1.default.parse(req.proxiedUrl, true);
    lodash_1.default.assign(matchable, lodash_1.default.pick(proxiedUrl, ['hostname', 'path', 'pathname', 'port', 'query']));
    matchable.url = req.proxiedUrl;
    matchable.https = proxiedUrl.protocol && (proxiedUrl.protocol.indexOf('https') === 0);
    if (!matchable.port) {
        matchable.port = matchable.https ? 443 : 80;
    }
    return matchable;
}
exports._getMatchableForRequest = _getMatchableForRequest;
/**
 * Try to match a `BackendRoute` to a request, optionally starting after `prevRoute`.
 */
function getRouteForRequest(routes, req, prevRoute) {
    const [middleware, handlers] = lodash_1.default.partition(routes, (route) => route.routeMatcher.middleware === true);
    // First, match the oldest matching route handler with `middleware: true`.
    // Then, match the newest matching route handler.
    const orderedRoutes = middleware.concat(handlers.reverse());
    const possibleRoutes = prevRoute ? orderedRoutes.slice(lodash_1.default.findIndex(orderedRoutes, prevRoute) + 1) : orderedRoutes;
    for (const route of possibleRoutes) {
        if (!route.disabled && _doesRouteMatch(route.routeMatcher, req)) {
            return route;
        }
    }
    return;
}
exports.getRouteForRequest = getRouteForRequest;
function isPreflightRequest(req) {
    return req.method === 'OPTIONS' && req.headers['access-control-request-method'];
}
/**
 * Is this a CORS preflight request that could be for an existing route?
 * If there is a matching route with method = 'OPTIONS', returns false.
 */
function matchesRoutePreflight(routes, req) {
    if (!isPreflightRequest(req)) {
        return false;
    }
    let hasCorsOverride = false;
    const matchingRoutes = lodash_1.default.filter(routes, ({ routeMatcher }) => {
        // omit headers from matching since preflight req will not send headers
        const preflightMatcher = lodash_1.default.omit(routeMatcher, 'method', 'headers', 'auth');
        if (!_doesRouteMatch(preflightMatcher, req)) {
            return false;
        }
        if (routeMatcher.method && /options/i.test(String(routeMatcher.method))) {
            hasCorsOverride = true;
        }
        return true;
    });
    return !hasCorsOverride && matchingRoutes.length;
}
exports.matchesRoutePreflight = matchesRoutePreflight;
