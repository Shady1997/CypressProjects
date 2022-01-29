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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlMatchesOriginProtectionSpace = exports.urlMatchesOriginPolicyProps = exports.parseUrlIntoDomainTldPort = exports.parseDomain = exports.getSuperDomain = void 0;
const lodash_1 = __importDefault(require("lodash"));
const uri = __importStar(require("./uri"));
const debug_1 = __importDefault(require("debug"));
const parse_domain_1 = __importDefault(require("@cypress/parse-domain"));
const debug = (0, debug_1.default)('cypress:network:cors');
// match IP addresses or anything following the last .
const customTldsRe = /(^[\d\.]+$|\.[^\.]+$)/;
function getSuperDomain(url) {
    const parsed = parseUrlIntoDomainTldPort(url);
    return lodash_1.default.compact([parsed.domain, parsed.tld]).join('.');
}
exports.getSuperDomain = getSuperDomain;
function parseDomain(domain, options = {}) {
    return (0, parse_domain_1.default)(domain, lodash_1.default.defaults(options, {
        privateTlds: true,
        customTlds: customTldsRe,
    }));
}
exports.parseDomain = parseDomain;
function parseUrlIntoDomainTldPort(str) {
    let { hostname, port, protocol } = uri.parse(str);
    if (!hostname) {
        hostname = '';
    }
    if (!port) {
        port = protocol === 'https:' ? '443' : '80';
    }
    let parsed = parseDomain(hostname);
    // if we couldn't get a parsed domain
    if (!parsed) {
        // then just fall back to a dumb check
        // based on assumptions that the tld
        // is the last segment after the final
        // '.' and that the domain is the segment
        // before that
        const segments = hostname.split('.');
        parsed = {
            tld: segments[segments.length - 1] || '',
            domain: segments[segments.length - 2] || '',
        };
    }
    const obj = {};
    obj.port = port;
    obj.tld = parsed.tld;
    obj.domain = parsed.domain;
    debug('Parsed URL %o', obj);
    return obj;
}
exports.parseUrlIntoDomainTldPort = parseUrlIntoDomainTldPort;
function urlMatchesOriginPolicyProps(urlStr, props) {
    // take a shortcut here in the case
    // where remoteHostAndPort is null
    if (!props) {
        return false;
    }
    const parsedUrl = parseUrlIntoDomainTldPort(urlStr);
    // does the parsedUrl match the parsedHost?
    return lodash_1.default.isEqual(parsedUrl, props);
}
exports.urlMatchesOriginPolicyProps = urlMatchesOriginPolicyProps;
function urlMatchesOriginProtectionSpace(urlStr, origin) {
    const normalizedUrl = uri.addDefaultPort(urlStr).format();
    const normalizedOrigin = uri.addDefaultPort(origin).format();
    return lodash_1.default.startsWith(normalizedUrl, normalizedOrigin);
}
exports.urlMatchesOriginProtectionSpace = urlMatchesOriginProtectionSpace;
