"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreRequests = void 0;
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const debug = (0, debug_1.default)('cypress:proxy:http:util:prerequests');
const debugVerbose = (0, debug_1.default)('cypress-verbose:proxy:http:util:prerequests');
const metrics = {
    browserPreRequestsReceived: 0,
    proxyRequestsReceived: 0,
    immediatelyMatchedRequests: 0,
    eventuallyReceivedPreRequest: [],
    neverReceivedPreRequest: [],
};
process.once('exit', () => {
    debug('metrics: %o', metrics);
});
function removeOne(a, predicate) {
    for (let i = a.length - 1; i >= 0; i--) {
        const v = a[i];
        if (predicate(v)) {
            a.splice(i, 1);
            return v;
        }
    }
}
function matches(preRequest, req) {
    return preRequest.method === req.method && preRequest.url === req.proxiedUrl;
}
class PreRequests {
    constructor() {
        this.pendingBrowserPreRequests = [];
        this.requestsPendingPreRequestCbs = [];
    }
    get(req, ctxDebug, cb) {
        metrics.proxyRequestsReceived++;
        const pendingBrowserPreRequest = removeOne(this.pendingBrowserPreRequests, (browserPreRequest) => {
            return matches(browserPreRequest, req);
        });
        if (pendingBrowserPreRequest) {
            metrics.immediatelyMatchedRequests++;
            ctxDebug('matches pending pre-request %o', pendingBrowserPreRequest);
            return cb(pendingBrowserPreRequest);
        }
        const timeout = setTimeout(() => {
            metrics.neverReceivedPreRequest.push({ url: req.proxiedUrl });
            ctxDebug('500ms passed without a pre-request, continuing request with an empty pre-request field!');
            remove();
            cb();
        }, 500);
        const startedMs = Date.now();
        const remove = lodash_1.default.once(() => removeOne(this.requestsPendingPreRequestCbs, (v) => v === requestPendingPreRequestCb));
        const requestPendingPreRequestCb = {
            cb: (browserPreRequest) => {
                const afterMs = Date.now() - startedMs;
                metrics.eventuallyReceivedPreRequest.push({ url: browserPreRequest.url, afterMs });
                ctxDebug('received pre-request after %dms %o', afterMs, browserPreRequest);
                clearTimeout(timeout);
                remove();
                cb(browserPreRequest);
            },
            proxiedUrl: req.proxiedUrl,
            method: req.method,
        };
        this.requestsPendingPreRequestCbs.push(requestPendingPreRequestCb);
    }
    addPending(browserPreRequest) {
        if (this.pendingBrowserPreRequests.indexOf(browserPreRequest) !== -1) {
            return;
        }
        metrics.browserPreRequestsReceived++;
        const requestPendingPreRequestCb = removeOne(this.requestsPendingPreRequestCbs, (req) => {
            return matches(browserPreRequest, req);
        });
        if (requestPendingPreRequestCb) {
            debugVerbose('immediately matched pre-request %o', browserPreRequest);
            return requestPendingPreRequestCb.cb(browserPreRequest);
        }
        debugVerbose('queuing pre-request to be matched later %o %o', browserPreRequest, this.pendingBrowserPreRequests);
        this.pendingBrowserPreRequests.push(browserPreRequest);
    }
}
exports.PreRequests = PreRequests;
