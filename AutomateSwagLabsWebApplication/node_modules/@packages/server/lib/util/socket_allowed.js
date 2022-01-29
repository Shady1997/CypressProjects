"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketAllowed = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const debug = (0, debug_1.default)('cypress:server:util:socket_allowed');
/**
 * Utility to validate incoming, local socket connections against a list of
 * expected client TCP ports.
 */
class SocketAllowed {
    constructor() {
        this.allowedLocalPorts = [];
        /**
         * Add a socket to the allowed list.
         */
        this.add = (socket) => {
            const { localPort } = socket;
            debug('allowing socket %o', { localPort });
            this.allowedLocalPorts.push(localPort);
            socket.once('close', () => {
                debug('allowed socket closed, removing %o', { localPort });
                this._remove(socket);
            });
        };
    }
    _remove(socket) {
        lodash_1.default.pull(this.allowedLocalPorts, socket.localPort);
    }
    /**
     * Is this socket that this request originated allowed?
     */
    isRequestAllowed(req) {
        const { remotePort, remoteAddress } = req.socket;
        const isAllowed = this.allowedLocalPorts.includes(remotePort)
            && ['127.0.0.1', '::1'].includes(remoteAddress);
        debug('is incoming request allowed? %o', { isAllowed, reqUrl: req.url, remotePort, remoteAddress });
        return isAllowed;
    }
}
exports.SocketAllowed = SocketAllowed;
