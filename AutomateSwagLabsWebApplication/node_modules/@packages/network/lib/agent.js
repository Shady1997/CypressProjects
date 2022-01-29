"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CombinedAgent = exports.regenerateRequestHead = exports.isResponseStatusCode200 = exports.isRequestHttps = exports.createProxySock = exports.buildConnectReqHead = exports.clientCertificateStore = void 0;
const debug_1 = __importDefault(require("debug"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const lodash_1 = __importDefault(require("lodash"));
const net_1 = __importDefault(require("net"));
const proxy_from_env_1 = require("proxy-from-env");
const url_1 = __importDefault(require("url"));
const connect_1 = require("./connect");
const http_utils_1 = require("./http-utils");
const client_certificates_1 = require("./client-certificates");
const debug = (0, debug_1.default)('cypress:network:agent');
const CRLF = '\r\n';
const statusCodeRe = /^HTTP\/1.[01] (\d*)/;
exports.clientCertificateStore = new client_certificates_1.ClientCertificateStore();
function buildConnectReqHead(hostname, port, proxy) {
    const connectReq = [`CONNECT ${hostname}:${port} HTTP/1.1`];
    connectReq.push(`Host: ${hostname}:${port}`);
    if (proxy.auth) {
        connectReq.push(`Proxy-Authorization: basic ${Buffer.from(proxy.auth).toString('base64')}`);
    }
    return connectReq.join(CRLF) + lodash_1.default.repeat(CRLF, 2);
}
exports.buildConnectReqHead = buildConnectReqHead;
const createProxySock = (opts, cb) => {
    if (opts.proxy.protocol !== 'https:' && opts.proxy.protocol !== 'http:') {
        return cb(new Error(`Unsupported proxy protocol: ${opts.proxy.protocol}`));
    }
    const isHttps = opts.proxy.protocol === 'https:';
    const port = opts.proxy.port || (isHttps ? 443 : 80);
    let connectOpts = {
        port: Number(port),
        host: opts.proxy.hostname,
        useTls: isHttps,
    };
    if (!opts.shouldRetry) {
        connectOpts.getDelayMsForRetry = () => undefined;
    }
    (0, connect_1.createRetryingSocket)(connectOpts, (err, sock, triggerRetry) => {
        if (err) {
            return cb(err);
        }
        cb(undefined, sock, triggerRetry);
    });
};
exports.createProxySock = createProxySock;
const isRequestHttps = (options) => {
    // WSS connections will not have an href, but you can tell protocol from the defaultAgent
    return lodash_1.default.get(options, '_defaultAgent.protocol') === 'https:' || (options.href || '').slice(0, 6) === 'https';
};
exports.isRequestHttps = isRequestHttps;
const isResponseStatusCode200 = (head) => {
    // read status code from proxy's response
    const matches = head.match(statusCodeRe);
    return lodash_1.default.get(matches, 1) === '200';
};
exports.isResponseStatusCode200 = isResponseStatusCode200;
const regenerateRequestHead = (req) => {
    delete req._header;
    req._implicitHeader();
    if (req.output && req.output.length > 0) {
        // the _header has already been queued to be written to the socket
        const first = req.output[0];
        const endOfHeaders = first.indexOf(lodash_1.default.repeat(CRLF, 2)) + 4;
        req.output[0] = req._header + first.substring(endOfHeaders);
    }
};
exports.regenerateRequestHead = regenerateRequestHead;
const getFirstWorkingFamily = ({ port, host }, familyCache, cb) => {
    // this is a workaround for localhost (and potentially others) having invalid
    // A records but valid AAAA records. here, we just cache the family of the first
    // returned A/AAAA record for a host that we can establish a connection to.
    // https://github.com/cypress-io/cypress/issues/112
    const isIP = net_1.default.isIP(host);
    if (isIP) {
        // isIP conveniently returns the family of the address
        return cb(isIP);
    }
    if (process.env.HTTP_PROXY) {
        // can't make direct connections through the proxy, this won't work
        return cb();
    }
    if (familyCache[host]) {
        return cb(familyCache[host]);
    }
    return (0, connect_1.getAddress)(port, host)
        .then((firstWorkingAddress) => {
        familyCache[host] = firstWorkingAddress.family;
        return cb(firstWorkingAddress.family);
    })
        .catch(() => {
        return cb();
    });
};
class CombinedAgent {
    constructor(httpOpts = {}, httpsOpts = {}) {
        this.familyCache = {};
        this.httpAgent = new HttpAgent(httpOpts);
        this.httpsAgent = new HttpsAgent(httpsOpts);
    }
    // called by Node.js whenever a new request is made internally
    addRequest(req, options, port, localAddress) {
        lodash_1.default.merge(req, http_utils_1.lenientOptions);
        // Legacy API: addRequest(req, host, port, localAddress)
        // https://github.com/nodejs/node/blob/cb68c04ce1bc4534b2d92bc7319c6ff6dda0180d/lib/_http_agent.js#L148-L155
        if (typeof options === 'string') {
            // @ts-ignore
            options = {
                host: options,
                port: port,
                localAddress,
            };
        }
        const isHttps = (0, exports.isRequestHttps)(options);
        if (!options.href) {
            // options.path can contain query parameters, which url.format will not-so-kindly urlencode for us...
            // so just append it to the resultant URL string
            options.href = url_1.default.format({
                protocol: isHttps ? 'https:' : 'http:',
                slashes: true,
                hostname: options.host,
                port: options.port,
            }) + options.path;
            if (!options.uri) {
                options.uri = url_1.default.parse(options.href);
            }
        }
        debug('addRequest called %o', Object.assign({ isHttps }, lodash_1.default.pick(options, 'href')));
        return getFirstWorkingFamily(options, this.familyCache, (family) => {
            options.family = family;
            debug('got family %o', lodash_1.default.pick(options, 'family', 'href'));
            if (isHttps) {
                lodash_1.default.assign(options, exports.clientCertificateStore.getClientCertificateAgentOptionsForUrl(options.uri));
                return this.httpsAgent.addRequest(req, options);
            }
            this.httpAgent.addRequest(req, options);
        });
    }
}
exports.CombinedAgent = CombinedAgent;
class HttpAgent extends http_1.default.Agent {
    constructor(opts = {}) {
        opts.keepAlive = true;
        super(opts);
        // we will need this if they wish to make http requests over an https proxy
        this.httpsAgent = new https_1.default.Agent({ keepAlive: true });
    }
    addRequest(req, options) {
        if (process.env.HTTP_PROXY) {
            const proxy = (0, proxy_from_env_1.getProxyForUrl)(options.href);
            if (proxy) {
                options.proxy = proxy;
                return this._addProxiedRequest(req, options);
            }
        }
        super.addRequest(req, options);
    }
    _addProxiedRequest(req, options) {
        debug(`Creating proxied request for ${options.href} through ${options.proxy}`);
        const proxy = url_1.default.parse(options.proxy);
        // set req.path to the full path so the proxy can resolve it
        // @ts-ignore: Cannot assign to 'path' because it is a constant or a read-only property.
        req.path = options.href;
        delete req._header; // so we can set headers again
        req.setHeader('host', `${options.host}:${options.port}`);
        if (proxy.auth) {
            req.setHeader('proxy-authorization', `basic ${Buffer.from(proxy.auth).toString('base64')}`);
        }
        // node has queued an HTTP message to be sent already, so we need to regenerate the
        // queued message with the new path and headers
        // https://github.com/TooTallNate/node-http-proxy-agent/blob/master/index.js#L93
        (0, exports.regenerateRequestHead)(req);
        options.port = Number(proxy.port || 80);
        options.host = proxy.hostname || 'localhost';
        delete options.path; // so the underlying net.connect doesn't default to IPC
        if (proxy.protocol === 'https:') {
            // gonna have to use the https module to reach the proxy, even though this is an http req
            req.agent = this.httpsAgent;
            return this.httpsAgent.addRequest(req, options);
        }
        super.addRequest(req, options);
    }
}
class HttpsAgent extends https_1.default.Agent {
    constructor(opts = {}) {
        opts.keepAlive = true;
        super(opts);
    }
    createConnection(options, cb) {
        if (process.env.HTTPS_PROXY) {
            const proxy = (0, proxy_from_env_1.getProxyForUrl)(options.href);
            if (proxy) {
                options.proxy = proxy;
                return this.createUpstreamProxyConnection(options, cb);
            }
        }
        // @ts-ignore
        cb(null, super.createConnection(options));
    }
    createUpstreamProxyConnection(options, cb) {
        // heavily inspired by
        // https://github.com/mknj/node-keepalive-proxy-agent/blob/master/index.js
        debug(`Creating proxied socket for ${options.href} through ${options.proxy}`);
        const proxy = url_1.default.parse(options.proxy);
        const port = options.uri.port || '443';
        const hostname = options.uri.hostname || 'localhost';
        (0, exports.createProxySock)({ proxy, shouldRetry: options.shouldRetry }, (originalErr, proxySocket, triggerRetry) => {
            if (originalErr) {
                const err = new Error(`A connection to the upstream proxy could not be established: ${originalErr.message}`);
                err.originalErr = originalErr;
                err.upstreamProxyConnect = true;
                return cb(err, undefined);
            }
            const onClose = () => {
                triggerRetry(new Error('ERR_EMPTY_RESPONSE: The upstream proxy closed the socket after connecting but before sending a response.'));
            };
            const onError = (err) => {
                triggerRetry(err);
                proxySocket.destroy();
            };
            let buffer = '';
            const onData = (data) => {
                debug(`Proxy socket for ${options.href} established`);
                buffer += data.toString();
                if (!lodash_1.default.includes(buffer, lodash_1.default.repeat(CRLF, 2))) {
                    // haven't received end of headers yet, keep buffering
                    proxySocket.once('data', onData);
                    return;
                }
                // we've now gotten enough of a response not to retry
                // connecting to the proxy
                proxySocket.removeListener('error', onError);
                proxySocket.removeListener('close', onClose);
                if (!(0, exports.isResponseStatusCode200)(buffer)) {
                    return cb(new Error(`Error establishing proxy connection. Response from server was: ${buffer}`), undefined);
                }
                if (options._agentKey) {
                    // https.Agent will upgrade and reuse this socket now
                    options.socket = proxySocket;
                    // as of Node 12, a ServerName cannot be an IP address
                    // https://github.com/cypress-io/cypress/issues/5729
                    if (!net_1.default.isIP(hostname)) {
                        options.servername = hostname;
                    }
                    return cb(undefined, super.createConnection(options, undefined));
                }
                cb(undefined, proxySocket);
            };
            proxySocket.once('close', onClose);
            proxySocket.once('error', onError);
            proxySocket.once('data', onData);
            const connectReq = buildConnectReqHead(hostname, port, proxy);
            proxySocket.setNoDelay(true);
            proxySocket.write(connectReq);
        });
    }
}
const agent = new CombinedAgent();
exports.default = agent;
