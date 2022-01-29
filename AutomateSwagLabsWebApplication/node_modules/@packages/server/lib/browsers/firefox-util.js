"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const marionette_client_1 = (0, tslib_1.__importDefault)(require("marionette-client"));
const message_js_1 = require("marionette-client/lib/marionette/message.js");
const util_1 = (0, tslib_1.__importDefault)(require("util"));
const foxdriver_1 = (0, tslib_1.__importDefault)(require("@benmalka/foxdriver"));
const protocol = (0, tslib_1.__importStar)(require("./protocol"));
const cdp_automation_1 = require("./cdp_automation");
const CriClient = (0, tslib_1.__importStar)(require("./cri-client"));
const errors = require('../errors');
const debug = (0, debug_1.default)('cypress:server:browsers:firefox-util');
let forceGcCc;
let timings = {
    gc: [],
    cc: [],
    collections: [],
};
let driver;
const sendMarionette = (data) => {
    return driver.send(new message_js_1.Command(data));
};
const getTabId = (tab) => {
    return lodash_1.default.get(tab, 'browsingContextID');
};
const getDelayMsForRetry = (i) => {
    if (i < 10) {
        return 100;
    }
    if (i < 18) {
        return 500;
    }
    if (i < 63) {
        return 1000;
    }
    return;
};
const getPrimaryTab = bluebird_1.default.method((browser) => {
    const setPrimaryTab = () => {
        return browser.listTabs()
            .then((tabs) => {
            browser.tabs = tabs;
            return browser.primaryTab = lodash_1.default.first(tabs);
        });
    };
    // on first connection
    if (!browser.primaryTab) {
        return setPrimaryTab();
    }
    // `listTabs` will set some internal state, including marking attached tabs
    // as detached. so use the raw `request` here:
    return browser.request('listTabs')
        .then(({ tabs }) => {
        const firstTab = lodash_1.default.first(tabs);
        // primaryTab has changed, get all tabs and rediscover first tab
        if (getTabId(browser.primaryTab.data) !== getTabId(firstTab)) {
            return setPrimaryTab();
        }
        return browser.primaryTab;
    });
});
const attachToTabMemory = bluebird_1.default.method((tab) => {
    // TODO: figure out why tab.memory is sometimes undefined
    if (!tab.memory)
        return;
    if (tab.memory.isAttached) {
        return;
    }
    return tab.memory.getState()
        .then((state) => {
        if (state === 'attached') {
            return;
        }
        tab.memory.on('garbage-collection', ({ data }) => {
            data.num = timings.collections.length + 1;
            timings.collections.push(data);
            debug('received garbage-collection event %o', data);
        });
        return tab.memory.attach();
    });
});
function setupRemote(remotePort, automation, onError) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const wsUrl = yield protocol.getWsTargetFor(remotePort, 'Firefox');
        const criClient = yield CriClient.create(wsUrl, onError);
        new cdp_automation_1.CdpAutomation(criClient.send, criClient.on, automation);
    });
}
const logGcDetails = () => {
    const reducedTimings = Object.assign(Object.assign({}, timings), { collections: lodash_1.default.map(timings.collections, (event) => {
            return lodash_1.default
                .chain(event)
                .extend({
                duration: lodash_1.default.sumBy(event.collections, (collection) => {
                    return collection.endTimestamp - collection.startTimestamp;
                }),
                spread: lodash_1.default.chain(event.collections).thru((collection) => {
                    const first = lodash_1.default.first(collection);
                    const last = lodash_1.default.last(collection);
                    return last.endTimestamp - first.startTimestamp;
                }).value(),
            })
                .pick('num', 'nonincrementalReason', 'reason', 'gcCycleNumber', 'duration', 'spread')
                .value();
        }) });
    debug('forced GC timings %o', util_1.default.inspect(reducedTimings, {
        breakLength: Infinity,
        maxArrayLength: Infinity,
    }));
    debug('forced GC times %o', {
        gc: reducedTimings.gc.length,
        cc: reducedTimings.cc.length,
        collections: reducedTimings.collections.length,
    });
    debug('forced GC averages %o', {
        gc: lodash_1.default.chain(reducedTimings.gc).sum().divide(reducedTimings.gc.length).value(),
        cc: lodash_1.default.chain(reducedTimings.cc).sum().divide(reducedTimings.cc.length).value(),
        collections: lodash_1.default.chain(reducedTimings.collections).sumBy('duration').divide(reducedTimings.collections.length).value(),
        spread: lodash_1.default.chain(reducedTimings.collections).sumBy('spread').divide(reducedTimings.collections.length).value(),
    });
    debug('forced GC totals %o', {
        gc: lodash_1.default.sum(reducedTimings.gc),
        cc: lodash_1.default.sum(reducedTimings.cc),
        collections: lodash_1.default.sumBy(reducedTimings.collections, 'duration'),
        spread: lodash_1.default.sumBy(reducedTimings.collections, 'spread'),
    });
    // reset all the timings
    timings = {
        gc: [],
        cc: [],
        collections: [],
    };
};
exports.default = {
    log() {
        logGcDetails();
    },
    collectGarbage() {
        return forceGcCc();
    },
    setup({ automation, extensions, onError, url, marionettePort, foxdriverPort, remotePort, }) {
        return bluebird_1.default.all([
            this.setupFoxdriver(foxdriverPort),
            this.setupMarionette(extensions, url, marionettePort),
            remotePort && setupRemote(remotePort, automation, onError),
        ]);
    },
    setupFoxdriver(port) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield protocol._connectAsync({
                host: '127.0.0.1',
                port,
                getDelayMsForRetry,
            });
            const foxdriver = yield foxdriver_1.default.attach('127.0.0.1', port);
            const { browser } = foxdriver;
            browser.on('error', (err) => {
                debug('received error from foxdriver connection, ignoring %o', err);
            });
            forceGcCc = () => {
                let gcDuration;
                let ccDuration;
                const gc = (tab) => {
                    return () => {
                        // TODO: figure out why tab.memory is sometimes undefined
                        if (!tab.memory)
                            return;
                        const start = Date.now();
                        return tab.memory.forceGarbageCollection()
                            .then(() => {
                            gcDuration = Date.now() - start;
                            timings.gc.push(gcDuration);
                        });
                    };
                };
                const cc = (tab) => {
                    return () => {
                        // TODO: figure out why tab.memory is sometimes undefined
                        if (!tab.memory)
                            return;
                        const start = Date.now();
                        return tab.memory.forceCycleCollection()
                            .then(() => {
                            ccDuration = Date.now() - start;
                            timings.cc.push(ccDuration);
                        });
                    };
                };
                debug('forcing GC and CC...');
                return getPrimaryTab(browser)
                    .then((tab) => {
                    return attachToTabMemory(tab)
                        .then(gc(tab))
                        .then(cc(tab));
                })
                    .then(() => {
                    debug('forced GC and CC completed %o', { ccDuration, gcDuration });
                })
                    .tapCatch((err) => {
                    debug('firefox RDP error while forcing GC and CC %o', err);
                });
            };
        });
    },
    setupMarionette(extensions, url, port) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield protocol._connectAsync({
                host: '127.0.0.1',
                port,
                getDelayMsForRetry,
            });
            driver = new marionette_client_1.default.Drivers.Promises({
                port,
                tries: 1, // marionette-client has its own retry logic which we want to avoid
            });
            debug('firefox: navigating page with webdriver');
            const onError = (from, reject) => {
                if (!reject) {
                    reject = (err) => {
                        throw err;
                    };
                }
                return (err) => {
                    debug('error in marionette %o', { from, err });
                    reject(errors.get('FIREFOX_MARIONETTE_FAILURE', from, err));
                };
            };
            yield driver.connect()
                .catch(onError('connection'));
            yield new bluebird_1.default((resolve, reject) => {
                const _onError = (from) => {
                    return onError(from, reject);
                };
                const { tcp } = driver;
                tcp.socket.on('error', _onError('Socket'));
                tcp.client.on('error', _onError('CommandStream'));
                sendMarionette({
                    name: 'WebDriver:NewSession',
                    parameters: { acceptInsecureCerts: true },
                }).then(() => {
                    return bluebird_1.default.all(lodash_1.default.map(extensions, (path) => {
                        return sendMarionette({
                            name: 'Addon:Install',
                            parameters: { path, temporary: true },
                        });
                    }));
                })
                    .then(() => {
                    return sendMarionette({
                        name: 'WebDriver:Navigate',
                        parameters: { url },
                    });
                })
                    .then(resolve)
                    .catch(_onError('commands'));
            });
            // even though Marionette is not used past this point, we have to keep the session open
            // or else `acceptInsecureCerts` will cease to apply and SSL validation prompts will appear.
        });
    },
    windowFocus() {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            // in order to utilize focusmanager.testingmode and trick browser into being in focus even when not focused
            // this is critical for headless mode since otherwise the browser never gains focus
            return sendMarionette({
                name: 'WebDriver:ExecuteScript',
                parameters: {
                    'args': [],
                    'script': `return (() => {
        top.focus()
      }).apply(null, arguments)\
      `,
                },
            });
        });
    },
};
