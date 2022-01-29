"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = exports.returnDefaultBrowser = exports.browsersForCtInteractive = void 0;
const tslib_1 = require("tslib");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const utils_1 = (0, tslib_1.__importDefault)(require("../browsers/utils"));
const human_interval_1 = (0, tslib_1.__importDefault)(require("human-interval"));
const browsers_1 = (0, tslib_1.__importDefault)(require("../browsers"));
const open_project_1 = require("../open_project");
const Updater = (0, tslib_1.__importStar)(require("../updater"));
const errors = (0, tslib_1.__importStar)(require("../errors"));
const debug = (0, debug_1.default)('cypress:server:interactive-ct');
const registerCheckForUpdates = () => {
    const checkForUpdates = (initialLaunch) => {
        Updater.check({
            initialLaunch,
            testingType: 'component',
            onNewVersion: lodash_1.default.noop,
            onNoNewVersion: lodash_1.default.noop,
        });
    };
    setInterval(() => checkForUpdates(false), (0, human_interval_1.default)('60 minutes'));
    checkForUpdates(true);
};
const start = (projectRoot, args) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    if (process.env['CYPRESS_INTERNAL_ENV'] === 'production') {
        registerCheckForUpdates();
    }
    debug('start server-ct on ', projectRoot);
    // add chrome as a default browser if none has been specified
    return browsers_1.default.ensureAndGetByNameOrPath(args.browser)
        .then((browser) => {
        const spec = {
            name: 'All Specs',
            absolute: '__all',
            relative: '__all',
            specType: 'component',
        };
        const options = {
            browsers: [browser],
        };
        debug('create project');
        return open_project_1.openProject.create(projectRoot, args, options)
            .then(() => {
            debug('launch project');
            return open_project_1.openProject.launch(browser, spec, {
                onBrowserClose: () => {
                    debug('BROWSER EXITED SAFELY');
                    debug('COMPONENT TESTING STOPPED');
                    process.exit();
                },
            });
        });
    });
});
exports.browsersForCtInteractive = ['chrome', 'chromium', 'edge', 'electron', 'firefox'];
const returnDefaultBrowser = (browsersByPriority, installedBrowsers) => {
    const browserMap = installedBrowsers.reduce((acc, curr) => {
        acc[curr.name] = true;
        return acc;
    }, {});
    for (const browser of browsersByPriority) {
        if (browserMap[browser]) {
            return browser;
        }
    }
    return undefined;
};
exports.returnDefaultBrowser = returnDefaultBrowser;
const run = (options) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    const installedBrowsers = yield utils_1.default.getBrowsers();
    options.browser = options.browser || (0, exports.returnDefaultBrowser)(exports.browsersForCtInteractive, installedBrowsers);
    return start(options.projectRoot, options).catch((e) => {
        // Usually this kind of error management is doen inside cypress.js start
        // But here we bypassed this since we don't use the window of the gui
        // Handle errors here to avoid multiple errors appearing.
        return errors.logException(e).then(() => {
            process.exit(1);
        });
    });
});
exports.run = run;
