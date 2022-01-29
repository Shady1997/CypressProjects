"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackState = exports.open = exports.create = exports.defaults = exports._newBrowserWindow = exports.getByWebContents = exports.focusMainWindow = exports.hideAllUnlessAnotherWindowIsFocused = exports.showAll = exports.get = exports.destroy = exports.reset = exports.removeAllExtensions = exports.installExtension = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const electron_context_menu_1 = (0, tslib_1.__importDefault)(require("electron-context-menu"));
const electron_1 = require("electron");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const cwd_1 = (0, tslib_1.__importDefault)(require("../cwd"));
const saved_state_1 = (0, tslib_1.__importDefault)(require("../saved_state"));
const resolve_dist_1 = require("../../../resolve-dist");
const debug = (0, debug_1.default)('cypress:server:windows');
let windows = {};
let recentlyCreatedWindow = false;
const getUrl = function (type) {
    switch (type) {
        case 'INDEX':
            return (0, resolve_dist_1.getPathToDesktopIndex)();
        default:
            throw new Error(`No acceptable window type found for: '${type}'`);
    }
};
const getByType = (type) => {
    return windows[type];
};
const setWindowProxy = function (win) {
    if (!process.env.HTTP_PROXY) {
        return;
    }
    return win.webContents.session.setProxy({
        proxyRules: process.env.HTTP_PROXY,
        proxyBypassRules: process.env.NO_PROXY,
    });
};
function installExtension(win, path) {
    return win.webContents.session.loadExtension(path)
        .then((data) => {
        debug('electron extension installed %o', { data, path });
    })
        .catch((err) => {
        debug('error installing electron extension %o', { err, path });
        throw err;
    });
}
exports.installExtension = installExtension;
function removeAllExtensions(win) {
    let extensions;
    try {
        extensions = win.webContents.session.getAllExtensions();
        extensions.forEach(({ id }) => {
            win.webContents.session.removeExtension(id);
        });
    }
    catch (err) {
        debug('error removing all extensions %o', { err, extensions });
    }
}
exports.removeAllExtensions = removeAllExtensions;
function reset() {
    windows = {};
}
exports.reset = reset;
function destroy(type) {
    let win;
    if (type && (win = getByType(type))) {
        return win.destroy();
    }
}
exports.destroy = destroy;
function get(type) {
    return getByType(type) || (() => {
        throw new Error(`No window exists for: '${type}'`);
    })();
}
exports.get = get;
function showAll() {
    return lodash_1.default.invoke(windows, 'showInactive');
}
exports.showAll = showAll;
function hideAllUnlessAnotherWindowIsFocused() {
    // bail if we have another focused window
    // or we are in the middle of creating a new one
    if (electron_1.BrowserWindow.getFocusedWindow() || recentlyCreatedWindow) {
        return;
    }
    // else hide all windows
    return lodash_1.default.invoke(windows, 'hide');
}
exports.hideAllUnlessAnotherWindowIsFocused = hideAllUnlessAnotherWindowIsFocused;
function focusMainWindow() {
    return getByType('INDEX').show();
}
exports.focusMainWindow = focusMainWindow;
function getByWebContents(webContents) {
    return electron_1.BrowserWindow.fromWebContents(webContents);
}
exports.getByWebContents = getByWebContents;
function _newBrowserWindow(options) {
    return new electron_1.BrowserWindow(options);
}
exports._newBrowserWindow = _newBrowserWindow;
function defaults(options = {}) {
    return lodash_1.default.defaultsDeep(options, {
        x: null,
        y: null,
        show: true,
        frame: true,
        width: null,
        height: null,
        minWidth: null,
        minHeight: null,
        devTools: false,
        trackState: false,
        contextMenu: false,
        recordFrameRate: null,
        onFocus() { },
        onBlur() { },
        onClose() { },
        onCrashed() { },
        onNewWindow() { },
        webPreferences: {
            partition: null,
            webSecurity: true,
            nodeIntegration: false,
            backgroundThrottling: false,
        },
    });
}
exports.defaults = defaults;
function create(projectRoot, _options = {}, newBrowserWindow = _newBrowserWindow) {
    const options = defaults(_options);
    if (options.show === false) {
        options.frame = false;
    }
    options.webPreferences.webSecurity = !!options.chromeWebSecurity;
    if (options.partition) {
        options.webPreferences.partition = options.partition;
    }
    const win = newBrowserWindow(options);
    win.on('blur', function (...args) {
        return options.onBlur.apply(win, args);
    });
    win.on('focus', function (...args) {
        return options.onFocus.apply(win, args);
    });
    win.once('closed', function (...args) {
        win.removeAllListeners();
        return options.onClose.apply(win, args);
    });
    // the webview loses focus on navigation, so we
    // have to refocus it everytime top navigates in headless mode
    // https://github.com/cypress-io/cypress/issues/2190
    if (options.show === false) {
        win.webContents.on('did-start-loading', () => {
            if (!win.isDestroyed()) {
                return win.focusOnWebView();
            }
        });
    }
    win.webContents.on('crashed', function (...args) {
        return options.onCrashed.apply(win, args);
    });
    win.webContents.on('new-window', function (...args) {
        return options.onNewWindow.apply(win, args);
    });
    if (options.trackState) {
        trackState(projectRoot, options.isTextTerminal, win, options.trackState);
    }
    // open dev tools if they're true
    if (options.devTools) {
        // and possibly detach dev tools if true
        win.webContents.openDevTools();
    }
    if (options.contextMenu) {
        // adds context menu with copy, paste, inspect element, etc
        (0, electron_context_menu_1.default)({
            showInspectElement: true,
            window: win,
        });
    }
    return win;
}
exports.create = create;
// open desktop-gui BrowserWindow
function open(projectRoot, options = {}, newBrowserWindow = _newBrowserWindow) {
    // if we already have a window open based
    // on that type then just show + focus it!
    let win;
    win = getByType(options.type);
    if (win) {
        win.show();
        return bluebird_1.default.resolve(win);
    }
    recentlyCreatedWindow = true;
    lodash_1.default.defaults(options, {
        width: 600,
        height: 500,
        show: true,
        webPreferences: {
            contextIsolation: true,
            preload: (0, cwd_1.default)('lib', 'ipc', 'ipc.js'),
        },
    });
    if (!options.url) {
        options.url = getUrl(options.type);
    }
    win = create(projectRoot, options, newBrowserWindow);
    debug('creating electron window with options %o', options);
    if (options.type) {
        windows[options.type] = win;
        win.once('closed', () => {
            delete windows[options.type];
        });
    }
    // enable our url to be a promise
    // and wait for this to be resolved
    return bluebird_1.default.join(options.url, setWindowProxy(win))
        .spread((url) => {
        // navigate the window here!
        win.loadURL(url);
        recentlyCreatedWindow = false;
    }).thenReturn(win);
}
exports.open = open;
function trackState(projectRoot, isTextTerminal, win, keys) {
    const isDestroyed = () => {
        return win.isDestroyed();
    };
    win.on('resize', lodash_1.default.debounce(() => {
        if (isDestroyed()) {
            return;
        }
        const [width, height] = win.getSize();
        const [x, y] = win.getPosition();
        const newState = {};
        newState[keys.width] = width;
        newState[keys.height] = height;
        newState[keys.x] = x;
        newState[keys.y] = y;
        return saved_state_1.default.create(projectRoot, isTextTerminal)
            .then((state) => {
            return state.set(newState);
        });
    }, 500));
    win.on('moved', lodash_1.default.debounce(() => {
        if (isDestroyed()) {
            return;
        }
        const [x, y] = win.getPosition();
        const newState = {};
        newState[keys.x] = x;
        newState[keys.y] = y;
        return saved_state_1.default.create(projectRoot, isTextTerminal)
            .then((state) => {
            return state.set(newState);
        });
    }, 500));
    win.webContents.on('devtools-opened', () => {
        const newState = {};
        newState[keys.devTools] = true;
        return saved_state_1.default.create(projectRoot, isTextTerminal)
            .then((state) => {
            return state.set(newState);
        });
    });
    return win.webContents.on('devtools-closed', () => {
        const newState = {};
        newState[keys.devTools] = false;
        return saved_state_1.default.create(projectRoot, isTextTerminal)
            .then((state) => {
            return state.set(newState);
        });
    });
}
exports.trackState = trackState;
