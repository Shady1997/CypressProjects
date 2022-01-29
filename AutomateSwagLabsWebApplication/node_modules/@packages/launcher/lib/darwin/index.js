"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detect = exports.getPathData = exports.getVersionNumber = exports.getVersionString = exports.browsers = void 0;
const util_1 = require("./util");
const linuxHelper = __importStar(require("../linux"));
const log_1 = require("../log");
const lodash_1 = require("lodash");
exports.browsers = {
    chrome: {
        stable: {
            appName: 'Google Chrome.app',
            executable: 'Contents/MacOS/Google Chrome',
            appId: 'com.google.Chrome',
            versionProperty: 'KSVersion',
        },
        beta: {
            appName: 'Google Chrome Beta.app',
            executable: 'Contents/MacOS/Google Chrome Beta',
            appId: 'com.google.Chrome.beta',
            versionProperty: 'KSVersion',
        },
        canary: {
            appName: 'Google Chrome Canary.app',
            executable: 'Contents/MacOS/Google Chrome Canary',
            appId: 'com.google.Chrome.canary',
            versionProperty: 'KSVersion',
        },
    },
    chromium: {
        stable: {
            appName: 'Chromium.app',
            executable: 'Contents/MacOS/Chromium',
            appId: 'org.chromium.Chromium',
            versionProperty: 'CFBundleShortVersionString',
        },
    },
    firefox: {
        stable: {
            appName: 'Firefox.app',
            executable: 'Contents/MacOS/firefox-bin',
            appId: 'org.mozilla.firefox',
            versionProperty: 'CFBundleShortVersionString',
        },
        dev: {
            appName: 'Firefox Developer Edition.app',
            executable: 'Contents/MacOS/firefox-bin',
            appId: 'org.mozilla.firefoxdeveloperedition',
            versionProperty: 'CFBundleShortVersionString',
        },
        nightly: {
            appName: 'Firefox Nightly.app',
            executable: 'Contents/MacOS/firefox-bin',
            appId: 'org.mozilla.nightly',
            versionProperty: 'CFBundleShortVersionString',
        },
    },
    edge: {
        stable: {
            appName: 'Microsoft Edge.app',
            executable: 'Contents/MacOS/Microsoft Edge',
            appId: 'com.microsoft.Edge',
            versionProperty: 'CFBundleShortVersionString',
        },
        canary: {
            appName: 'Microsoft Edge Canary.app',
            executable: 'Contents/MacOS/Microsoft Edge Canary',
            appId: 'com.microsoft.Edge.Canary',
            versionProperty: 'CFBundleShortVersionString',
        },
        beta: {
            appName: 'Microsoft Edge Beta.app',
            executable: 'Contents/MacOS/Microsoft Edge Beta',
            appId: 'com.microsoft.Edge.Beta',
            versionProperty: 'CFBundleShortVersionString',
        },
        dev: {
            appName: 'Microsoft Edge Dev.app',
            executable: 'Contents/MacOS/Microsoft Edge Dev',
            appId: 'com.microsoft.Edge.Dev',
            versionProperty: 'CFBundleShortVersionString',
        },
    },
};
exports.getVersionString = linuxHelper.getVersionString;
exports.getVersionNumber = linuxHelper.getVersionNumber;
exports.getPathData = linuxHelper.getPathData;
function detect(browser) {
    let findAppParams = (0, lodash_1.get)(exports.browsers, [browser.name, browser.channel]);
    if (!findAppParams) {
        // ok, maybe it is custom alias?
        (0, log_1.log)('detecting custom browser %s on darwin', browser.name);
        return linuxHelper.detect(browser);
    }
    return (0, util_1.findApp)(findAppParams)
        .then((val) => (Object.assign({ name: browser.name }, val)))
        .catch(() => {
        (0, log_1.log)('could not detect %s using traditional Mac methods', browser.name);
        (0, log_1.log)('trying linux search');
        return linuxHelper.detect(browser);
    });
}
exports.detect = detect;
