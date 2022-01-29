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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detect = exports.getPathData = exports.getVersionNumber = exports.getVersionString = exports.doubleEscape = void 0;
const fse = __importStar(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const path_1 = require("path");
const lodash_1 = require("lodash");
const errors_1 = require("../errors");
const log_1 = require("../log");
const utils_1 = require("../utils");
function formFullAppPath(name) {
    return [
        `C:/Program Files (x86)/Google/Chrome/Application/${name}.exe`,
        `C:/Program Files/Google/Chrome/Application/${name}.exe`,
    ].map(path_1.normalize);
}
function formChromeBetaAppPath() {
    return [
        'C:/Program Files (x86)/Google/Chrome Beta/Application/chrome.exe',
        'C:/Program Files/Google/Chrome Beta/Application/chrome.exe',
    ].map(path_1.normalize);
}
function formChromiumAppPath() {
    const exe = 'C:/Program Files (x86)/Google/chrome-win32/chrome.exe';
    return [(0, path_1.normalize)(exe)];
}
function formChromeCanaryAppPath() {
    const home = os_1.default.homedir();
    const exe = (0, path_1.join)(home, 'AppData', 'Local', 'Google', 'Chrome SxS', 'Application', 'chrome.exe');
    return [(0, path_1.normalize)(exe)];
}
function getFirefoxPaths(editionFolder) {
    return () => {
        return (['Program Files', 'Program Files (x86)'])
            .map((programFiles) => {
            return (0, path_1.normalize)(`C:/${programFiles}/${editionFolder}/firefox.exe`);
        })
            .concat((0, path_1.normalize)((0, path_1.join)(os_1.default.homedir(), 'AppData', 'Local', editionFolder, 'firefox.exe')));
    };
}
function formEdgeCanaryAppPath() {
    const home = os_1.default.homedir();
    const exe = (0, path_1.join)(home, 'AppData', 'Local', 'Microsoft', 'Edge SxS', 'Application', 'msedge.exe');
    return [(0, path_1.normalize)(exe)];
}
const formPaths = {
    chrome: {
        stable: formFullAppPath,
        beta: formChromeBetaAppPath,
        canary: formChromeCanaryAppPath,
    },
    chromium: {
        stable: formChromiumAppPath,
    },
    firefox: {
        stable: getFirefoxPaths('Mozilla Firefox'),
        dev: getFirefoxPaths('Firefox Developer Edition'),
        nightly: getFirefoxPaths('Firefox Nightly'),
    },
    edge: {
        stable: () => {
            return [(0, path_1.normalize)('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')];
        },
        beta: () => {
            return [(0, path_1.normalize)('C:/Program Files (x86)/Microsoft/Edge Beta/Application/msedge.exe')];
        },
        dev: () => {
            return [(0, path_1.normalize)('C:/Program Files (x86)/Microsoft/Edge Dev/Application/msedge.exe')];
        },
        canary: formEdgeCanaryAppPath,
    },
};
function getWindowsBrowser(browser) {
    const getVersion = (stdout) => {
        // result from wmic datafile
        // "Version=61.0.3163.100"
        const wmicVersion = /^Version=(\S+)$/;
        const m = wmicVersion.exec(stdout);
        if (m) {
            return m[1];
        }
        (0, log_1.log)('Could not extract version from %s using regex %s', stdout, wmicVersion);
        throw (0, errors_1.notInstalledErr)(browser.name);
    };
    const formFullAppPathFn = (0, lodash_1.get)(formPaths, [browser.name, browser.channel], formFullAppPath);
    const exePaths = formFullAppPathFn(browser.name);
    (0, log_1.log)('looking at possible paths... %o', { browser, exePaths });
    // shift and try paths 1-by-1 until we find one that works
    const tryNextExePath = () => __awaiter(this, void 0, void 0, function* () {
        const exePath = exePaths.shift();
        if (!exePath) {
            // exhausted available paths
            throw (0, errors_1.notInstalledErr)(browser.name);
        }
        let path = doubleEscape(exePath);
        return fse.pathExists(path)
            .then((exists) => {
            (0, log_1.log)('found %s ?', path, exists);
            if (!exists) {
                return tryNextExePath();
            }
            return getVersionString(path)
                .then((val) => {
                (0, log_1.log)(val);
                return val;
            })
                .then(getVersion)
                .then((version) => {
                (0, log_1.log)('browser %s at \'%s\' version %s', browser.name, exePath, version);
                return {
                    name: browser.name,
                    version,
                    path: exePath,
                };
            });
        })
            .catch((err) => {
            (0, log_1.log)('error while looking up exe, trying next exePath %o', { exePath, exePaths, err });
            return tryNextExePath();
        });
    });
    return tryNextExePath();
}
function doubleEscape(s) {
    // Converts all types of paths into windows supported double backslash path
    // Handles any number of \\ in the given path
    return path_1.win32.join(...s.split(path_1.win32.sep)).replace(/\\/g, '\\\\');
}
exports.doubleEscape = doubleEscape;
function getVersionString(path) {
    // on Windows using "--version" seems to always start the full
    // browser, no matter what one does.
    const args = [
        'datafile',
        'where',
        `name="${path}"`,
        'get',
        'Version',
        '/value',
    ];
    return utils_1.utils.execa('wmic', args)
        .then((val) => val.stdout)
        .then((val) => val.trim());
}
exports.getVersionString = getVersionString;
function getVersionNumber(version) {
    if (version.indexOf('Version=') > -1) {
        return version.split('=')[1];
    }
    return version;
}
exports.getVersionNumber = getVersionNumber;
function getPathData(pathStr) {
    const test = new RegExp(/^.+\.exe:(.+)$/);
    const res = test.exec(pathStr);
    let browserKey = '';
    let path = pathStr;
    if (res) {
        const pathParts = path.split(':');
        browserKey = pathParts.pop() || '';
        path = doubleEscape(pathParts.join(':'));
        return { path, browserKey };
    }
    path = doubleEscape(path);
    if (pathStr.indexOf('chrome.exe') > -1) {
        return { path, browserKey: 'chrome' };
    }
    if (pathStr.indexOf('edge.exe') > -1) {
        return { path, browserKey: 'edge' };
    }
    if (pathStr.indexOf('firefox.exe') > -1) {
        return { path, browserKey: 'firefox' };
    }
    return { path };
}
exports.getPathData = getPathData;
function detect(browser) {
    return getWindowsBrowser(browser);
}
exports.detect = detect;
