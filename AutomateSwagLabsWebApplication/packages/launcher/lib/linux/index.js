"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detect = exports.getPathData = exports.getVersionNumber = exports.getVersionString = void 0;
const log_1 = require("../log");
const errors_1 = require("../errors");
const utils_1 = require("../utils");
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const bluebird_1 = __importDefault(require("bluebird"));
function getLinuxBrowser(name, binary, versionRegex) {
    const foundBrowser = {
        name,
        path: binary,
    };
    const getVersion = (stdout) => {
        const m = versionRegex.exec(stdout);
        if (m) {
            return m[1];
        }
        (0, log_1.log)('Could not extract version from stdout using regex: %o', {
            stdout,
            versionRegex,
        });
        throw (0, errors_1.notInstalledErr)(binary);
    };
    const logAndThrowError = (err) => {
        (0, log_1.log)('Received error detecting browser binary: "%s" with error:', binary, err.message);
        throw (0, errors_1.notInstalledErr)(binary);
    };
    const maybeSetSnapProfilePath = (versionString) => {
        if (os_1.default.platform() === 'linux' && name === 'chromium' && versionString.endsWith('snap')) {
            // when running as a snap, chromium can only write to certain directories
            // @see https://github.com/cypress-io/cypress/issues/7020
            foundBrowser.profilePath = path_1.default.join(os_1.default.homedir(), 'snap', 'chromium', 'current');
        }
    };
    return getVersionString(binary)
        .tap(maybeSetSnapProfilePath)
        .then(getVersion)
        .then((version) => {
        foundBrowser.version = version;
        return foundBrowser;
    })
        .catch(logAndThrowError);
}
function getVersionString(path) {
    (0, log_1.log)('finding version string using command "%s --version"', path);
    return bluebird_1.default.resolve(utils_1.utils.getOutput(path, ['--version']))
        .timeout(30000, `Timed out after 30 seconds getting browser version for ${path}`)
        .then((val) => val.stdout)
        .then((val) => val.trim())
        .then((val) => {
        (0, log_1.log)('stdout: %s', val);
        return val;
    });
}
exports.getVersionString = getVersionString;
function getVersionNumber(version, browser) {
    const regexExec = browser.versionRegex.exec(version);
    return regexExec ? regexExec[1] : version;
}
exports.getVersionNumber = getVersionNumber;
function getPathData(pathStr) {
    return { path: pathStr };
}
exports.getPathData = getPathData;
function detect(browser) {
    return getLinuxBrowser(browser.name, browser.binary, browser.versionRegex);
}
exports.detect = detect;
