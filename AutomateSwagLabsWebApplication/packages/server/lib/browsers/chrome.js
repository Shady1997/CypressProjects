"use strict";
const tslib_1 = require("tslib");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const check_more_types_1 = (0, tslib_1.__importDefault)(require("check-more-types"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const lazy_ass_1 = (0, tslib_1.__importDefault)(require("lazy-ass"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const os_1 = (0, tslib_1.__importDefault)(require("os"));
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const extension_1 = (0, tslib_1.__importDefault)(require("../../../extension"));
const mime_1 = (0, tslib_1.__importDefault)(require("mime"));
const launcher_1 = require("../../../launcher");
const app_data_1 = (0, tslib_1.__importDefault)(require("../util/app_data"));
const fs_1 = require("../util/fs");
const cdp_automation_1 = require("./cdp_automation");
const CriClient = (0, tslib_1.__importStar)(require("./cri-client"));
const protocol = (0, tslib_1.__importStar)(require("./protocol"));
const utils_1 = (0, tslib_1.__importDefault)(require("./utils"));
const debug = (0, debug_1.default)('cypress:server:browsers:chrome');
const LOAD_EXTENSION = '--load-extension=';
const CHROME_VERSIONS_WITH_BUGGY_ROOT_LAYER_SCROLLING = '66 67'.split(' ');
const CHROME_VERSION_INTRODUCING_PROXY_BYPASS_ON_LOOPBACK = 72;
const CHROME_VERSION_WITH_FPS_INCREASE = 89;
const CHROME_PREFERENCE_PATHS = {
    default: path_1.default.join('Default', 'Preferences'),
    defaultSecure: path_1.default.join('Default', 'Secure Preferences'),
    localState: 'Local State',
};
const pathToExtension = extension_1.default.getPathToExtension();
const pathToTheme = extension_1.default.getPathToTheme();
// Common Chrome Flags for Automation
// https://github.com/GoogleChrome/chrome-launcher/blob/master/docs/chrome-flags-for-tools.md
const DEFAULT_ARGS = [
    '--test-type',
    '--ignore-certificate-errors',
    '--start-maximized',
    '--silent-debugger-extension-api',
    '--no-default-browser-check',
    '--no-first-run',
    '--noerrdialogs',
    '--enable-fixed-layout',
    '--disable-popup-blocking',
    '--disable-password-generation',
    '--disable-single-click-autofill',
    '--disable-prompt-on-repos',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-renderer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-restore-session-state',
    '--disable-new-profile-management',
    '--disable-new-avatar-menu',
    '--allow-insecure-localhost',
    '--reduce-security-for-testing',
    '--enable-automation',
    '--disable-print-preview',
    '--disable-device-discovery-notifications',
    // https://github.com/cypress-io/cypress/issues/2376
    '--autoplay-policy=no-user-gesture-required',
    // http://www.chromium.org/Home/chromium-security/site-isolation
    // https://github.com/cypress-io/cypress/issues/1951
    '--disable-site-isolation-trials',
    // the following come frome chromedriver
    // https://code.google.com/p/chromium/codesearch#chromium/src/chrome/test/chromedriver/chrome_launcher.cc&sq=package:chromium&l=70
    '--metrics-recording-only',
    '--disable-prompt-on-repost',
    '--disable-hang-monitor',
    '--disable-sync',
    // this flag is causing throttling of XHR callbacks for
    // as much as 30 seconds. If you VNC in and open dev tools or
    // click on a button, it'll "instantly" work. with this
    // option enabled, it will time out some of our tests in circle
    // "--disable-background-networking"
    '--disable-web-resources',
    '--safebrowsing-disable-download-protection',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    // Simulate when chrome needs an update.
    // This prevents an 'update' from displaying til the given date
    `--simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT'`,
    '--disable-default-apps',
    // These flags are for webcam/WebRTC testing
    // https://github.com/cypress-io/cypress/issues/2704
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    // so Cypress commands don't get throttled
    // https://github.com/cypress-io/cypress/issues/5132
    '--disable-ipc-flooding-protection',
    // misc. options puppeteer passes
    // https://github.com/cypress-io/cypress/issues/3633
    '--disable-backgrounding-occluded-window',
    '--disable-breakpad',
    '--password-store=basic',
    '--use-mock-keychain',
    // write shared memory files into '/tmp' instead of '/dev/shm'
    // https://github.com/cypress-io/cypress/issues/5336
    '--disable-dev-shm-usage',
];
/**
 * Reads all known preference files (CHROME_PREFERENCE_PATHS) from disk and retur
 * @param userDir
 */
const _getChromePreferences = (userDir) => {
    debug('reading chrome preferences... %o', { userDir, CHROME_PREFERENCE_PATHS });
    return bluebird_1.default.props(lodash_1.default.mapValues(CHROME_PREFERENCE_PATHS, (prefPath) => {
        return fs_1.fs.readJson(path_1.default.join(userDir, prefPath))
            .catch((err) => {
            // return empty obj if it doesn't exist
            if (err.code === 'ENOENT') {
                return {};
            }
            throw err;
        });
    }));
};
const _mergeChromePreferences = (originalPrefs, newPrefs) => {
    return lodash_1.default.mapValues(CHROME_PREFERENCE_PATHS, (_v, prefPath) => {
        const original = lodash_1.default.cloneDeep(originalPrefs[prefPath]);
        if (!newPrefs[prefPath]) {
            return original;
        }
        let deletions = [];
        lodash_1.default.mergeWith(original, newPrefs[prefPath], (_objValue, newValue, key, obj) => {
            if (newValue == null) {
                // setting a key to null should remove it
                deletions.push([obj, key]);
            }
        });
        deletions.forEach(([obj, key]) => {
            delete obj[key];
        });
        return original;
    });
};
const _writeChromePreferences = (userDir, originalPrefs, newPrefs) => {
    return bluebird_1.default.map(lodash_1.default.keys(originalPrefs), (key) => {
        const originalJson = originalPrefs[key];
        const newJson = newPrefs[key];
        if (!newJson || lodash_1.default.isEqual(originalJson, newJson)) {
            return;
        }
        return fs_1.fs.outputJson(path_1.default.join(userDir, CHROME_PREFERENCE_PATHS[key]), newJson);
    })
        .return();
};
/**
 * Merge the different `--load-extension` arguments into one.
 *
 * @param extPath path to Cypress extension
 * @param args all browser args
 * @param browser the current browser being launched
 * @returns the modified list of arguments
 */
const _normalizeArgExtensions = function (extPath, args, pluginExtensions, browser) {
    if (browser.isHeadless) {
        return args;
    }
    let userExtensions = [];
    const loadExtension = lodash_1.default.find(args, (arg) => {
        return arg.includes(LOAD_EXTENSION);
    });
    if (loadExtension) {
        args = lodash_1.default.without(args, loadExtension);
        // form into array, enabling users to pass multiple extensions
        userExtensions = userExtensions.concat(loadExtension.replace(LOAD_EXTENSION, '').split(','));
    }
    if (pluginExtensions) {
        userExtensions = userExtensions.concat(pluginExtensions);
    }
    const extensions = [].concat(userExtensions, extPath, pathToTheme);
    args.push(LOAD_EXTENSION + lodash_1.default.compact(extensions).join(','));
    return args;
};
// we now store the extension in each browser profile
const _removeRootExtension = () => {
    return fs_1.fs
        .removeAsync(app_data_1.default.path('extensions'))
        .catchReturn(null);
}; // noop if doesn't exist fails for any reason
// https://github.com/cypress-io/cypress/issues/2048
const _disableRestorePagesPrompt = function (userDir) {
    const prefsPath = path_1.default.join(userDir, 'Default', 'Preferences');
    return fs_1.fs.readJson(prefsPath)
        .then((preferences) => {
        const profile = preferences.profile;
        if (profile) {
            if ((profile['exit_type'] !== 'Normal') || (profile['exited_cleanly'] !== true)) {
                debug('cleaning up unclean exit status');
                profile['exit_type'] = 'Normal';
                profile['exited_cleanly'] = true;
                return fs_1.fs.outputJson(prefsPath, preferences);
            }
        }
        return;
    })
        .catch(() => { });
};
// After the browser has been opened, we can connect to
// its remote interface via a websocket.
const _connectToChromeRemoteInterface = function (port, onError, browserDisplayName) {
    // @ts-ignore
    (0, lazy_ass_1.default)(check_more_types_1.default.userPort(port), 'expected port number to connect CRI to', port);
    debug('connecting to Chrome remote interface at random port %d', port);
    return protocol.getWsTargetFor(port, browserDisplayName)
        .then((wsUrl) => {
        debug('received wsUrl %s for port %d', wsUrl, port);
        return CriClient.create(wsUrl, onError);
    });
};
const _maybeRecordVideo = function (client, options, browserMajorVersion) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        if (!options.onScreencastFrame) {
            debug('options.onScreencastFrame is false');
            return client;
        }
        debug('starting screencast');
        client.on('Page.screencastFrame', (meta) => {
            options.onScreencastFrame(meta);
            client.send('Page.screencastFrameAck', { sessionId: meta.sessionId });
        });
        yield client.send('Page.startScreencast', browserMajorVersion >= CHROME_VERSION_WITH_FPS_INCREASE ? (0, cdp_automation_1.screencastOpts)() : (0, cdp_automation_1.screencastOpts)(1));
        return client;
    });
};
// a utility function that navigates to the given URL
// once Chrome remote interface client is passed to it.
const _navigateUsingCRI = function (client, url) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        // @ts-ignore
        (0, lazy_ass_1.default)(check_more_types_1.default.url(url), 'missing url to navigate to', url);
        (0, lazy_ass_1.default)(client, 'could not get CRI client');
        debug('received CRI client');
        debug('navigating to page %s', url);
        // when opening the blank page and trying to navigate
        // the focus gets lost. Restore it and then navigate.
        yield client.send('Page.bringToFront');
        yield client.send('Page.navigate', { url });
    });
};
const _handleDownloads = function (client, dir, automation) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        yield client.send('Page.enable');
        client.on('Page.downloadWillBegin', (data) => {
            const downloadItem = {
                id: data.guid,
                url: data.url,
            };
            const filename = data.suggestedFilename;
            if (filename) {
                // @ts-ignore
                downloadItem.filePath = path_1.default.join(dir, data.suggestedFilename);
                // @ts-ignore
                downloadItem.mime = mime_1.default.getType(data.suggestedFilename);
            }
            automation.push('create:download', downloadItem);
        });
        client.on('Page.downloadProgress', (data) => {
            if (data.state !== 'completed')
                return;
            automation.push('complete:download', {
                id: data.guid,
            });
        });
        yield client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: dir,
        });
    });
};
const _setAutomation = (client, automation) => {
    return automation.use(new cdp_automation_1.CdpAutomation(client.send, client.on, automation));
};
module.exports = {
    //
    // tip:
    //   by adding utility functions that start with "_"
    //   as methods here we can easily stub them from our unit tests
    //
    _normalizeArgExtensions,
    _removeRootExtension,
    _connectToChromeRemoteInterface,
    _maybeRecordVideo,
    _navigateUsingCRI,
    _handleDownloads,
    _setAutomation,
    _getChromePreferences,
    _mergeChromePreferences,
    _writeChromePreferences,
    _writeExtension(browser, options) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            if (browser.isHeadless) {
                debug('chrome is running headlessly, not installing extension');
                return;
            }
            // get the string bytes for the final extension file
            const str = yield extension_1.default.setHostAndPath(options.proxyUrl, options.socketIoRoute);
            const extensionDest = utils_1.default.getExtensionDir(browser, options.isTextTerminal);
            const extensionBg = path_1.default.join(extensionDest, 'background.js');
            // copy the extension src to the extension dist
            yield utils_1.default.copyExtension(pathToExtension, extensionDest);
            yield fs_1.fs.chmod(extensionBg, 0o0644);
            yield fs_1.fs.writeFileAsync(extensionBg, str);
            return extensionDest;
        });
    },
    _getArgs(browser, options, port) {
        const args = [].concat(DEFAULT_ARGS);
        if (os_1.default.platform() === 'linux') {
            args.push('--disable-gpu');
            args.push('--no-sandbox');
        }
        const ua = options.userAgent;
        if (ua) {
            args.push(`--user-agent=${ua}`);
        }
        const ps = options.proxyServer;
        if (ps) {
            args.push(`--proxy-server=${ps}`);
        }
        if (options.chromeWebSecurity === false) {
            args.push('--disable-web-security');
            args.push('--allow-running-insecure-content');
        }
        // prevent AUT shaking in 66 & 67, but flag breaks chrome in 68+
        // https://github.com/cypress-io/cypress/issues/2037
        // https://github.com/cypress-io/cypress/issues/2215
        // https://github.com/cypress-io/cypress/issues/2223
        const { majorVersion, isHeadless } = browser;
        if (CHROME_VERSIONS_WITH_BUGGY_ROOT_LAYER_SCROLLING.includes(majorVersion)) {
            args.push('--disable-blink-features=RootLayerScrolling');
        }
        // https://chromium.googlesource.com/chromium/src/+/da790f920bbc169a6805a4fb83b4c2ab09532d91
        // https://github.com/cypress-io/cypress/issues/1872
        if (majorVersion >= CHROME_VERSION_INTRODUCING_PROXY_BYPASS_ON_LOOPBACK) {
            args.push('--proxy-bypass-list=<-loopback>');
        }
        if (isHeadless) {
            args.push('--headless');
            // set default headless size to 1280x720
            // https://github.com/cypress-io/cypress/issues/6210
            args.push('--window-size=1280,720');
            // set default headless DPR to 1
            // https://github.com/cypress-io/cypress/issues/17375
            args.push('--force-device-scale-factor=1');
        }
        // force ipv4
        // https://github.com/cypress-io/cypress/issues/5912
        args.push(`--remote-debugging-port=${port}`);
        args.push('--remote-debugging-address=127.0.0.1');
        return args;
    },
    open(browser, url, options = {}, automation) {
        return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const { isTextTerminal } = options;
            const userDir = utils_1.default.getProfileDir(browser, isTextTerminal);
            const [port, preferences] = yield bluebird_1.default.all([
                protocol.getRemoteDebuggingPort(),
                _getChromePreferences(userDir),
            ]);
            const defaultArgs = this._getArgs(browser, options, port);
            const defaultLaunchOptions = utils_1.default.getDefaultLaunchOptions({
                preferences,
                args: defaultArgs,
            });
            const [cacheDir, launchOptions] = yield bluebird_1.default.all([
                // ensure that we have a clean cache dir
                // before launching the browser every time
                utils_1.default.ensureCleanCache(browser, isTextTerminal),
                utils_1.default.executeBeforeBrowserLaunch(browser, defaultLaunchOptions, options),
            ]);
            if (launchOptions.preferences) {
                launchOptions.preferences = _mergeChromePreferences(preferences, launchOptions.preferences);
            }
            const [extDest] = yield bluebird_1.default.all([
                this._writeExtension(browser, options),
                _removeRootExtension(),
                _disableRestorePagesPrompt(userDir),
                _writeChromePreferences(userDir, preferences, launchOptions.preferences),
            ]);
            // normalize the --load-extensions argument by
            // massaging what the user passed into our own
            const args = _normalizeArgExtensions(extDest, launchOptions.args, launchOptions.extensions, browser);
            // this overrides any previous user-data-dir args
            // by being the last one
            args.push(`--user-data-dir=${userDir}`);
            args.push(`--disk-cache-dir=${cacheDir}`);
            debug('launching in chrome with debugging port', { url, args, port });
            // FIRST load the blank page
            // first allows us to connect the remote interface,
            // start video recording and then
            // we will load the actual page
            const launchedBrowser = yield (0, launcher_1.launch)(browser, 'about:blank', args);
            (0, lazy_ass_1.default)(launchedBrowser, 'did not get launched browser instance');
            // SECOND connect to the Chrome remote interface
            // and when the connection is ready
            // navigate to the actual url
            const criClient = yield this._connectToChromeRemoteInterface(port, options.onError, browser.displayName);
            (0, lazy_ass_1.default)(criClient, 'expected Chrome remote interface reference', criClient);
            yield criClient.ensureMinimumProtocolVersion('1.3')
                .catch((err) => {
                // if this minumum chrome version changes, sync it with
                // packages/web-config/webpack.config.base.ts and
                // npm/webpack-batteries-included-preprocessor/index.js
                throw new Error(`Cypress requires at least Chrome 64.\n\nDetails:\n${err.message}`);
            });
            this._setAutomation(criClient, automation);
            // monkey-patch the .kill method to that the CDP connection is closed
            const originalBrowserKill = launchedBrowser.kill;
            /* @ts-expect-error */
            launchedBrowser.kill = (...args) => {
                debug('closing remote interface client');
                criClient.close();
                debug('closing chrome');
                originalBrowserKill.apply(launchedBrowser, args);
            };
            yield this._maybeRecordVideo(criClient, options, browser.majorVersion);
            yield this._navigateUsingCRI(criClient, url);
            yield this._handleDownloads(criClient, options.downloadsFolder, automation);
            // return the launched browser process
            // with additional method to close the remote connection
            return launchedBrowser;
        });
    },
};
