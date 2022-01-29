"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.create = exports.chromeRemoteInterface = void 0;
const tslib_1 = require("tslib");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const chromeRemoteInterface = require('chrome-remote-interface');
exports.chromeRemoteInterface = chromeRemoteInterface;
const errors = require('../errors');
const debug = (0, debug_1.default)('cypress:server:browsers:cri-client');
// debug using cypress-verbose:server:browsers:cri-client:send:*
const debugVerboseSend = (0, debug_1.default)('cypress-verbose:server:browsers:cri-client:send:[-->]');
// debug using cypress-verbose:server:browsers:cri-client:recv:*
const debugVerboseReceive = (0, debug_1.default)('cypress-verbose:server:browsers:cri-client:recv:[<--]');
const WEBSOCKET_NOT_OPEN_RE = /^WebSocket is (?:not open|already in CLOSING or CLOSED state)/;
const isVersionGte = (a, b) => {
    return a.major > b.major || (a.major === b.major && a.minor >= b.minor);
};
const getMajorMinorVersion = (version) => {
    const [major, minor] = version.split('.', 2).map(Number);
    return { major, minor };
};
const maybeDebugCdpMessages = (cri) => {
    if (debugVerboseReceive.enabled) {
        cri._ws.on('message', (data) => {
            data = lodash_1.default
                .chain(JSON.parse(data))
                .tap((data) => {
                ([
                    'params.data',
                    'result.data', // screenshot data
                ]).forEach((truncatablePath) => {
                    const str = lodash_1.default.get(data, truncatablePath);
                    if (!lodash_1.default.isString(str)) {
                        return;
                    }
                    lodash_1.default.set(data, truncatablePath, lodash_1.default.truncate(str, {
                        length: 100,
                        omission: `... [truncated string of total bytes: ${str.length}]`,
                    }));
                });
                return data;
            })
                .value();
            debugVerboseReceive('received CDP message %o', data);
        });
    }
    if (debugVerboseSend.enabled) {
        const send = cri._ws.send;
        cri._ws.send = (data, callback) => {
            debugVerboseSend('sending CDP command %o', JSON.parse(data));
            return send.call(cri._ws, data, callback);
        };
    }
};
exports.create = bluebird_1.default.method((target, onAsynchronousError) => {
    const subscriptions = [];
    let enqueuedCommands = [];
    let closed = false; // has the user called .close on this?
    let connected = false; // is this currently connected to CDP?
    let cri;
    let client;
    const reconnect = () => {
        debug('disconnected, attempting to reconnect... %o', { closed });
        connected = false;
        if (closed) {
            return;
        }
        return connect()
            .then(() => {
            debug('restoring subscriptions + running queued commands... %o', { subscriptions, enqueuedCommands });
            subscriptions.forEach((sub) => {
                cri.on(sub.eventName, sub.cb);
            });
            enqueuedCommands.forEach((cmd) => {
                cri.send(cmd.command, cmd.params)
                    .then(cmd.p.resolve, cmd.p.reject);
            });
            enqueuedCommands = [];
        })
            .catch((err) => {
            onAsynchronousError(errors.get('CDP_COULD_NOT_RECONNECT', err));
        });
    };
    const connect = () => {
        cri === null || cri === void 0 ? void 0 : cri.close();
        debug('connecting %o', { target });
        return chromeRemoteInterface({
            target,
            local: true,
        })
            .then((newCri) => {
            cri = newCri;
            connected = true;
            maybeDebugCdpMessages(cri);
            cri.send = bluebird_1.default.promisify(cri.send, { context: cri });
            // @see https://github.com/cyrus-and/chrome-remote-interface/issues/72
            cri._notifier.on('disconnect', reconnect);
        });
    };
    return connect()
        .then(() => {
        const ensureMinimumProtocolVersion = (protocolVersion) => {
            return getProtocolVersion()
                .then((actual) => {
                const minimum = getMajorMinorVersion(protocolVersion);
                if (!isVersionGte(actual, minimum)) {
                    errors.throw('CDP_VERSION_TOO_OLD', protocolVersion, actual);
                }
            });
        };
        const getProtocolVersion = lodash_1.default.memoize(() => {
            return client.send('Browser.getVersion')
                // could be any version <= 1.2
                .catchReturn({ protocolVersion: '0.0' })
                .then(({ protocolVersion }) => {
                return getMajorMinorVersion(protocolVersion);
            });
        });
        client = {
            ensureMinimumProtocolVersion,
            getProtocolVersion,
            send: bluebird_1.default.method((command, params) => {
                const enqueue = () => {
                    return new bluebird_1.default((resolve, reject) => {
                        enqueuedCommands.push({ command, params, p: { resolve, reject } });
                    });
                };
                if (connected) {
                    return cri.send(command, params)
                        .catch((err) => {
                        if (!WEBSOCKET_NOT_OPEN_RE.test(err.message)) {
                            throw err;
                        }
                        debug('encountered closed websocket on send %o', { command, params, err });
                        const p = enqueue();
                        reconnect();
                        return p;
                    });
                }
                return enqueue();
            }),
            on(eventName, cb) {
                subscriptions.push({ eventName, cb });
                debug('registering CDP on event %o', { eventName });
                return cri.on(eventName, cb);
            },
            close() {
                closed = true;
                return cri.close();
            },
        };
        return client;
    });
});
