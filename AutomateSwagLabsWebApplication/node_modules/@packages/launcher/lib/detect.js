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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectByPath = exports.detect = exports.setMajorVersion = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const lodash_1 = __importStar(require("lodash"));
const os_1 = __importDefault(require("os"));
const browsers_1 = require("./browsers");
const darwinHelper = __importStar(require("./darwin"));
const util_1 = require("./darwin/util");
const errors_1 = require("./errors");
const linuxHelper = __importStar(require("./linux"));
const log_1 = require("./log");
const windowsHelper = __importStar(require("./windows"));
const setMajorVersion = (browser) => {
    const majorVersion = parseInt(browser.version.split('.')[0]) || browser.version;
    const unsupportedVersion = browser.minSupportedVersion && majorVersion < browser.minSupportedVersion;
    (0, log_1.log)('browser %s version %s major version %s', browser.name, browser.version, majorVersion, unsupportedVersion);
    const foundBrowser = (0, lodash_1.extend)({}, browser, { majorVersion });
    if (unsupportedVersion) {
        foundBrowser.unsupportedVersion = true;
        foundBrowser.warning = `Cypress does not support running ${browser.displayName} version ${majorVersion}. To use ${browser.displayName} with Cypress, install a version of ${browser.displayName} newer than or equal to ${browser.minSupportedVersion}.`;
    }
    return foundBrowser;
};
exports.setMajorVersion = setMajorVersion;
const helpers = {
    darwin: darwinHelper,
    linux: linuxHelper,
    win32: windowsHelper,
};
function getHelper(platform) {
    return helpers[platform || os_1.default.platform()];
}
function lookup(platform, browser) {
    (0, log_1.log)('looking up %s on %s platform', browser.name, platform);
    const helper = getHelper(platform);
    if (!helper) {
        throw new Error(`Cannot lookup browser ${browser.name} on ${platform}`);
    }
    return helper.detect(browser);
}
/**
 * Try to detect a single browser definition, which may dispatch multiple `checkOneBrowser` calls,
 * one for each binary. If Windows is detected, only one `checkOneBrowser` will be called, because
 * we don't use the `binary` field on Windows.
 */
function checkBrowser(browser) {
    if (Array.isArray(browser.binary) && os_1.default.platform() !== 'win32') {
        return bluebird_1.default.map(browser.binary, (binary) => {
            return checkOneBrowser((0, lodash_1.extend)({}, browser, { binary }));
        });
    }
    return bluebird_1.default.map([browser], checkOneBrowser);
}
function checkOneBrowser(browser) {
    const platform = os_1.default.platform();
    const pickBrowserProps = [
        'name',
        'family',
        'channel',
        'displayName',
        'type',
        'version',
        'path',
        'profilePath',
        'custom',
        'warning',
        'info',
        'minSupportedVersion',
        'unsupportedVersion',
    ];
    const logBrowser = (props) => {
        (0, log_1.log)('setting major version for %j', props);
    };
    const failed = (err) => {
        if (err.notInstalled) {
            (0, log_1.log)('browser %s not installed', browser.name);
            return false;
        }
        throw err;
    };
    (0, log_1.log)('checking one browser %s', browser.name);
    return lookup(platform, browser)
        .then((val) => (Object.assign(Object.assign({}, browser), val)))
        .then((val) => lodash_1.default.pick(val, pickBrowserProps))
        .then((val) => {
        logBrowser(val);
        return val;
    })
        .then((browser) => (0, exports.setMajorVersion)(browser))
        .catch(failed);
}
/** returns list of detected browsers */
const detect = (goalBrowsers, useDarwinWorkaround = true) => {
    // we can detect same browser under different aliases
    // tell them apart by the name and the version property
    if (!goalBrowsers) {
        goalBrowsers = browsers_1.browsers;
    }
    // BigSur (darwin 20.x) and Electron 12+ cause huge performance issues when
    // spawning child processes, which is the way we find browsers via execa.
    // The performance cost is multiplied by the number of binary variants of
    // each browser plus any fallback lookups we do.
    // The workaround gets around this by breaking out of the bundled Electron
    // Node.js and using the user's Node.js if possible. It only pays the cost
    // of spawning a single child process instead of multiple. If this fails,
    // we fall back to to the slower, default method
    // https://github.com/cypress-io/cypress/issues/17773
    if (useDarwinWorkaround && (0, util_1.needsDarwinWorkaround)()) {
        (0, log_1.log)('using darwin detection workaround');
        if (log_1.log.enabled) {
            // eslint-disable-next-line no-console
            console.time('time taken detecting browsers (darwin workaround)');
        }
        return bluebird_1.default.resolve((0, util_1.darwinDetectionWorkaround)())
            .catch((err) => {
            (0, log_1.log)('darwin workaround failed, falling back to normal detection');
            (0, log_1.log)(err.stack);
            return (0, exports.detect)(goalBrowsers, false);
        })
            .finally(() => {
            if (log_1.log.enabled) {
                // eslint-disable-next-line no-console
                console.timeEnd('time taken detecting browsers (darwin workaround)');
            }
        });
    }
    const removeDuplicates = (val) => {
        return lodash_1.default.uniqBy(val, (browser) => {
            return `${browser.name}-${browser.version}`;
        });
    };
    const compactFalse = (browsers) => {
        return (0, lodash_1.compact)(browsers);
    };
    (0, log_1.log)('detecting if the following browsers are present %o', goalBrowsers);
    return bluebird_1.default.mapSeries(goalBrowsers, checkBrowser)
        .then((val) => lodash_1.default.flatten(val))
        .then(compactFalse)
        .then(removeDuplicates);
};
exports.detect = detect;
const detectByPath = (path, goalBrowsers) => {
    if (!goalBrowsers) {
        goalBrowsers = browsers_1.browsers;
    }
    const helper = getHelper();
    const detectBrowserByVersionString = (stdout) => {
        return (0, lodash_1.find)(goalBrowsers, (goalBrowser) => {
            return goalBrowser.versionRegex.test(stdout);
        });
    };
    const detectBrowserFromKey = (browserKey) => {
        return (0, lodash_1.find)(goalBrowsers, (goalBrowser) => {
            return (goalBrowser.name === browserKey ||
                goalBrowser.displayName === browserKey ||
                goalBrowser.binary.indexOf(browserKey) > -1);
        });
    };
    const setCustomBrowserData = (browser, path, versionStr) => {
        const version = helper.getVersionNumber(versionStr, browser);
        let parsedBrowser = (0, lodash_1.extend)({}, browser, {
            name: browser.name,
            displayName: `Custom ${browser.displayName}`,
            info: `Loaded from ${path}`,
            custom: true,
            path,
            version,
        });
        return (0, exports.setMajorVersion)(parsedBrowser);
    };
    const pathData = helper.getPathData(path);
    return helper.getVersionString(pathData.path)
        .then((version) => {
        let browser;
        if (pathData.browserKey) {
            browser = detectBrowserFromKey(pathData.browserKey);
        }
        if (!browser) {
            browser = detectBrowserByVersionString(version);
        }
        if (!browser) {
            throw (0, errors_1.notDetectedAtPathErr)(`Unable to find browser with path ${path}`);
        }
        return setCustomBrowserData(browser, pathData.path, version);
    })
        .catch((err) => {
        if (err.notDetectedAtPath) {
            throw err;
        }
        throw (0, errors_1.notDetectedAtPathErr)(err.message);
    });
};
exports.detectByPath = detectByPath;
