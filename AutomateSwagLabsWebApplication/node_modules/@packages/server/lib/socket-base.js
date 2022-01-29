"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketBase = void 0;
const tslib_1 = require("tslib");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const net_stubbing_1 = require("../../net-stubbing");
const socketIo = (0, tslib_1.__importStar)(require("../../socket"));
const firefox_util_1 = (0, tslib_1.__importDefault)(require("./browsers/firefox-util"));
const errors_1 = (0, tslib_1.__importDefault)(require("./errors"));
const exec_1 = (0, tslib_1.__importDefault)(require("./exec"));
const files_1 = (0, tslib_1.__importDefault)(require("./files"));
const fixture_1 = (0, tslib_1.__importDefault)(require("./fixture"));
const task_1 = (0, tslib_1.__importDefault)(require("./task"));
const class_helpers_1 = require("./util/class-helpers");
const editors_1 = require("./util/editors");
const file_opener_1 = require("./util/file-opener");
const open_1 = (0, tslib_1.__importDefault)(require("./util/open"));
const session = (0, tslib_1.__importStar)(require("./session"));
const runnerEvents = [
    'reporter:restart:test:run',
    'runnables:ready',
    'run:start',
    'test:before:run:async',
    'reporter:log:add',
    'reporter:log:state:changed',
    'paused',
    'test:after:hooks',
    'run:end',
];
const reporterEvents = [
    // "go:to:file"
    'runner:restart',
    'runner:abort',
    'runner:console:log',
    'runner:console:error',
    'runner:show:snapshot',
    'runner:hide:snapshot',
    'reporter:restarted',
];
const debug = (0, debug_1.default)('cypress:server:socket-base');
const retry = (fn) => {
    return bluebird_1.default.delay(25).then(fn);
};
class SocketBase {
    constructor(config) {
        this.ensureProp = class_helpers_1.ensureProp;
        this.ended = false;
        this.testsDir = null;
    }
    get io() {
        return this.ensureProp(this._io, 'startListening');
    }
    toReporter(event, data) {
        return this.io && this.io.to('reporter').emit(event, data);
    }
    toRunner(event, data) {
        return this.io && this.io.to('runner').emit(event, data);
    }
    isSocketConnected(socket) {
        return socket && socket.connected;
    }
    toDriver(event, ...data) {
        return this.io && this.io.emit(event, ...data);
    }
    onAutomation(socket, message, data, id) {
        // instead of throwing immediately here perhaps we need
        // to make this more resilient by automatically retrying
        // up to 1 second in the case where our automation room
        // is empty. that would give padding for reconnections
        // to automatically happen.
        // for instance when socket.io detects a disconnect
        // does it immediately remove the member from the room?
        // YES it does per http://socket.io/docs/rooms-and-namespaces/#disconnection
        if (this.isSocketConnected(socket)) {
            return socket.emit('automation:request', id, message, data);
        }
        throw new Error(`Could not process '${message}'. No automation clients connected.`);
    }
    createIo(server, path, cookie) {
        return new socketIo.SocketIOServer(server, {
            path,
            cookie: {
                name: cookie,
            },
            destroyUpgrade: false,
            serveClient: false,
            transports: ['websocket'],
        });
    }
    startListening(server, automation, config, options, callbacks) {
        let existingState = null;
        lodash_1.default.defaults(options, {
            socketId: null,
            onResetServerState() { },
            onTestsReceivedAndMaybeRecord() { },
            onMocha() { },
            onConnect() { },
            onRequest() { },
            onResolveUrl() { },
            onFocusTests() { },
            onSpecChanged() { },
            onChromiumRun() { },
            onReloadBrowser() { },
            checkForAppErrors() { },
            onSavedStateChanged() { },
            onTestFileChange() { },
            onCaptureVideoFrames() { },
        });
        let automationClient;
        const { socketIoRoute, socketIoCookie } = config;
        this._io = this.createIo(server, socketIoRoute, socketIoCookie);
        automation.use({
            onPush: (message, data) => {
                return this.io.emit('automation:push:message', message, data);
            },
        });
        const resetRenderedHTMLOrigins = () => {
            const origins = options.getRenderedHTMLOrigins();
            Object.keys(origins).forEach((key) => delete origins[key]);
        };
        const onAutomationClientRequestCallback = (message, data, id) => {
            return this.onAutomation(automationClient, message, data, id);
        };
        const automationRequest = (message, data) => {
            return automation.request(message, data, onAutomationClientRequestCallback);
        };
        const getFixture = (path, opts) => fixture_1.default.get(config.fixturesFolder, path, opts);
        this.io.on('connection', (socket) => {
            var _a, _b;
            debug('socket connected');
            // cache the headers so we can access
            // them at any time
            const headers = (_b = (_a = socket.request) === null || _a === void 0 ? void 0 : _a.headers) !== null && _b !== void 0 ? _b : {};
            socket.on('automation:client:connected', () => {
                if (automationClient === socket) {
                    return;
                }
                automationClient = socket;
                debug('automation:client connected');
                // if our automation disconnects then we're
                // in trouble and should probably bomb everything
                automationClient.on('disconnect', () => {
                    // if we've stopped then don't do anything
                    if (this.ended) {
                        return;
                    }
                    // if we are in headless mode then log out an error and maybe exit with process.exit(1)?
                    return bluebird_1.default.delay(2000)
                        .then(() => {
                        // bail if we've swapped to a new automationClient
                        if (automationClient !== socket) {
                            return;
                        }
                        // give ourselves about 2000ms to reconnect
                        // and if we're connected its all good
                        if (automationClient.connected) {
                            return;
                        }
                        // TODO: if all of our clients have also disconnected
                        // then don't warn anything
                        errors_1.default.warning('AUTOMATION_SERVER_DISCONNECTED');
                        // TODO: no longer emit this, just close the browser and display message in reporter
                        return this.io.emit('automation:disconnected');
                    });
                });
                socket.on('automation:push:request', (message, data, cb) => {
                    automation.push(message, data);
                    // just immediately callback because there
                    // is not really an 'ack' here
                    if (cb) {
                        return cb();
                    }
                });
                socket.on('automation:response', automation.response);
            });
            socket.on('automation:request', (message, data, cb) => {
                debug('automation:request %s %o', message, data);
                return automationRequest(message, data)
                    .then((resp) => {
                    return cb({ response: resp });
                }).catch((err) => {
                    return cb({ error: errors_1.default.clone(err) });
                });
            });
            socket.on('reporter:connected', () => {
                if (socket.inReporterRoom) {
                    return;
                }
                socket.inReporterRoom = true;
                return socket.join('reporter');
            });
            // TODO: what to do about reporter disconnections?
            socket.on('runner:connected', () => {
                if (socket.inRunnerRoom) {
                    return;
                }
                socket.inRunnerRoom = true;
                return socket.join('runner');
            });
            // TODO: what to do about runner disconnections?
            socket.on('spec:changed', (spec) => {
                return options.onSpecChanged(spec);
            });
            socket.on('app:connect', (socketId) => {
                return options.onConnect(socketId, socket);
            });
            socket.on('set:runnables:and:maybe:record:tests', (runnables, cb) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                return options.onTestsReceivedAndMaybeRecord(runnables, cb);
            }));
            socket.on('mocha', (...args) => {
                return options.onMocha.apply(options, args);
            });
            socket.on('open:finder', (p, cb = function () { }) => {
                return open_1.default.opn(p)
                    .then(() => {
                    return cb();
                });
            });
            socket.on('recorder:frame', (data) => {
                return options.onCaptureVideoFrames(data);
            });
            socket.on('reload:browser', (url, browser) => {
                return options.onReloadBrowser(url, browser);
            });
            socket.on('focus:tests', () => {
                return options.onFocusTests();
            });
            socket.on('is:automation:client:connected', (data, cb) => {
                const isConnected = () => {
                    return automationRequest('is:automation:client:connected', data);
                };
                const tryConnected = () => {
                    return bluebird_1.default
                        .try(isConnected)
                        .catch(() => {
                        return retry(tryConnected);
                    });
                };
                // retry for up to data.timeout
                // or 1 second
                return bluebird_1.default
                    .try(tryConnected)
                    .timeout(data.timeout != null ? data.timeout : 1000)
                    .then(() => {
                    return cb(true);
                }).catch(bluebird_1.default.TimeoutError, (_err) => {
                    return cb(false);
                });
            });
            socket.on('backend:request', (eventName, ...args) => {
                // cb is always the last argument
                const cb = args.pop();
                debug('backend:request %o', { eventName, args });
                const backendRequest = () => {
                    switch (eventName) {
                        case 'preserve:run:state':
                            existingState = args[0];
                            return null;
                        case 'resolve:url': {
                            const [url, resolveOpts] = args;
                            return options.onResolveUrl(url, headers, automationRequest, resolveOpts);
                        }
                        case 'http:request':
                            return options.onRequest(headers, automationRequest, args[0]);
                        case 'reset:server:state':
                            return options.onResetServerState();
                        case 'log:memory:pressure':
                            return firefox_util_1.default.log();
                        case 'firefox:force:gc':
                            return firefox_util_1.default.collectGarbage();
                        case 'firefox:window:focus':
                            return firefox_util_1.default.windowFocus();
                        case 'get:fixture':
                            return getFixture(args[0], args[1]);
                        case 'read:file':
                            return files_1.default.readFile(config.projectRoot, args[0], args[1]);
                        case 'write:file':
                            return files_1.default.writeFile(config.projectRoot, args[0], args[1], args[2]);
                        case 'net':
                            return (0, net_stubbing_1.onNetStubbingEvent)({
                                eventName: args[0],
                                frame: args[1],
                                state: options.netStubbingState,
                                socket: this,
                                getFixture,
                                args,
                            });
                        case 'exec':
                            return exec_1.default.run(config.projectRoot, args[0]);
                        case 'task':
                            return task_1.default.run(config.pluginsFile, args[0]);
                        case 'save:session':
                            return session.saveSession(args[0]);
                        case 'clear:session':
                            return session.clearSessions();
                        case 'get:session':
                            return session.getSession(args[0]);
                        case 'reset:session:state':
                            session.clearSessions();
                            resetRenderedHTMLOrigins();
                            return;
                        case 'get:rendered:html:origins':
                            return options.getRenderedHTMLOrigins();
                        case 'reset:rendered:html:origins': {
                            resetRenderedHTMLOrigins();
                            return;
                        }
                        default:
                            throw new Error(`You requested a backend event we cannot handle: ${eventName}`);
                    }
                };
                return bluebird_1.default.try(backendRequest)
                    .then((resp) => {
                    return cb({ response: resp });
                }).catch((err) => {
                    return cb({ error: errors_1.default.clone(err) });
                });
            });
            socket.on('get:existing:run:state', (cb) => {
                const s = existingState;
                if (s) {
                    existingState = null;
                    return cb(s);
                }
                return cb();
            });
            socket.on('save:app:state', (state, cb) => {
                options.onSavedStateChanged(state);
                // we only use the 'ack' here in tests
                if (cb) {
                    return cb();
                }
            });
            socket.on('external:open', (url) => {
                debug('received external:open %o', { url });
                // using this instead of require('electron').shell.openExternal
                // because CT runner does not spawn an electron shell
                // if we eventually decide to exclusively launch CT from
                // the desktop-gui electron shell, we should update this to use
                // electron.shell.openExternal.
                // cross platform way to open a new tab in default browser, or a new browser window
                // if one does not already exist for the user's default browser.
                const start = (process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open');
                return require('child_process').exec(`${start} ${url}`);
            });
            socket.on('get:user:editor', (cb) => {
                (0, editors_1.getUserEditor)(false)
                    .then(cb);
            });
            socket.on('set:user:editor', (editor) => {
                (0, editors_1.setUserEditor)(editor);
            });
            socket.on('open:file', (fileDetails) => {
                (0, file_opener_1.openFile)(fileDetails);
            });
            reporterEvents.forEach((event) => {
                socket.on(event, (data) => {
                    this.toRunner(event, data);
                });
            });
            runnerEvents.forEach((event) => {
                socket.on(event, (data) => {
                    this.toReporter(event, data);
                });
            });
            callbacks.onSocketConnection(socket);
        });
        return this.io;
    }
    end() {
        this.ended = true;
        // TODO: we need an 'ack' from this end
        // event from the other side
        return this.io.emit('tests:finished');
    }
    changeToUrl(url) {
        return this.toRunner('change:to:url', url);
    }
    close() {
        return this.io.close();
    }
    sendSpecList(specs, testingType) {
        this.toRunner('specs:changed', { specs, testingType });
    }
}
exports.SocketBase = SocketBase;
