"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathToCypressEnvJson = exports.pathToConfigFile = exports.write = exports.readEnv = exports.read = exports.id = exports.configFile = exports.isComponentTesting = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const errors_1 = (0, tslib_1.__importDefault)(require("../errors"));
const fs_1 = require("../util/fs");
const require_async_1 = require("./require_async");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const debug = (0, debug_1.default)('cypress:server:settings');
function jsCode(obj) {
    const objJSON = obj && !lodash_1.default.isEmpty(obj)
        ? JSON.stringify(lodash_1.default.omit(obj, 'configFile'), null, 2)
        : `{

}`;
    return `module.exports = ${objJSON}
`;
}
// TODO:
// think about adding another PSemaphore
// here since we can read + write the
// settings at the same time something else
// is potentially reading it
const flattenCypress = (obj) => {
    return obj.cypress ? obj.cypress : undefined;
};
const renameVisitToPageLoad = (obj) => {
    const v = obj.visitTimeout;
    if (v) {
        obj = lodash_1.default.omit(obj, 'visitTimeout');
        obj.pageLoadTimeout = v;
        return obj;
    }
};
const renameCommandTimeout = (obj) => {
    const c = obj.commandTimeout;
    if (c) {
        obj = lodash_1.default.omit(obj, 'commandTimeout');
        obj.defaultCommandTimeout = c;
        return obj;
    }
};
const renameSupportFolder = (obj) => {
    const sf = obj.supportFolder;
    if (sf) {
        obj = lodash_1.default.omit(obj, 'supportFolder');
        obj.supportFile = sf;
        return obj;
    }
};
function _pathToFile(projectRoot, file) {
    return path_1.default.isAbsolute(file) ? file : path_1.default.join(projectRoot, file);
}
function _err(type, file, err) {
    const e = errors_1.default.get(type, file, err);
    e.code = err.code;
    e.errno = err.errno;
    throw e;
}
function _logReadErr(file, err) {
    errors_1.default.throw('ERROR_READING_FILE', file, err);
}
function _logWriteErr(file, err) {
    return _err('ERROR_WRITING_FILE', file, err);
}
function _write(file, obj = {}) {
    if (/\.json$/.test(file)) {
        debug('writing json file');
        return fs_1.fs.outputJson(file, obj, { spaces: 2 })
            .then(() => obj)
            .catch((err) => {
            return _logWriteErr(file, err);
        });
    }
    debug('writing javascript file');
    return fs_1.fs.writeFileAsync(file, jsCode(obj))
        .return(obj)
        .catch((err) => {
        return _logWriteErr(file, err);
    });
}
function _applyRewriteRules(obj = {}) {
    return lodash_1.default.reduce([flattenCypress, renameVisitToPageLoad, renameCommandTimeout, renameSupportFolder], (memo, fn) => {
        const ret = fn(memo);
        return ret ? ret : memo;
    }, lodash_1.default.cloneDeep(obj));
}
function isComponentTesting(options = {}) {
    return options.testingType === 'component';
}
exports.isComponentTesting = isComponentTesting;
function configFile(options = {}) {
    // default is only used in tests.
    // This prevents a the change from becoming bigger than it should
    // FIXME: remove the default
    return options.configFile === false ? false : (options.configFile || 'cypress.json');
}
exports.configFile = configFile;
function id(projectRoot, options = {}) {
    const file = pathToConfigFile(projectRoot, options);
    return fs_1.fs.readJson(file)
        .then((config) => config.projectId)
        .catch(() => {
        return null;
    });
}
exports.id = id;
function read(projectRoot, options = {}) {
    if (options.configFile === false) {
        return bluebird_1.default.resolve({});
    }
    const file = pathToConfigFile(projectRoot, options);
    const readPromise = /\.json$/.test(file) ? fs_1.fs.readJSON(path_1.default.resolve(projectRoot, file)) : (0, require_async_1.requireAsync)(file, {
        projectRoot,
        loadErrorCode: 'CONFIG_FILE_ERROR',
    });
    return readPromise
        .catch((err) => {
        var _a;
        if (err.type === 'MODULE_NOT_FOUND' || err.code === 'ENOENT') {
            if ((_a = options.args) === null || _a === void 0 ? void 0 : _a.runProject) {
                return bluebird_1.default.reject(errors_1.default.get('CONFIG_FILE_NOT_FOUND', options.configFile, projectRoot));
            }
            return _write(file, {});
        }
        return bluebird_1.default.reject(err);
    })
        .then((configObject = {}) => {
        if (isComponentTesting(options) && 'component' in configObject) {
            configObject = Object.assign(Object.assign({}, configObject), configObject.component);
        }
        if (!isComponentTesting(options) && 'e2e' in configObject) {
            configObject = Object.assign(Object.assign({}, configObject), configObject.e2e);
        }
        debug('resolved configObject', configObject);
        const changed = _applyRewriteRules(configObject);
        // if our object is unchanged
        // then just return it
        if (lodash_1.default.isEqual(configObject, changed)) {
            return configObject;
        }
        // else write the new reduced obj
        return _write(file, changed)
            .then((config) => {
            return config;
        });
    }).catch((err) => {
        debug('an error occurred when reading config', err);
        if (errors_1.default.isCypressErr(err)) {
            throw err;
        }
        return _logReadErr(file, err);
    });
}
exports.read = read;
function readEnv(projectRoot) {
    const file = pathToCypressEnvJson(projectRoot);
    return fs_1.fs.readJson(file)
        .catch((err) => {
        if (err.code === 'ENOENT') {
            return {};
        }
        if (errors_1.default.isCypressErr(err)) {
            throw err;
        }
        return _logReadErr(file, err);
    });
}
exports.readEnv = readEnv;
function write(projectRoot, obj = {}, options = {}) {
    if (options.configFile === false) {
        return bluebird_1.default.resolve({});
    }
    return read(projectRoot, options)
        .then((settings) => {
        lodash_1.default.extend(settings, obj);
        const file = pathToConfigFile(projectRoot, options);
        return _write(file, settings);
    });
}
exports.write = write;
function pathToConfigFile(projectRoot, options = {}) {
    const file = configFile(options);
    return file && _pathToFile(projectRoot, file);
}
exports.pathToConfigFile = pathToConfigFile;
function pathToCypressEnvJson(projectRoot) {
    return _pathToFile(projectRoot, 'cypress.env.json');
}
exports.pathToCypressEnvJson = pathToCypressEnvJson;
