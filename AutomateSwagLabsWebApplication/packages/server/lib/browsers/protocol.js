"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWsTargetFor = exports.getRemoteDebuggingPort = exports._connectAsync = exports._getDelayMsForRetry = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const chrome_remote_interface_1 = (0, tslib_1.__importDefault)(require("chrome-remote-interface"));
const network_1 = require("../../../network");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const lazy_ass_1 = (0, tslib_1.__importDefault)(require("lazy-ass"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const utils_1 = (0, tslib_1.__importDefault)(require("./utils"));
const errors = require('../errors');
const is = require('check-more-types');
const debug = (0, debug_1.default)('cypress:server:browsers:protocol');
function _getDelayMsForRetry(i, browserName) {
    if (i < 10) {
        return 100;
    }
    if (i < 18) {
        return 500;
    }
    if (i < 63) { // after 5 seconds, begin logging and retrying
        errors.warning('CDP_RETRYING_CONNECTION', i, browserName);
        return 1000;
    }
    return;
}
exports._getDelayMsForRetry = _getDelayMsForRetry;
function _connectAsync(opts) {
    return bluebird_1.default.fromCallback((cb) => {
        network_1.connect.createRetryingSocket(opts, cb);
    })
        .then((sock) => {
        // can be closed, just needed to test the connection
        sock.end();
    });
}
exports._connectAsync = _connectAsync;
/**
 * Tries to find the starting page (probably blank tab)
 * among all targets returned by CRI.List call.
 *
 * @returns {string} web socket debugger url
 */
const findStartPage = (targets) => {
    debug('CRI List %o', { numTargets: targets.length, targets });
    // activate the first available id
    // find the first target page that's a real tab
    // and not the dev tools or background page.
    // since we open a blank page first, it has a special url
    const newTabTargetFields = {
        type: 'page',
        url: 'about:blank',
    };
    const target = lodash_1.default.find(targets, newTabTargetFields);
    (0, lazy_ass_1.default)(target, 'could not find CRI target');
    debug('found CRI target %o', target);
    return target.webSocketDebuggerUrl;
};
const findStartPageTarget = (connectOpts) => {
    debug('CRI.List %o', connectOpts);
    // what happens if the next call throws an error?
    // it seems to leave the browser instance open
    // need to clone connectOpts, CRI modifies it
    return chrome_remote_interface_1.default.List(lodash_1.default.clone(connectOpts)).then(findStartPage);
};
function getRemoteDebuggingPort() {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const port = Number(process.env.CYPRESS_REMOTE_DEBUGGING_PORT);
        return port || utils_1.default.getPort();
    });
}
exports.getRemoteDebuggingPort = getRemoteDebuggingPort;
/**
 * Waits for the port to respond with connection to Chrome Remote Interface
 * @param {number} port Port number to connect to
 * @param {string} browserName Browser name, for warning/error messages
 */
const getWsTargetFor = (port, browserName) => {
    debug('Getting WS connection to CRI on port %d', port);
    (0, lazy_ass_1.default)(is.port(port), 'expected port number', port);
    let retryIndex = 0;
    // force ipv4
    // https://github.com/cypress-io/cypress/issues/5912
    const connectOpts = {
        host: '127.0.0.1',
        port,
        getDelayMsForRetry: (i) => {
            retryIndex = i;
            return _getDelayMsForRetry(i, browserName);
        },
    };
    return _connectAsync(connectOpts)
        .then(() => {
        const retry = () => {
            debug('attempting to find CRI target... %o', { retryIndex });
            return findStartPageTarget(connectOpts)
                .catch((err) => {
                retryIndex++;
                const delay = _getDelayMsForRetry(retryIndex, browserName);
                debug('error finding CRI target, maybe retrying %o', { delay, err });
                if (typeof delay === 'undefined') {
                    throw err;
                }
                return bluebird_1.default.delay(delay)
                    .then(retry);
            });
        };
        return retry();
    })
        .catch((err) => {
        debug('failed to connect to CDP %o', { connectOpts, err });
        errors.throw('CDP_COULD_NOT_CONNECT', port, err, browserName);
    });
};
exports.getWsTargetFor = getWsTargetFor;
