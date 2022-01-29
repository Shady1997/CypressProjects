"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openProject = exports.OpenProject = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const lazy_ass_1 = (0, tslib_1.__importDefault)(require("lazy-ass"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const chokidar_1 = (0, tslib_1.__importDefault)(require("chokidar"));
const pluralize_1 = (0, tslib_1.__importDefault)(require("pluralize"));
const project_base_1 = require("./project-base");
const browsers_1 = (0, tslib_1.__importDefault)(require("./browsers"));
const specs_1 = (0, tslib_1.__importDefault)(require("./util/specs"));
const preprocessor_1 = (0, tslib_1.__importDefault)(require("./plugins/preprocessor"));
const run_events_1 = (0, tslib_1.__importDefault)(require("./plugins/run_events"));
const session = (0, tslib_1.__importStar)(require("./session"));
const project_utils_1 = require("./project_utils");
const errors_1 = (0, tslib_1.__importDefault)(require("./errors"));
const debug = (0, debug_1.default)('cypress:server:open_project');
class OpenProject {
    constructor() {
        this.openProject = null;
        this.relaunchBrowser = null;
        this.specsWatcher = null;
        this.componentSpecsWatcher = null;
        this.getRecordKeys = this.tryToCall('getRecordKeys');
        this.getRuns = this.tryToCall('getRuns');
        this.requestAccess = this.tryToCall('requestAccess');
    }
    resetOpenProject() {
        this.openProject = null;
        this.relaunchBrowser = null;
    }
    tryToCall(method) {
        return (...args) => {
            if (this.openProject && this.openProject[method]) {
                return this.openProject[method](...args);
            }
            return bluebird_1.default.resolve(null);
        };
    }
    reset() {
        this.resetOpenProject();
    }
    getConfig() {
        return this.openProject.getConfig();
    }
    getProject() {
        return this.openProject;
    }
    changeUrlToSpec(spec) {
        if (!this.openProject) {
            return;
        }
        const newSpecUrl = (0, project_utils_1.getSpecUrl)({
            absoluteSpecPath: spec.absolute,
            specType: spec.specType,
            browserUrl: this.openProject.cfg.browserUrl,
            integrationFolder: this.openProject.cfg.integrationFolder || 'integration',
            componentFolder: this.openProject.cfg.componentFolder || 'component',
            projectRoot: this.openProject.projectRoot,
        });
        this.openProject.changeToUrl(newSpecUrl);
    }
    launch(browser, spec, options = {
        onError: () => undefined,
    }) {
        if (!this.openProject) {
            throw Error('Cannot launch runner if openProject is undefined!');
        }
        debug('resetting project state, preparing to launch browser %s for spec %o options %o', browser.name, spec, options);
        (0, lazy_ass_1.default)(lodash_1.default.isPlainObject(browser), 'expected browser object:', browser);
        // reset to reset server and socket state because
        // of potential domain changes, request buffers, etc
        this.openProject.reset();
        const url = (0, project_utils_1.getSpecUrl)({
            absoluteSpecPath: spec.absolute,
            specType: spec.specType,
            browserUrl: this.openProject.cfg.browserUrl,
            integrationFolder: this.openProject.cfg.integrationFolder || 'integration',
            componentFolder: this.openProject.cfg.componentFolder || 'component?',
            projectRoot: this.openProject.projectRoot,
        });
        debug('open project url %s', url);
        const cfg = this.openProject.getConfig();
        lodash_1.default.defaults(options, {
            browsers: cfg.browsers,
            userAgent: cfg.userAgent,
            proxyUrl: cfg.proxyUrl,
            proxyServer: cfg.proxyServer,
            socketIoRoute: cfg.socketIoRoute,
            chromeWebSecurity: cfg.chromeWebSecurity,
            isTextTerminal: cfg.isTextTerminal,
            downloadsFolder: cfg.downloadsFolder,
        });
        // if we don't have the isHeaded property
        // then we're in interactive mode and we
        // can assume its a headed browser
        // TODO: we should clean this up
        if (!lodash_1.default.has(browser, 'isHeaded')) {
            browser.isHeaded = true;
            browser.isHeadless = false;
        }
        // set the current browser object on options
        // so we can pass it down
        options.browser = browser;
        options.url = url;
        this.openProject.setCurrentSpecAndBrowser(spec, browser);
        const automation = this.openProject.getAutomation();
        // use automation middleware if its
        // been defined here
        let am = options.automationMiddleware;
        if (am) {
            automation.use(am);
        }
        if (!am || !am.onBeforeRequest) {
            automation.use({
                onBeforeRequest(message, data) {
                    if (message === 'take:screenshot') {
                        data.specName = spec.name;
                        return data;
                    }
                },
            });
        }
        const afterSpec = () => {
            if (!this.openProject || cfg.isTextTerminal || !cfg.experimentalInteractiveRunEvents) {
                return bluebird_1.default.resolve();
            }
            return run_events_1.default.execute('after:spec', cfg, spec);
        };
        const { onBrowserClose } = options;
        options.onBrowserClose = () => {
            if (spec && spec.absolute) {
                preprocessor_1.default.removeFile(spec.absolute, cfg);
            }
            afterSpec()
                .catch((err) => {
                this.openProject.options.onError(err);
            });
            if (onBrowserClose) {
                return onBrowserClose();
            }
        };
        options.onError = this.openProject.options.onError;
        this.relaunchBrowser = () => {
            debug('launching browser: %o, spec: %s', browser, spec.relative);
            return bluebird_1.default.try(() => {
                if (!cfg.isTextTerminal && cfg.experimentalInteractiveRunEvents) {
                    return run_events_1.default.execute('before:spec', cfg, spec);
                }
                // clear all session data before each spec
                session.clearSessions();
            })
                .then(() => {
                return browsers_1.default.open(browser, options, automation);
            });
        };
        return this.relaunchBrowser();
    }
    getSpecs(cfg) {
        return specs_1.default.findSpecs(cfg)
            .then((specs = []) => {
            // TODO merge logic with "run.js"
            if (debug.enabled) {
                const names = lodash_1.default.map(specs, 'name');
                debug('found %s using spec pattern \'%s\': %o', (0, pluralize_1.default)('spec', names.length, true), cfg.testFiles, names);
            }
            const componentTestingEnabled = lodash_1.default.get(cfg, 'resolved.testingType.value', 'e2e') === 'component';
            if (componentTestingEnabled) {
                // separate specs into integration and component lists
                // note: _.remove modifies the array in place and returns removed elements
                const component = lodash_1.default.remove(specs, { specType: 'component' });
                return {
                    integration: specs,
                    component,
                };
            }
            // assumes all specs are integration specs
            return {
                integration: specs.filter((x) => x.specType === 'integration'),
                component: [],
            };
        });
    }
    getSpecChanges(options = {}) {
        let currentSpecs;
        lodash_1.default.defaults(options, {
            onChange: () => { },
            onError: () => { },
        });
        const sendIfChanged = (specs = { component: [], integration: [] }) => {
            var _a;
            // dont do anything if the specs haven't changed
            if (lodash_1.default.isEqual(specs, currentSpecs)) {
                return;
            }
            currentSpecs = specs;
            return (_a = options === null || options === void 0 ? void 0 : options.onChange) === null || _a === void 0 ? void 0 : _a.call(options, specs);
        };
        const checkForSpecUpdates = lodash_1.default.debounce(() => {
            if (!this.openProject) {
                return this.stopSpecsWatcher();
            }
            debug('check for spec updates');
            return get()
                .then(sendIfChanged)
                .catch(options === null || options === void 0 ? void 0 : options.onError);
        }, 250, { leading: true });
        const createSpecsWatcher = (cfg) => {
            // TODO I keep repeating this to get the resolved value
            // probably better to have a single function that does this
            const componentTestingEnabled = lodash_1.default.get(cfg, 'resolved.testingType.value', 'e2e') === 'component';
            debug('createSpecWatch component testing enabled', componentTestingEnabled);
            if (!this.specsWatcher) {
                debug('watching integration test files: %s in %s', cfg.testFiles, cfg.integrationFolder);
                this.specsWatcher = chokidar_1.default.watch(cfg.testFiles, {
                    cwd: cfg.integrationFolder,
                    ignored: cfg.ignoreTestFiles,
                    ignoreInitial: true,
                });
                this.specsWatcher.on('add', checkForSpecUpdates);
                this.specsWatcher.on('unlink', checkForSpecUpdates);
            }
            if (componentTestingEnabled && !this.componentSpecsWatcher) {
                debug('watching component test files: %s in %s', cfg.testFiles, cfg.componentFolder);
                this.componentSpecsWatcher = chokidar_1.default.watch(cfg.testFiles, {
                    cwd: cfg.componentFolder,
                    ignored: cfg.ignoreTestFiles,
                    ignoreInitial: true,
                });
                this.componentSpecsWatcher.on('add', checkForSpecUpdates);
                this.componentSpecsWatcher.on('unlink', checkForSpecUpdates);
            }
        };
        const get = () => {
            if (!this.openProject) {
                return bluebird_1.default.resolve({
                    component: [],
                    integration: [],
                });
            }
            const cfg = this.openProject.getConfig();
            createSpecsWatcher(cfg);
            return this.getSpecs(cfg);
        };
        // immediately check the first time around
        return checkForSpecUpdates();
    }
    stopSpecsWatcher() {
        debug('stop spec watcher');
        if (this.specsWatcher) {
            this.specsWatcher.close();
            this.specsWatcher = null;
        }
        if (this.componentSpecsWatcher) {
            this.componentSpecsWatcher.close();
            this.componentSpecsWatcher = null;
        }
    }
    closeBrowser() {
        return browsers_1.default.close();
    }
    closeOpenProjectAndBrowsers() {
        return this.closeBrowser()
            .then(() => {
            var _a;
            return (_a = this.openProject) === null || _a === void 0 ? void 0 : _a.close();
        })
            .then(() => {
            this.resetOpenProject();
            return null;
        });
    }
    close() {
        debug('closing opened project');
        this.stopSpecsWatcher();
        return this.closeOpenProjectAndBrowsers();
    }
    create(path, args, options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            debug('open_project create %s', path);
            lodash_1.default.defaults(options, {
                onReloadBrowser: () => {
                    if (this.relaunchBrowser) {
                        return this.relaunchBrowser();
                    }
                },
            });
            if (!lodash_1.default.isUndefined(args.configFile)) {
                options.configFile = args.configFile;
            }
            options = lodash_1.default.extend({}, args.config, options, { args });
            // open the project and return
            // the config for the project instance
            debug('opening project %s', path);
            debug('and options %o', options);
            // store the currently open project
            this.openProject = new project_base_1.ProjectBase({
                testingType: args.testingType === 'component' ? 'component' : 'e2e',
                projectRoot: path,
                options: Object.assign(Object.assign({}, options), { testingType: args.testingType }),
            });
            try {
                yield this.openProject.initializeConfig();
                yield this.openProject.open();
            }
            catch (err) {
                if (err.isCypressErr && err.portInUse) {
                    errors_1.default.throw(err.type, err.port);
                }
                else {
                    // rethrow and handle elsewhere
                    throw (err);
                }
            }
            return this;
        });
    }
    // for testing purposes
    __reset() {
        this.resetOpenProject();
    }
}
exports.OpenProject = OpenProject;
exports.openProject = new OpenProject();
