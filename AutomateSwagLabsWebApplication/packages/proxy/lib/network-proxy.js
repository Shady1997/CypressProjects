"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkProxy = void 0;
const http_1 = require("./http");
class NetworkProxy {
    constructor(opts) {
        this.http = new http_1.Http(opts);
    }
    addPendingBrowserPreRequest(preRequest) {
        this.http.addPendingBrowserPreRequest(preRequest);
    }
    handleHttpRequest(req, res) {
        this.http.handle(req, res);
    }
    handleSourceMapRequest(req, res) {
        this.http.handleSourceMapRequest(req, res);
    }
    setHttpBuffer(buffer) {
        this.http.setBuffer(buffer);
    }
    reset() {
        this.http.reset();
    }
}
exports.NetworkProxy = NetworkProxy;
