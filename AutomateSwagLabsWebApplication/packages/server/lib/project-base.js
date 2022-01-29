"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectBase = void 0;
const tslib_1 = require("tslib");
const check_more_types_1 = (0, tslib_1.__importDefault)(require("check-more-types"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const events_1 = (0, tslib_1.__importDefault)(require("events"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const browsers_1 = (0, tslib_1.__importDefault)(require("./browsers"));
const root_1 = (0, tslib_1.__importDefault)(require("../../root"));
const config_1 = require("../../config");
const server_ct_1 = require("./server-ct");
const socket_ct_1 = require("./socket-ct");
const socket_e2e_1 = require("./socket-e2e");
const api_1 = (0, tslib_1.__importDefault)(require("./api"));
const automation_1 = require("./automation");
const config = (0, tslib_1.__importStar)(require("./config"));
const cwd_1 = (0, tslib_1.__importDefault)(require("./cwd"));
const errors_1 = (0, tslib_1.__importDefault)(require("./errors"));
const reporter_1 = (0, tslib_1.__importDefault)(require("./reporter"));
const run_events_1 = (0, tslib_1.__importDefault)(require("./plugins/run_events"));
const saved_state_1 = (0, tslib_1.__importDefault)(require("./saved_state"));
const scaffold_1 = (0, tslib_1.__importDefault)(require("./scaffold"));
const server_e2e_1 = require("./server-e2e");
const system_1 = (0, tslib_1.__importDefault)(require("./util/system"));
const user_1 = (0, tslib_1.__importDefault)(require("./user"));
const class_helpers_1 = require("./util/class-helpers");
const fs_1 = require("./util/fs");
const settings = (0, tslib_1.__importStar)(require("./util/settings"));
const plugins_1 = (0, tslib_1.__importDefault)(require("./plugins"));
const specs_1 = (0, tslib_1.__importDefault)(require("./util/specs"));
const watchers_1 = (0, tslib_1.__importDefault)(require("./watchers"));
const dev_server_1 = (0, tslib_1.__importDefault)(require("./plugins/dev-server"));
const preprocessor_1 = (0, tslib_1.__importDefault)(require("./plugins/preprocessor"));
const specs_store_1 = require("./specs-store");
const project_utils_1 = require("./project_utils");
const localCwd = (0, cwd_1.default)();
const debug = (0, debug_1.default)('cypress:server:project');
const debugScaffold = (0, debug_1.default)('cypress:server:scaffold');
class ProjectBase extends events_1.default {
    constructor({ projectRoot, testingType, options, }) {
        super();
        this._recordTests = null;
        this._isServerOpen = false;
        this.ensureProp = class_helpers_1.ensureProp;
        this.shouldCorrelatePreRequests = () => {
            if (!this.browser) {
                return false;
            }
            const { family, majorVersion } = this.browser;
            return family === 'chromium' || (family === 'firefox' && majorVersion >= 86);
        };
        if (!projectRoot) {
            throw new Error('Instantiating lib/project requires a projectRoot!');
        }
        if (!check_more_types_1.default.unemptyString(projectRoot)) {
            throw new Error(`Expected project root path, not ${projectRoot}`);
        }
        this.testingType = testingType;
        this.projectRoot = path_1.default.resolve(projectRoot);
        this.watchers = new watchers_1.default();
        this.spec = null;
        this.browser = null;
        debug('Project created %o', {
            testingType: this.testingType,
            projectRoot: this.projectRoot,
        });
        this.options = Object.assign({ report: false, onFocusTests() { },
            onError() { },
            onWarning() { }, onSettingsChanged: false }, options);
    }
    setOnTestsReceived(fn) {
        this._recordTests = fn;
    }
    get server() {
        return this.ensureProp(this._server, 'open');
    }
    get automation() {
        return this.ensureProp(this._automation, 'open');
    }
    get cfg() {
        return this._cfg;
    }
    get state() {
        return this.cfg.state;
    }
    injectCtSpecificConfig(cfg) {
        var _a, _b;
        cfg.resolved.testingType = { value: 'component' };
        // This value is normally set up in the `packages/server/lib/plugins/index.js#110`
        // But if we don't return it in the plugins function, it never gets set
        // Since there is no chance that it will have any other value here, we set it to "component"
        // This allows users to not return config in the `cypress/plugins/index.js` file
        // https://github.com/cypress-io/cypress/issues/16860
        const rawJson = cfg.rawJson;
        return Object.assign(Object.assign({}, cfg), { componentTesting: true, viewportHeight: (_a = rawJson.viewportHeight) !== null && _a !== void 0 ? _a : 500, viewportWidth: (_b = rawJson.viewportWidth) !== null && _b !== void 0 ? _b : 500 });
    }
    createServer(testingType) {
        return testingType === 'e2e'
            ? new server_e2e_1.ServerE2E()
            : new server_ct_1.ServerCt();
    }
    open() {
        var _a;
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            debug('opening project instance %s', this.projectRoot);
            debug('project open options %o', this.options);
            let cfg = this.getConfig();
            process.chdir(this.projectRoot);
            // TODO: we currently always scaffold the plugins file
            // even when headlessly or else it will cause an error when
            // we try to load it and it's not there. We must do this here
            // else initialing the plugins will instantly fail.
            if (cfg.pluginsFile) {
                debug('scaffolding with plugins file %s', cfg.pluginsFile);
                yield scaffold_1.default.plugins(path_1.default.dirname(cfg.pluginsFile), cfg);
            }
            this._server = this.createServer(this.testingType);
            cfg = yield this.initializePlugins(cfg, this.options);
            const { specsStore, startSpecWatcher, ctDevServerPort, } = yield this.initializeSpecStore(cfg);
            if (this.testingType === 'component') {
                cfg.baseUrl = `http://localhost:${ctDevServerPort}`;
            }
            const [port, warning] = yield this._server.open(cfg, {
                getCurrentBrowser: () => this.browser,
                getSpec: () => this.spec,
                exit: (_a = this.options.args) === null || _a === void 0 ? void 0 : _a.exit,
                onError: this.options.onError,
                onWarning: this.options.onWarning,
                shouldCorrelatePreRequests: this.shouldCorrelatePreRequests,
                testingType: this.testingType,
                SocketCtor: this.testingType === 'e2e' ? socket_e2e_1.SocketE2E : socket_ct_1.SocketCt,
                specsStore,
            });
            this._isServerOpen = true;
            // if we didnt have a cfg.port
            // then get the port once we
            // open the server
            if (!cfg.port) {
                cfg.port = port;
                // and set all the urls again
                lodash_1.default.extend(cfg, config.setUrls(cfg));
            }
            cfg.proxyServer = cfg.proxyUrl;
            // store the cfg from
            // opening the server
            this._cfg = cfg;
            debug('project config: %o', lodash_1.default.omit(cfg, 'resolved'));
            if (warning) {
                this.options.onWarning(warning);
            }
            // save the last time they opened the project
            // along with the first time they opened it
            const now = Date.now();
            const stateToSave = {
                lastOpened: now,
            };
            if (!cfg.state || !cfg.state.firstOpened) {
                stateToSave.firstOpened = now;
            }
            this.watchSettings({
                onSettingsChanged: this.options.onSettingsChanged,
                projectRoot: this.projectRoot,
                configFile: this.options.configFile,
            });
            this.startWebsockets({
                onReloadBrowser: this.options.onReloadBrowser,
                onFocusTests: this.options.onFocusTests,
                onSpecChanged: this.options.onSpecChanged,
            }, {
                socketIoCookie: cfg.socketIoCookie,
                namespace: cfg.namespace,
                screenshotsFolder: cfg.screenshotsFolder,
                report: cfg.report,
                reporter: cfg.reporter,
                reporterOptions: cfg.reporterOptions,
                projectRoot: this.projectRoot,
            });
            yield Promise.all([
                this.scaffold(cfg),
                this.saveState(stateToSave),
            ]);
            yield Promise.all([
                (0, project_utils_1.checkSupportFile)({ configFile: cfg.configFile, supportFile: cfg.supportFile }),
                this.watchPluginsFile(cfg, this.options),
            ]);
            if (cfg.isTextTerminal) {
                return;
            }
            // start watching specs
            // whenever a spec file is added or removed, we notify the
            // <SpecList>
            // This is only used for CT right now by general users.
            // It is is used with E2E if the CypressInternal_UseInlineSpecList flag is true.
            startSpecWatcher();
            if (!cfg.experimentalInteractiveRunEvents) {
                return;
            }
            const sys = yield system_1.default.info();
            const beforeRunDetails = {
                config: cfg,
                cypressVersion: root_1.default.version,
                system: lodash_1.default.pick(sys, 'osName', 'osVersion'),
            };
            return run_events_1.default.execute('before:run', cfg, beforeRunDetails);
        });
    }
    getRuns() {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const [projectId, authToken] = yield Promise.all([
                this.getProjectId(),
                user_1.default.ensureAuthToken(),
            ]);
            return api_1.default.getProjectRuns(projectId, authToken);
        });
    }
    reset() {
        debug('resetting project instance %s', this.projectRoot);
        this.spec = null;
        this.browser = null;
        if (this._automation) {
            this._automation.reset();
        }
        if (this._server) {
            return this._server.reset();
        }
        return;
    }
    close() {
        var _a, _b, _c;
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            debug('closing project instance %s', this.projectRoot);
            this.spec = null;
            this.browser = null;
            if (!this._isServerOpen) {
                return;
            }
            const closePreprocessor = (_a = (this.testingType === 'e2e' && preprocessor_1.default.close)) !== null && _a !== void 0 ? _a : undefined;
            yield Promise.all([
                (_b = this.server) === null || _b === void 0 ? void 0 : _b.close(),
                (_c = this.watchers) === null || _c === void 0 ? void 0 : _c.close(),
                closePreprocessor === null || closePreprocessor === void 0 ? void 0 : closePreprocessor(),
            ]);
            this._isServerOpen = false;
            process.chdir(localCwd);
            const config = this.getConfig();
            if (config.isTextTerminal || !config.experimentalInteractiveRunEvents)
                return;
            return run_events_1.default.execute('after:run', config);
        });
    }
    _onError(err, options) {
        debug('got plugins error', err.stack);
        browsers_1.default.close();
        options.onError(err);
    }
    initializeSpecStore(updatedConfig) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const allSpecs = yield specs_1.default.findSpecs({
                projectRoot: updatedConfig.projectRoot,
                fixturesFolder: updatedConfig.fixturesFolder,
                supportFile: updatedConfig.supportFile,
                testFiles: updatedConfig.testFiles,
                ignoreTestFiles: updatedConfig.ignoreTestFiles,
                componentFolder: updatedConfig.componentFolder,
                integrationFolder: updatedConfig.integrationFolder,
            });
            const specs = allSpecs.filter((spec) => {
                if (this.testingType === 'component') {
                    return spec.specType === 'component';
                }
                if (this.testingType === 'e2e') {
                    return spec.specType === 'integration';
                }
                throw Error(`Cannot return specType for testingType: ${this.testingType}`);
            });
            return this.initSpecStore({ specs, config: updatedConfig });
        });
    }
    initializePlugins(cfg, options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            // only init plugins with the
            // allowed config values to
            // prevent tampering with the
            // internals and breaking cypress
            const allowedCfg = (0, config_1.allowed)(cfg);
            const modifiedCfg = yield plugins_1.default.init(allowedCfg, {
                projectRoot: this.projectRoot,
                configFile: settings.pathToConfigFile(this.projectRoot, options),
                testingType: options.testingType,
                onError: (err) => this._onError(err, options),
                onWarning: options.onWarning,
            });
            debug('plugin config yielded: %o', modifiedCfg);
            return config.updateWithPluginValues(cfg, modifiedCfg);
        });
    }
    startCtDevServer(specs, config) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            // CT uses a dev-server to build the bundle.
            // We start the dev server here.
            const devServerOptions = yield dev_server_1.default.start({ specs, config });
            if (!devServerOptions) {
                throw new Error([
                    'It looks like nothing was returned from on(\'dev-server:start\', {here}).',
                    'Make sure that the dev-server:start function returns an object.',
                    'For example: on("dev-server:start", () => startWebpackDevServer({ webpackConfig }))',
                ].join('\n'));
            }
            return { port: devServerOptions.port };
        });
    }
    initSpecStore({ specs, config, }) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const specsStore = new specs_store_1.SpecsStore(config, this.testingType);
            const startSpecWatcher = () => {
                return specsStore.watch({
                    onSpecsChanged: (specs) => {
                        // both e2e and CT watch the specs and send them to the
                        // client to be shown in the SpecList.
                        this.server.sendSpecList(specs, this.testingType);
                        if (this.testingType === 'component') {
                            // ct uses the dev-server to build and bundle the speces.
                            // send new files to dev server
                            dev_server_1.default.updateSpecs(specs);
                        }
                    },
                });
            };
            let ctDevServerPort;
            if (this.testingType === 'component') {
                const { port } = yield this.startCtDevServer(specs, config);
                ctDevServerPort = port;
            }
            return specsStore.storeSpecFiles()
                .return({
                specsStore,
                ctDevServerPort,
                startSpecWatcher,
            });
        });
    }
    watchPluginsFile(cfg, options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            debug(`attempt watch plugins file: ${cfg.pluginsFile}`);
            if (!cfg.pluginsFile || options.isTextTerminal) {
                return Promise.resolve();
            }
            const found = yield fs_1.fs.pathExists(cfg.pluginsFile);
            debug(`plugins file found? ${found}`);
            // ignore if not found. plugins#init will throw the right error
            if (!found) {
                return;
            }
            debug('watch plugins file');
            return this.watchers.watchTree(cfg.pluginsFile, {
                onChange: () => {
                    // TODO: completely re-open project instead?
                    debug('plugins file changed');
                    // re-init plugins after a change
                    this.initializePlugins(cfg, options)
                        .catch((err) => {
                        options.onError(err);
                    });
                },
            });
        });
    }
    watchSettings({ onSettingsChanged, configFile, projectRoot, }) {
        // bail if we havent been told to
        // watch anything (like in run mode)
        if (!onSettingsChanged) {
            return;
        }
        debug('watch settings files');
        const obj = {
            onChange: () => {
                // dont fire change events if we generated
                // a project id less than 1 second ago
                if (this.generatedProjectIdTimestamp &&
                    ((Date.now() - this.generatedProjectIdTimestamp) < 1000)) {
                    return;
                }
                // call our callback function
                // when settings change!
                onSettingsChanged();
            },
        };
        if (configFile !== false) {
            this.watchers.watchTree(settings.pathToConfigFile(projectRoot, { configFile }), obj);
        }
        return this.watchers.watch(settings.pathToCypressEnvJson(projectRoot), obj);
    }
    initializeReporter({ report, reporter, projectRoot, reporterOptions, }) {
        if (!report) {
            return;
        }
        try {
            reporter_1.default.loadReporter(reporter, projectRoot);
        }
        catch (err) {
            const paths = reporter_1.default.getSearchPathsForReporter(reporter, projectRoot);
            // only include the message if this is the standard MODULE_NOT_FOUND
            // else include the whole stack
            const errorMsg = err.code === 'MODULE_NOT_FOUND' ? err.message : err.stack;
            errors_1.default.throw('INVALID_REPORTER_NAME', {
                paths,
                error: errorMsg,
                name: reporter,
            });
        }
        return reporter_1.default.create(reporter, reporterOptions, projectRoot);
    }
    startWebsockets(options, { socketIoCookie, namespace, screenshotsFolder, report, reporter, reporterOptions, projectRoot }) {
        // if we've passed down reporter
        // then record these via mocha reporter
        const reporterInstance = this.initializeReporter({
            report,
            reporter,
            reporterOptions,
            projectRoot,
        });
        const onBrowserPreRequest = (browserPreRequest) => {
            this.server.addBrowserPreRequest(browserPreRequest);
        };
        const onRequestEvent = (eventName, data) => {
            this.server.emitRequestEvent(eventName, data);
        };
        this._automation = new automation_1.Automation(namespace, socketIoCookie, screenshotsFolder, onBrowserPreRequest, onRequestEvent);
        this.server.startWebsockets(this.automation, this.cfg, {
            onReloadBrowser: options.onReloadBrowser,
            onFocusTests: options.onFocusTests,
            onSpecChanged: options.onSpecChanged,
            onSavedStateChanged: (state) => this.saveState(state),
            onCaptureVideoFrames: (data) => {
                // TODO: move this to browser automation middleware
                this.emit('capture:video:frames', data);
            },
            onConnect: (id) => {
                debug('socket:connected');
                this.emit('socket:connected', id);
            },
            onTestsReceivedAndMaybeRecord: (runnables, cb) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                var _a;
                debug('received runnables %o', runnables);
                if (reporterInstance) {
                    reporterInstance.setRunnables(runnables);
                }
                if (this._recordTests) {
                    yield ((_a = this._recordTests) === null || _a === void 0 ? void 0 : _a.call(this, runnables, cb));
                    this._recordTests = null;
                    return;
                }
                cb();
            }),
            onMocha: (event, runnable) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
                debug('onMocha', event);
                // bail if we dont have a
                // reporter instance
                if (!reporterInstance) {
                    return;
                }
                reporterInstance.emit(event, runnable);
                if (event === 'end') {
                    const [stats = {}] = yield Promise.all([
                        (reporterInstance != null ? reporterInstance.end() : undefined),
                        this.server.end(),
                    ]);
                    this.emit('end', stats);
                }
                return;
            }),
        });
    }
    changeToUrl(url) {
        this.server.changeToUrl(url);
    }
    setCurrentSpecAndBrowser(spec, browser) {
        this.spec = spec;
        this.browser = browser;
    }
    setBrowsers(browsers = []) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            debug('getting config before setting browsers %o', browsers);
            const cfg = this.getConfig();
            debug('setting config browsers to %o', browsers);
            cfg.browsers = browsers;
        });
    }
    getAutomation() {
        return this.automation;
    }
    initializeConfig() {
        var _a, _b;
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            // set default for "configFile" if undefined
            if (this.options.configFile === undefined
                || this.options.configFile === null) {
                this.options.configFile = yield (0, project_utils_1.getDefaultConfigFilePath)(this.projectRoot, !((_a = this.options.args) === null || _a === void 0 ? void 0 : _a.runProject));
            }
            let theCfg = yield config.get(this.projectRoot, this.options);
            if (theCfg.browsers) {
                theCfg.browsers = (_b = theCfg.browsers) === null || _b === void 0 ? void 0 : _b.map((browser) => {
                    if (browser.family === 'chromium' || theCfg.chromeWebSecurity) {
                        return browser;
                    }
                    return Object.assign(Object.assign({}, browser), { warning: browser.warning || errors_1.default.getMsgByType('CHROME_WEB_SECURITY_NOT_SUPPORTED', browser.name) });
                });
            }
            theCfg = this.testingType === 'e2e'
                ? theCfg
                : this.injectCtSpecificConfig(theCfg);
            if (theCfg.isTextTerminal) {
                this._cfg = theCfg;
                return this._cfg;
            }
            // decide if new project by asking scaffold
            // and looking at previously saved user state
            if (!theCfg.integrationFolder) {
                throw new Error('Missing integration folder');
            }
            const untouchedScaffold = yield this.determineIsNewProject(theCfg);
            const userHasSeenBanner = lodash_1.default.get(theCfg, 'state.showedNewProjectBanner', false);
            debugScaffold(`untouched scaffold ${untouchedScaffold} banner closed ${userHasSeenBanner}`);
            theCfg.isNewProject = untouchedScaffold && !userHasSeenBanner;
            const cfgWithSaved = yield this._setSavedState(theCfg);
            this._cfg = cfgWithSaved;
            return this._cfg;
        });
    }
    // returns project config (user settings + defaults + cypress.json)
    // with additional object "state" which are transient things like
    // window width and height, DevTools open or not, etc.
    getConfig() {
        if (!this._cfg) {
            throw Error('Must call #initializeConfig before accessing config.');
        }
        debug('project has config %o', this._cfg);
        return this._cfg;
    }
    // Saved state
    // forces saving of project's state by first merging with argument
    saveState(stateChanges = {}) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            if (!this.cfg) {
                throw new Error('Missing project config');
            }
            if (!this.projectRoot) {
                throw new Error('Missing project root');
            }
            let state = yield saved_state_1.default.create(this.projectRoot, this.cfg.isTextTerminal);
            state.set(stateChanges);
            state = yield state.get();
            this.cfg.state = state;
            return state;
        });
    }
    _setSavedState(cfg) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            debug('get saved state');
            let state = yield saved_state_1.default.create(this.projectRoot, cfg.isTextTerminal);
            state = yield state.get();
            cfg.state = state;
            return cfg;
        });
    }
    // Scaffolding
    removeScaffoldedFiles() {
        if (!this.cfg) {
            throw new Error('Missing project config');
        }
        return scaffold_1.default.removeIntegration(this.cfg.integrationFolder, this.cfg);
    }
    // do not check files again and again - keep previous promise
    // to refresh it - just close and open the project again.
    determineIsNewProject(folder) {
        return scaffold_1.default.isNewProject(folder);
    }
    scaffold(cfg) {
        debug('scaffolding project %s', this.projectRoot);
        const scaffolds = [];
        const push = scaffolds.push.bind(scaffolds);
        // TODO: we are currently always scaffolding support
        // even when headlessly - this is due to a major breaking
        // change of 0.18.0
        // we can later force this not to always happen when most
        // of our users go beyond 0.18.0
        //
        // ensure support dir is created
        // and example support file if dir doesnt exist
        push(scaffold_1.default.support(cfg.supportFolder, cfg));
        // if we're in headed mode add these other scaffolding tasks
        debug('scaffold flags %o', {
            isTextTerminal: cfg.isTextTerminal,
            CYPRESS_INTERNAL_FORCE_SCAFFOLD: process.env.CYPRESS_INTERNAL_FORCE_SCAFFOLD,
        });
        const scaffoldExamples = !cfg.isTextTerminal || process.env.CYPRESS_INTERNAL_FORCE_SCAFFOLD;
        if (scaffoldExamples) {
            debug('will scaffold integration and fixtures folder');
            push(scaffold_1.default.integration(cfg.integrationFolder, cfg));
            push(scaffold_1.default.fixture(cfg.fixturesFolder, cfg));
        }
        else {
            debug('will not scaffold integration or fixtures folder');
        }
        return Promise.all(scaffolds);
    }
    // These methods are not related to start server/sockets/runners
    getProjectId() {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            yield this.verifyExistence();
            const readSettings = yield settings.read(this.projectRoot, this.options);
            if (readSettings && readSettings.projectId) {
                return readSettings.projectId;
            }
            errors_1.default.throw('NO_PROJECT_ID', settings.configFile(this.options), this.projectRoot);
        });
    }
    verifyExistence() {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            try {
                yield fs_1.fs.statAsync(this.projectRoot);
            }
            catch (err) {
                errors_1.default.throw('NO_PROJECT_FOUND_AT_PROJECT_ROOT', this.projectRoot);
            }
        });
    }
    getRecordKeys() {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const [projectId, authToken] = yield Promise.all([
                this.getProjectId(),
                user_1.default.ensureAuthToken(),
            ]);
            return api_1.default.getProjectRecordKeys(projectId, authToken);
        });
    }
    requestAccess(projectId) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const authToken = yield user_1.default.ensureAuthToken();
            return api_1.default.requestAccess(projectId, authToken);
        });
    }
    // For testing
    // Do not use this method outside of testing
    // pass all your options when you create a new instance!
    __setOptions(options) {
        this.options = options;
    }
    __setConfig(cfg) {
        this._cfg = cfg;
    }
}
exports.ProjectBase = ProjectBase;
