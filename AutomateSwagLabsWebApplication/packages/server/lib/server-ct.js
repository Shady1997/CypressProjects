"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerCt = void 0;
const tslib_1 = require("tslib");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const https_proxy_1 = (0, tslib_1.__importDefault)(require("../../https-proxy"));
const server_base_1 = require("../lib/server-base");
const app_data_1 = (0, tslib_1.__importDefault)(require("../lib/util/app_data"));
class ServerCt extends server_base_1.ServerBase {
    open(config, options) {
        return super.open(config, Object.assign(Object.assign({}, options), { testingType: 'component' }));
    }
    createServer(app, config, onWarning) {
        return new bluebird_1.default((resolve, reject) => {
            const { port, baseUrl, socketIoRoute } = config;
            this._server = this._createHttpServer(app);
            this.server.on('connect', this.onConnect.bind(this));
            this.server.on('upgrade', (req, socket, head) => this.onUpgrade(req, socket, head, socketIoRoute));
            return this._listen(port, (err) => {
                if (err.code === 'EADDRINUSE') {
                    reject(`Port ${port} is already in use`);
                }
                reject(err);
            })
                .then((port) => {
                https_proxy_1.default.create(app_data_1.default.path('proxy'), port, {
                    onRequest: this.callListeners.bind(this),
                    onUpgrade: this.onSniUpgrade.bind(this),
                })
                    .then((httpsProxy) => {
                    this._httpsProxy = httpsProxy;
                    // once we open set the domain
                    // to root by default
                    // which prevents a situation where navigating
                    // to http sites redirects to /__/ cypress
                    this._onDomainSet(baseUrl);
                    return resolve([port]);
                });
            });
        });
    }
}
exports.ServerCt = ServerCt;
