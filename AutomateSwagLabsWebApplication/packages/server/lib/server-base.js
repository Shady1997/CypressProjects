"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerBase = void 0;
const tslib_1 = require("tslib");
require("./cwd");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const compression_1 = (0, tslib_1.__importDefault)(require("compression"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const evil_dns_1 = (0, tslib_1.__importDefault)(require("evil-dns"));
const express_1 = (0, tslib_1.__importDefault)(require("express"));
const http_1 = (0, tslib_1.__importDefault)(require("http"));
const http_proxy_1 = (0, tslib_1.__importDefault)(require("http-proxy"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const url_1 = (0, tslib_1.__importDefault)(require("url"));
const lazy_ass_1 = (0, tslib_1.__importDefault)(require("lazy-ass"));
const net_stubbing_1 = require("../../net-stubbing");
const network_1 = require("../../network");
const proxy_1 = require("../../proxy");
const errors_1 = (0, tslib_1.__importDefault)(require("./errors"));
const logger_1 = (0, tslib_1.__importDefault)(require("./logger"));
const request_1 = (0, tslib_1.__importDefault)(require("./request"));
const template_engine_1 = (0, tslib_1.__importDefault)(require("./template_engine"));
const class_helpers_1 = require("./util/class-helpers");
const origin_1 = (0, tslib_1.__importDefault)(require("./util/origin"));
const server_destroy_1 = require("./util/server_destroy");
const socket_allowed_1 = require("./util/socket_allowed");
const rewriter_1 = require("../../rewriter");
const routes_1 = require("./routes");
const routes_e2e_1 = require("./routes-e2e");
const routes_ct_1 = require("./routes-ct");
const ALLOWED_PROXY_BYPASS_URLS = [
    '/',
    '/__cypress/runner/cypress_runner.css',
    '/__cypress/runner/cypress_runner.js',
    '/__cypress/runner/favicon.ico',
];
const DEFAULT_DOMAIN_NAME = 'localhost';
const fullyQualifiedRe = /^https?:\/\//;
const debug = (0, debug_1.default)('cypress:server:server-base');
const _isNonProxiedRequest = (req) => {
    // proxied HTTP requests have a URL like: "http://example.com/foo"
    // non-proxied HTTP requests have a URL like: "/foo"
    return req.proxiedUrl.startsWith('/');
};
const _forceProxyMiddleware = function (clientRoute) {
    // normalize clientRoute to help with comparison
    const trimmedClientRoute = lodash_1.default.trimEnd(clientRoute, '/');
    return function (req, res, next) {
        const trimmedUrl = lodash_1.default.trimEnd(req.proxiedUrl, '/');
        if (_isNonProxiedRequest(req) && !ALLOWED_PROXY_BYPASS_URLS.includes(trimmedUrl) && (trimmedUrl !== trimmedClientRoute)) {
            // this request is non-proxied and non-allowed, redirect to the runner error page
            return res.redirect(clientRoute);
        }
        return next();
    };
};
const setProxiedUrl = function (req) {
    // proxiedUrl is the full URL with scheme, host, and port
    // it will only be fully-qualified if the request was proxied.
    // this function will set the URL of the request to be the path
    // only, which can then be used to proxy the request.
    // bail if we've already proxied the url
    if (req.proxiedUrl) {
        return;
    }
    // backup the original proxied url
    // and slice out the host/origin
    // and only leave the path which is
    // how browsers would normally send
    // use their url
    req.proxiedUrl = network_1.uri.removeDefaultPort(req.url).format();
    req.url = network_1.uri.getPath(req.url);
};
const notSSE = (req, res) => {
    return (req.headers.accept !== 'text/event-stream') && compression_1.default.filter(req, res);
};
class ServerBase {
    constructor() {
        this.ensureProp = class_helpers_1.ensureProp;
        this.isListening = false;
        // @ts-ignore
        this.request = (0, request_1.default)();
        this.socketAllowed = new socket_allowed_1.SocketAllowed();
        this._middleware = null;
        this._baseUrl = null;
        this._fileServer = null;
    }
    get server() {
        return this.ensureProp(this._server, 'open');
    }
    get socket() {
        return this.ensureProp(this._socket, 'open');
    }
    get nodeProxy() {
        return this.ensureProp(this._nodeProxy, 'open');
    }
    get networkProxy() {
        return this.ensureProp(this._networkProxy, 'open');
    }
    get netStubbingState() {
        return this.ensureProp(this._netStubbingState, 'open');
    }
    get httpsProxy() {
        return this.ensureProp(this._httpsProxy, 'open');
    }
    open(config, { getSpec, getCurrentBrowser, onError, onWarning, shouldCorrelatePreRequests, specsStore, testingType, SocketCtor, exit, }) {
        debug('server open');
        (0, lazy_ass_1.default)(lodash_1.default.isPlainObject(config), 'expected plain config object', config);
        return bluebird_1.default.try(() => {
            if (!config.baseUrl && testingType === 'component') {
                throw new Error('ServerCt#open called without config.baseUrl.');
            }
            const app = this.createExpressApp(config);
            logger_1.default.setSettings(config);
            this._nodeProxy = http_proxy_1.default.createProxyServer({
                target: config.baseUrl && testingType === 'component' ? config.baseUrl : undefined,
            });
            this._socket = new SocketCtor(config);
            network_1.clientCertificates.loadClientCertificateConfig(config);
            const getRemoteState = () => {
                return this._getRemoteState();
            };
            this.createNetworkProxy(config, getRemoteState, shouldCorrelatePreRequests);
            if (config.experimentalSourceRewriting) {
                (0, rewriter_1.createInitialWorkers)();
            }
            this.createHosts(config.hosts);
            const routeOptions = {
                config,
                specsStore,
                getRemoteState,
                nodeProxy: this.nodeProxy,
                networkProxy: this._networkProxy,
                onError,
                getSpec,
                getCurrentBrowser,
                testingType,
                exit,
            };
            const runnerSpecificRouter = testingType === 'e2e'
                ? (0, routes_e2e_1.createRoutesE2E)(routeOptions)
                : (0, routes_ct_1.createRoutesCT)(routeOptions);
            app.use(runnerSpecificRouter);
            app.use((0, routes_1.createCommonRoutes)(routeOptions));
            return this.createServer(app, config, onWarning);
        });
    }
    createExpressApp(config) {
        const { morgan, clientRoute } = config;
        const app = (0, express_1.default)();
        // set the cypress config from the cypress.json file
        app.set('view engine', 'html');
        // since we use absolute paths, configure express-handlebars to not automatically find layouts
        // https://github.com/cypress-io/cypress/issues/2891
        app.engine('html', template_engine_1.default.render);
        // handle the proxied url in case
        // we have not yet started our websocket server
        app.use((req, res, next) => {
            setProxiedUrl(req);
            // useful for tests
            if (this._middleware) {
                this._middleware(req, res);
            }
            // always continue on
            return next();
        });
        app.use(_forceProxyMiddleware(clientRoute));
        app.use(require('cookie-parser')());
        app.use((0, compression_1.default)({ filter: notSSE }));
        if (morgan) {
            app.use(require('morgan')('dev'));
        }
        // errorhandler
        app.use(require('errorhandler')());
        // remove the express powered-by header
        app.disable('x-powered-by');
        return app;
    }
    getHttpServer() {
        return this._server;
    }
    portInUseErr(port) {
        const e = errors_1.default.get('PORT_IN_USE_SHORT', port);
        e.port = port;
        e.portInUse = true;
        return e;
    }
    createNetworkProxy(config, getRemoteState, shouldCorrelatePreRequests) {
        const getFileServerToken = () => {
            return this._fileServer.token;
        };
        this._netStubbingState = (0, net_stubbing_1.netStubbingState)();
        // @ts-ignore
        this._networkProxy = new proxy_1.NetworkProxy({
            config,
            shouldCorrelatePreRequests,
            getRemoteState,
            getFileServerToken,
            socket: this.socket,
            netStubbingState: this.netStubbingState,
            request: this.request,
        });
    }
    startWebsockets(automation, config, options = {}) {
        var _a;
        options.onRequest = this._onRequest.bind(this);
        options.netStubbingState = this.netStubbingState;
        options.getRenderedHTMLOrigins = (_a = this._networkProxy) === null || _a === void 0 ? void 0 : _a.http.getRenderedHTMLOrigins;
        options.onResetServerState = () => {
            this.networkProxy.reset();
            this.netStubbingState.reset();
        };
        const io = this.socket.startListening(this.server, automation, config, options);
        this._normalizeReqUrl(this.server);
        return io;
    }
    createHosts(hosts = []) {
        return lodash_1.default.each(hosts, (ip, host) => {
            return evil_dns_1.default.add(host, ip);
        });
    }
    addBrowserPreRequest(browserPreRequest) {
        this.networkProxy.addPendingBrowserPreRequest(browserPreRequest);
    }
    emitRequestEvent(eventName, data) {
        this.socket.toDriver('request:event', eventName, data);
    }
    _createHttpServer(app) {
        const svr = http_1.default.createServer(network_1.httpUtils.lenientOptions, app);
        (0, server_destroy_1.allowDestroy)(svr);
        // @ts-ignore
        return svr;
    }
    _port() {
        return this.server.address().port;
    }
    _listen(port, onError) {
        return new bluebird_1.default((resolve) => {
            const listener = () => {
                const address = this.server.address();
                this.isListening = true;
                debug('Server listening on ', address);
                this.server.removeListener('error', onError);
                return resolve(address.port);
            };
            return this.server.listen(port || 0, '127.0.0.1', listener);
        });
    }
    _onRequest(headers, automationRequest, options) {
        // @ts-ignore
        return this.request.sendPromise(headers, automationRequest, options);
    }
    _callRequestListeners(server, listeners, req, res) {
        return listeners.map((listener) => {
            return listener.call(server, req, res);
        });
    }
    _normalizeReqUrl(server) {
        // because socket.io removes all of our request
        // events, it forces the socket.io traffic to be
        // handled first.
        // however we need to basically do the same thing
        // it does and after we call into socket.io go
        // through and remove all request listeners
        // and change the req.url by slicing out the host
        // because the browser is in proxy mode
        const listeners = server.listeners('request').slice(0);
        server.removeAllListeners('request');
        server.on('request', (req, res) => {
            setProxiedUrl(req);
            this._callRequestListeners(server, listeners, req, res);
        });
    }
    _getRemoteState() {
        // {
        //   origin: "http://localhost:2020"
        //   fileServer:
        //   strategy: "file"
        //   domainName: "localhost"
        //   props: null
        // }
        // {
        //   origin: "https://foo.google.com"
        //   strategy: "http"
        //   domainName: "google.com"
        //   props: {
        //     port: 443
        //     tld: "com"
        //     domain: "google"
        //   }
        // }
        const props = lodash_1.default.extend({}, {
            auth: this._remoteAuth,
            props: this._remoteProps,
            origin: this._remoteOrigin,
            strategy: this._remoteStrategy,
            visiting: this._remoteVisitingUrl,
            domainName: this._remoteDomainName,
            fileServer: this._remoteFileServer,
        });
        debug('Getting remote state: %o', props);
        return props;
    }
    _onDomainSet(fullyQualifiedUrl, options = {}) {
        const l = (type, val) => {
            return debug('Setting', type, val);
        };
        this._remoteAuth = options.auth;
        l('remoteAuth', this._remoteAuth);
        // if this isn't a fully qualified url
        // or if this came to us as <root> in our tests
        // then we know to go back to our default domain
        // which is the localhost server
        if ((fullyQualifiedUrl === '<root>') || !fullyQualifiedRe.test(fullyQualifiedUrl)) {
            this._remoteOrigin = `http://${DEFAULT_DOMAIN_NAME}:${this._port()}`;
            this._remoteStrategy = 'file';
            this._remoteFileServer = `http://${DEFAULT_DOMAIN_NAME}:${(this._fileServer != null ? this._fileServer.port() : undefined)}`;
            this._remoteDomainName = DEFAULT_DOMAIN_NAME;
            this._remoteProps = null;
            l('remoteOrigin', this._remoteOrigin);
            l('remoteStrategy', this._remoteStrategy);
            l('remoteHostAndPort', this._remoteProps);
            l('remoteDocDomain', this._remoteDomainName);
            l('remoteFileServer', this._remoteFileServer);
        }
        else {
            this._remoteOrigin = (0, origin_1.default)(fullyQualifiedUrl);
            this._remoteStrategy = 'http';
            this._remoteFileServer = null;
            // set an object with port, tld, and domain properties
            // as the remoteHostAndPort
            this._remoteProps = network_1.cors.parseUrlIntoDomainTldPort(this._remoteOrigin);
            // @ts-ignore
            this._remoteDomainName = lodash_1.default.compact([this._remoteProps.domain, this._remoteProps.tld]).join('.');
            l('remoteOrigin', this._remoteOrigin);
            l('remoteHostAndPort', this._remoteProps);
            l('remoteDocDomain', this._remoteDomainName);
        }
        return this._getRemoteState();
    }
    proxyWebsockets(proxy, socketIoRoute, req, socket, head) {
        // bail if this is our own namespaced socket.io request
        if (req.url.startsWith(socketIoRoute)) {
            if (!this.socketAllowed.isRequestAllowed(req)) {
                socket.write('HTTP/1.1 400 Bad Request\r\n\r\nRequest not made via a Cypress-launched browser.');
                socket.end();
            }
            // we can return here either way, if the socket is still valid socket.io will hook it up
            return;
        }
        const host = req.headers.host;
        if (host) {
            // get the protocol using req.connection.encrypted
            // get the port & hostname from host header
            const fullUrl = `${req.connection.encrypted ? 'https' : 'http'}://${host}`;
            const { hostname, protocol } = url_1.default.parse(fullUrl);
            const { port } = network_1.cors.parseUrlIntoDomainTldPort(fullUrl);
            const onProxyErr = (err, req, res) => {
                return debug('Got ERROR proxying websocket connection', { err, port, protocol, hostname, req });
            };
            return proxy.ws(req, socket, head, {
                secure: false,
                target: {
                    host: hostname,
                    port,
                    protocol,
                },
                agent: network_1.agent,
            }, onProxyErr);
        }
        // we can't do anything with this socket
        // since we don't know how to proxy it!
        if (socket.writable) {
            return socket.end();
        }
    }
    reset() {
        var _a, _b;
        (_a = this._networkProxy) === null || _a === void 0 ? void 0 : _a.reset();
        const baseUrl = (_b = this._baseUrl) !== null && _b !== void 0 ? _b : '<root>';
        return this._onDomainSet(baseUrl);
    }
    _close() {
        // bail early we dont have a server or we're not
        // currently listening
        if (!this._server || !this.isListening) {
            return bluebird_1.default.resolve(true);
        }
        this.reset();
        logger_1.default.unsetSettings();
        evil_dns_1.default.clear();
        return this._server.destroyAsync()
            .then(() => {
            this.isListening = false;
        });
    }
    close() {
        var _a, _b, _c;
        return bluebird_1.default.all([
            this._close(),
            (_a = this._socket) === null || _a === void 0 ? void 0 : _a.close(),
            (_b = this._fileServer) === null || _b === void 0 ? void 0 : _b.close(),
            (_c = this._httpsProxy) === null || _c === void 0 ? void 0 : _c.close(),
        ])
            .then((res) => {
            this._middleware = null;
            return res;
        });
    }
    end() {
        return this._socket && this._socket.end();
    }
    changeToUrl(url) {
        return this._socket && this._socket.changeToUrl(url);
    }
    onRequest(fn) {
        this._middleware = fn;
    }
    onNextRequest(fn) {
        return this.onRequest((...args) => {
            fn.apply(this, args);
            this._middleware = null;
        });
    }
    onUpgrade(req, socket, head, socketIoRoute) {
        debug('Got UPGRADE request from %s', req.url);
        return this.proxyWebsockets(this.nodeProxy, socketIoRoute, req, socket, head);
    }
    callListeners(req, res) {
        const listeners = this.server.listeners('request').slice(0);
        return this._callRequestListeners(this.server, listeners, req, res);
    }
    onSniUpgrade(req, socket, head) {
        const upgrades = this.server.listeners('upgrade').slice(0);
        return upgrades.map((upgrade) => {
            return upgrade.call(this.server, req, socket, head);
        });
    }
    onConnect(req, socket, head) {
        debug('Got CONNECT request from %s', req.url);
        socket.once('upstream-connected', this.socketAllowed.add);
        return this.httpsProxy.connect(req, socket, head);
    }
    sendSpecList(specs, testingType) {
        return this.socket.sendSpecList(specs, testingType);
    }
}
exports.ServerBase = ServerBase;
