"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.state = void 0;
const lodash_1 = require("lodash");
function state() {
    return {
        requests: {},
        routes: [],
        pendingEventHandlers: {},
        reset() {
            // clean up requests that are still pending
            for (const requestId in this.requests) {
                const { res } = this.requests[requestId];
                res.removeAllListeners('finish');
                res.removeAllListeners('error');
                res.on('error', lodash_1.noop);
                res.destroy();
            }
            this.pendingEventHandlers = {};
            this.requests = {};
            this.routes = [];
        },
    };
}
exports.state = state;
