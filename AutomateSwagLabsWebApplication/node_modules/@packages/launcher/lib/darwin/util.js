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
Object.defineProperty(exports, "__esModule", { value: true });
exports.darwinDetectionWorkaround = exports.needsDarwinWorkaround = exports.findApp = exports.mdfind = exports.parsePlist = void 0;
const log_1 = require("../log");
const errors_1 = require("../errors");
const utils_1 = require("../utils");
const fs = __importStar(require("fs-extra"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const plist = __importStar(require("plist"));
const semver = __importStar(require("semver"));
const findSystemNode = __importStar(require("../../../server/lib/util/find_system_node"));
/** parses Info.plist file from given application and returns a property */
function parsePlist(p, property) {
    const pl = path.join(p, 'Contents', 'Info.plist');
    (0, log_1.log)('reading property file "%s"', pl);
    const failed = (e) => {
        const msg = `Info.plist not found: ${pl}
    ${e.message}`;
        (0, log_1.log)('could not read Info.plist %o', { pl, e });
        throw (0, errors_1.notInstalledErr)('', msg);
    };
    return fs
        .readFile(pl, 'utf8')
        .then(plist.parse)
        .then((val) => val[property])
        .then(String) // explicitly convert value to String type
        .catch(failed); // to make TS compiler happy
}
exports.parsePlist = parsePlist;
/** uses mdfind to find app using Ma app id like 'com.google.Chrome.canary' */
function mdfind(id) {
    const cmd = `mdfind 'kMDItemCFBundleIdentifier=="${id}"' | head -1`;
    (0, log_1.log)('looking for bundle id %s using command: %s', id, cmd);
    const logFound = (str) => {
        (0, log_1.log)('found %s at %s', id, str);
        return str;
    };
    const failedToFind = () => {
        (0, log_1.log)('could not find %s', id);
        throw (0, errors_1.notInstalledErr)(id);
    };
    return utils_1.utils.execa(cmd)
        .then((val) => {
        return val.stdout;
    })
        .then((val) => {
        logFound(val);
        return val;
    })
        .catch(failedToFind);
}
exports.mdfind = mdfind;
function formApplicationPath(appName) {
    return path.join('/Applications', appName);
}
/** finds an application and its version */
function findApp({ appName, executable, appId, versionProperty }) {
    (0, log_1.log)('looking for app %s id %s', executable, appId);
    const findVersion = (foundPath) => {
        return parsePlist(foundPath, versionProperty).then((version) => {
            (0, log_1.log)('got plist: %o', { foundPath, version });
            return {
                path: path.join(foundPath, executable),
                version,
            };
        });
    };
    const tryMdFind = () => {
        return mdfind(appId).then(findVersion);
    };
    const tryFullApplicationFind = () => {
        const applicationPath = formApplicationPath(appName);
        (0, log_1.log)('looking for application %s', applicationPath);
        return findVersion(applicationPath);
    };
    return tryMdFind().catch(tryFullApplicationFind);
}
exports.findApp = findApp;
function needsDarwinWorkaround() {
    return os.platform() === 'darwin' && semver.gte(os.release(), '20.0.0');
}
exports.needsDarwinWorkaround = needsDarwinWorkaround;
function darwinDetectionWorkaround() {
    return __awaiter(this, void 0, void 0, function* () {
        const nodePath = yield findSystemNode.findNodeInFullPath();
        let args = ['./detection-workaround.js'];
        if (process.env.CYPRESS_INTERNAL_ENV === 'development') {
            args = ['-r', '@packages/ts/register.js', './detection-workaround.ts'];
        }
        const { stdout } = yield utils_1.utils.execa(nodePath, args, { cwd: __dirname });
        return JSON.parse(stdout);
    });
}
exports.darwinDetectionWorkaround = darwinDetectionWorkaround;
