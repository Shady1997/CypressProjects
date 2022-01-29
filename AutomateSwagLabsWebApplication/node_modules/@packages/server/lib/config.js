"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNameFromRoot = exports.getResolvedRuntimeConfig = exports.parseEnv = exports.setUrls = exports.setAbsolutePaths = exports.setParentTestsPaths = exports.setPluginsFile = exports.setSupportFileAndFolder = exports.setScaffoldPaths = exports.setNodeBinary = exports.resolveConfigValues = exports.updateWithPluginValues = exports.setPluginResolvedOn = exports.setResolvedConfigValues = exports.mergeDefaults = exports.set = exports.get = exports.isValidCypressInternalEnvValue = exports.utils = exports.RESOLVED_FROM = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const return_deep_diff_1 = (0, tslib_1.__importDefault)(require("return-deep-diff"));
const config_1 = (0, tslib_1.__importDefault)(require("../../config"));
const errors_1 = (0, tslib_1.__importDefault)(require("./errors"));
const scaffold_1 = (0, tslib_1.__importDefault)(require("./scaffold"));
const fs_1 = require("./util/fs");
const keys_1 = (0, tslib_1.__importDefault)(require("./util/keys"));
const origin_1 = (0, tslib_1.__importDefault)(require("./util/origin"));
const settings = (0, tslib_1.__importStar)(require("./util/settings"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const path_helpers_1 = (0, tslib_1.__importDefault)(require("./util/path_helpers"));
const debug = (0, debug_1.default)('cypress:server:config');
const config_2 = require("./util/config");
exports.RESOLVED_FROM = ['plugin', 'env', 'default', 'runtime', 'config'];
const folders = (0, lodash_1.default)(config_1.default.options).filter({ isFolder: true }).map('name').value();
const convertRelativeToAbsolutePaths = (projectRoot, obj) => {
    return lodash_1.default.reduce(folders, (memo, folder) => {
        const val = obj[folder];
        if ((val != null) && (val !== false)) {
            memo[folder] = path_1.default.resolve(projectRoot, val);
        }
        return memo;
    }, {});
};
const validateFile = (file) => {
    return (settings) => {
        return config_1.default.validate(settings, (errMsg) => {
            return errors_1.default.throw('SETTINGS_VALIDATION_ERROR', file, errMsg);
        });
    };
};
const hideSpecialVals = function (val, key) {
    if (lodash_1.default.includes(config_2.CYPRESS_SPECIAL_ENV_VARS, key)) {
        return keys_1.default.hide(val);
    }
    return val;
};
// an object with a few utility methods for easy stubbing from unit tests
exports.utils = {
    resolveModule(name) {
        return require.resolve(name);
    },
    // tries to find support or plugins file
    // returns:
    //   false - if the file should not be set
    //   string - found filename
    //   null - if there is an error finding the file
    discoverModuleFile(options) {
        debug('discover module file %o', options);
        const { filename, isDefault } = options;
        if (!isDefault) {
            // they have it explicitly set, so it should be there
            return fs_1.fs.pathExists(filename)
                .then((found) => {
                if (found) {
                    debug('file exists, assuming it will load');
                    return filename;
                }
                debug('could not find %o', { filename });
                return null;
            });
        }
        // support or plugins file doesn't exist on disk?
        debug(`support file is default, check if ${path_1.default.dirname(filename)} exists`);
        return fs_1.fs.pathExists(filename)
            .then((found) => {
            if (found) {
                debug('is there index.ts in the support or plugins folder %s?', filename);
                const tsFilename = path_1.default.join(filename, 'index.ts');
                return fs_1.fs.pathExists(tsFilename)
                    .then((foundTsFile) => {
                    if (foundTsFile) {
                        debug('found index TS file %s', tsFilename);
                        return tsFilename;
                    }
                    // if the directory exists, set it to false so it's ignored
                    debug('setting support or plugins file to false');
                    return false;
                });
            }
            debug('folder does not exist, set to default index.js');
            // otherwise, set it up to be scaffolded later
            return path_1.default.join(filename, 'index.js');
        });
    },
};
function isValidCypressInternalEnvValue(value) {
    // names of config environments, see "config/app.yml"
    const names = ['development', 'test', 'staging', 'production'];
    return lodash_1.default.includes(names, value);
}
exports.isValidCypressInternalEnvValue = isValidCypressInternalEnvValue;
function get(projectRoot, options = {}) {
    return bluebird_1.default.all([
        settings.read(projectRoot, options).then(validateFile('cypress.json')),
        settings.readEnv(projectRoot).then(validateFile('cypress.env.json')),
    ])
        .spread((settings, envFile) => {
        return set({
            projectName: getNameFromRoot(projectRoot),
            projectRoot,
            config: lodash_1.default.cloneDeep(settings),
            envFile: lodash_1.default.cloneDeep(envFile),
            options,
        });
    });
}
exports.get = get;
function set(obj = {}) {
    debug('setting config object');
    let { projectRoot, projectName, config, envFile, options } = obj;
    // just force config to be an object so we dont have to do as much
    // work in our tests
    if (config == null) {
        config = {};
    }
    debug('config is %o', config);
    // flatten the object's properties into the master config object
    config.envFile = envFile;
    config.projectRoot = projectRoot;
    config.projectName = projectName;
    return mergeDefaults(config, options);
}
exports.set = set;
function mergeDefaults(config = {}, options = {}) {
    var _a, _b;
    const resolved = {};
    config.rawJson = lodash_1.default.cloneDeep(config);
    lodash_1.default.extend(config, lodash_1.default.pick(options, 'configFile', 'morgan', 'isTextTerminal', 'socketId', 'report', 'browsers'));
    debug('merged config with options, got %o', config);
    lodash_1.default
        .chain(config_1.default.allowed(options))
        .omit('env')
        .omit('browsers')
        .each((val, key) => {
        resolved[key] = 'cli';
        config[key] = val;
    }).value();
    let url = config.baseUrl;
    if (url) {
        // replace multiple slashes at the end of string to single slash
        // so http://localhost/// will be http://localhost/
        // https://regexr.com/48rvt
        config.baseUrl = url.replace(/\/\/+$/, '/');
    }
    const defaultsForRuntime = config_1.default.getDefaultValues(options);
    lodash_1.default.defaultsDeep(config, defaultsForRuntime);
    // split out our own app wide env from user env variables
    // and delete envFile
    config.env = parseEnv(config, options.env, resolved);
    config.cypressEnv = process.env.CYPRESS_INTERNAL_ENV;
    debug('using CYPRESS_INTERNAL_ENV %s', config.cypressEnv);
    if (!isValidCypressInternalEnvValue(config.cypressEnv)) {
        errors_1.default.throw('INVALID_CYPRESS_INTERNAL_ENV', config.cypressEnv);
    }
    delete config.envFile;
    // when headless
    if (config.isTextTerminal && !process.env.CYPRESS_INTERNAL_FORCE_FILEWATCH) {
        // dont ever watch for file changes
        config.watchForFileChanges = false;
        // and forcibly reset numTestsKeptInMemory
        // to zero
        config.numTestsKeptInMemory = 0;
    }
    config = setResolvedConfigValues(config, defaultsForRuntime, resolved);
    if (config.port) {
        config = setUrls(config);
    }
    config = setAbsolutePaths(config);
    config = setParentTestsPaths(config);
    config = (0, exports.setNodeBinary)(config, (_a = options.args) === null || _a === void 0 ? void 0 : _a.userNodePath, (_b = options.args) === null || _b === void 0 ? void 0 : _b.userNodeVersion);
    // validate config again here so that we catch configuration errors coming
    // from the CLI overrides or env var overrides
    config_1.default.validate(lodash_1.default.omit(config, 'browsers'), (errMsg) => {
        return errors_1.default.throw('CONFIG_VALIDATION_ERROR', errMsg);
    });
    config_1.default.validateNoBreakingConfig(config, errors_1.default.warning, errors_1.default.throw);
    return setSupportFileAndFolder(config, defaultsForRuntime)
        .then((obj) => (0, exports.setPluginsFile)(obj, defaultsForRuntime))
        .then(setScaffoldPaths);
}
exports.mergeDefaults = mergeDefaults;
function setResolvedConfigValues(config, defaults, resolved) {
    const obj = lodash_1.default.clone(config);
    obj.resolved = resolveConfigValues(config, defaults, resolved);
    debug('resolved config is %o', obj.resolved.browsers);
    return obj;
}
exports.setResolvedConfigValues = setResolvedConfigValues;
// Given an object "resolvedObj" and a list of overrides in "obj"
// marks all properties from "obj" inside "resolvedObj" using
// {value: obj.val, from: "plugin"}
function setPluginResolvedOn(resolvedObj, obj) {
    return lodash_1.default.each(obj, (val, key) => {
        if (lodash_1.default.isObject(val) && !lodash_1.default.isArray(val) && resolvedObj[key]) {
            // recurse setting overrides
            // inside of objected
            return setPluginResolvedOn(resolvedObj[key], val);
        }
        const valueFrom = {
            value: val,
            from: 'plugin',
        };
        resolvedObj[key] = valueFrom;
    });
}
exports.setPluginResolvedOn = setPluginResolvedOn;
function updateWithPluginValues(cfg, overrides) {
    if (!overrides) {
        overrides = {};
    }
    debug('updateWithPluginValues %o', { cfg, overrides });
    // make sure every option returned from the plugins file
    // passes our validation functions
    config_1.default.validate(overrides, (errMsg) => {
        if (cfg.pluginsFile && cfg.projectRoot) {
            const relativePluginsPath = path_1.default.relative(cfg.projectRoot, cfg.pluginsFile);
            return errors_1.default.throw('PLUGINS_CONFIG_VALIDATION_ERROR', relativePluginsPath, errMsg);
        }
        return errors_1.default.throw('CONFIG_VALIDATION_ERROR', errMsg);
    });
    let originalResolvedBrowsers = cfg && cfg.resolved && cfg.resolved.browsers && lodash_1.default.cloneDeep(cfg.resolved.browsers);
    if (!originalResolvedBrowsers) {
        // have something to resolve with if plugins return nothing
        originalResolvedBrowsers = {
            value: cfg.browsers,
            from: 'default',
        };
    }
    const diffs = (0, return_deep_diff_1.default)(cfg, overrides, true);
    debug('config diffs %o', diffs);
    const userBrowserList = diffs && diffs.browsers && lodash_1.default.cloneDeep(diffs.browsers);
    if (userBrowserList) {
        debug('user browser list %o', userBrowserList);
    }
    // for each override go through
    // and change the resolved values of cfg
    // to point to the plugin
    if (diffs) {
        debug('resolved config before diffs %o', cfg.resolved);
        setPluginResolvedOn(cfg.resolved, diffs);
        debug('resolved config object %o', cfg.resolved);
    }
    // merge cfg into overrides
    const merged = lodash_1.default.defaultsDeep(diffs, cfg);
    debug('merged config object %o', merged);
    // the above _.defaultsDeep combines arrays,
    // if diffs.browsers = [1] and cfg.browsers = [1, 2]
    // then the merged result merged.browsers = [1, 2]
    // which is NOT what we want
    if (Array.isArray(userBrowserList) && userBrowserList.length) {
        merged.browsers = userBrowserList;
        merged.resolved.browsers.value = userBrowserList;
    }
    if (overrides.browsers === null) {
        // null breaks everything when merging lists
        debug('replacing null browsers with original list %o', originalResolvedBrowsers);
        merged.browsers = cfg.browsers;
        if (originalResolvedBrowsers) {
            merged.resolved.browsers = originalResolvedBrowsers;
        }
    }
    debug('merged plugins config %o', merged);
    return merged;
}
exports.updateWithPluginValues = updateWithPluginValues;
// combines the default configuration object with values specified in the
// configuration file like "cypress.json". Values in configuration file
// overwrite the defaults.
function resolveConfigValues(config, defaults, resolved = {}) {
    // pick out only known configuration keys
    return lodash_1.default
        .chain(config)
        .pick(config_1.default.getPublicConfigKeys())
        .mapValues((val, key) => {
        let r;
        const source = (s) => {
            return {
                value: val,
                from: s,
            };
        };
        r = resolved[key];
        if (r) {
            if (lodash_1.default.isObject(r)) {
                return r;
            }
            return source(r);
        }
        if (!(!lodash_1.default.isEqual(config[key], defaults[key]) && key !== 'browsers')) {
            // "browsers" list is special, since it is dynamic by default
            // and can only be overwritten via plugins file
            return source('default');
        }
        return source('config');
    }).value();
}
exports.resolveConfigValues = resolveConfigValues;
// instead of the built-in Node process, specify a path to 3rd party Node
const setNodeBinary = (obj, userNodePath, userNodeVersion) => {
    // if execPath isn't found we weren't executed from the CLI and should used the bundled node version.
    if (userNodePath && userNodeVersion && obj.nodeVersion !== 'bundled') {
        obj.resolvedNodePath = userNodePath;
        obj.resolvedNodeVersion = userNodeVersion;
        return obj;
    }
    obj.resolvedNodeVersion = process.versions.node;
    return obj;
};
exports.setNodeBinary = setNodeBinary;
function setScaffoldPaths(obj) {
    obj = lodash_1.default.clone(obj);
    debug('set scaffold paths');
    return scaffold_1.default.fileTree(obj)
        .then((fileTree) => {
        debug('got file tree');
        obj.scaffoldedFiles = fileTree;
        return obj;
    });
}
exports.setScaffoldPaths = setScaffoldPaths;
// async function
function setSupportFileAndFolder(obj, defaults) {
    if (!obj.supportFile) {
        return bluebird_1.default.resolve(obj);
    }
    obj = lodash_1.default.clone(obj);
    // TODO move this logic to find support file into util/path_helpers
    const sf = obj.supportFile;
    debug(`setting support file ${sf}`);
    debug(`for project root ${obj.projectRoot}`);
    return bluebird_1.default
        .try(() => {
        // resolve full path with extension
        obj.supportFile = exports.utils.resolveModule(sf);
        return debug('resolved support file %s', obj.supportFile);
    }).then(() => {
        if (!path_helpers_1.default.checkIfResolveChangedRootFolder(obj.supportFile, sf)) {
            return;
        }
        debug('require.resolve switched support folder from %s to %s', sf, obj.supportFile);
        // this means the path was probably symlinked, like
        // /tmp/foo -> /private/tmp/foo
        // which can confuse the rest of the code
        // switch it back to "normal" file
        obj.supportFile = path_1.default.join(sf, path_1.default.basename(obj.supportFile));
        return fs_1.fs.pathExists(obj.supportFile)
            .then((found) => {
            if (!found) {
                errors_1.default.throw('SUPPORT_FILE_NOT_FOUND', obj.supportFile, obj.configFile || defaults.configFile);
            }
            return debug('switching to found file %s', obj.supportFile);
        });
    }).catch({ code: 'MODULE_NOT_FOUND' }, () => {
        debug('support JS module %s does not load', sf);
        const loadingDefaultSupportFile = sf === path_1.default.resolve(obj.projectRoot, defaults.supportFile);
        return exports.utils.discoverModuleFile({
            filename: sf,
            isDefault: loadingDefaultSupportFile,
            projectRoot: obj.projectRoot,
        })
            .then((result) => {
            if (result === null) {
                const configFile = obj.configFile || defaults.configFile;
                return errors_1.default.throw('SUPPORT_FILE_NOT_FOUND', path_1.default.resolve(obj.projectRoot, sf), configFile);
            }
            debug('setting support file to %o', { result });
            obj.supportFile = result;
            return obj;
        });
    })
        .then(() => {
        if (obj.supportFile) {
            // set config.supportFolder to its directory
            obj.supportFolder = path_1.default.dirname(obj.supportFile);
            debug(`set support folder ${obj.supportFolder}`);
        }
        return obj;
    });
}
exports.setSupportFileAndFolder = setSupportFileAndFolder;
// set pluginsFile to an absolute path with the following rules:
// - do nothing if pluginsFile is falsey
// - look up the absolute path via node, so 'cypress/plugins' can resolve
//   to 'cypress/plugins/index.js' or 'cypress/plugins/index.coffee'
// - if not found
//   * and the pluginsFile is set to the default
//     - and the path to the pluginsFile directory exists
//       * assume the user doesn't need a pluginsFile, set it to false
//         so it's ignored down the pipeline
//     - and the path to the pluginsFile directory does not exist
//       * set it to cypress/plugins/index.js, it will get scaffolded
//   * and the pluginsFile is NOT set to the default
//     - throw an error, because it should be there if the user
//       explicitly set it
exports.setPluginsFile = bluebird_1.default.method((obj, defaults) => {
    if (!obj.pluginsFile) {
        return obj;
    }
    obj = lodash_1.default.clone(obj);
    const { pluginsFile, } = obj;
    debug(`setting plugins file ${pluginsFile}`);
    debug(`for project root ${obj.projectRoot}`);
    return bluebird_1.default
        .try(() => {
        // resolve full path with extension
        obj.pluginsFile = exports.utils.resolveModule(pluginsFile);
        return debug(`set pluginsFile to ${obj.pluginsFile}`);
    }).catch({ code: 'MODULE_NOT_FOUND' }, () => {
        debug('plugins module does not exist %o', { pluginsFile });
        const isLoadingDefaultPluginsFile = pluginsFile === path_1.default.resolve(obj.projectRoot, defaults.pluginsFile);
        return exports.utils.discoverModuleFile({
            filename: pluginsFile,
            isDefault: isLoadingDefaultPluginsFile,
            projectRoot: obj.projectRoot,
        })
            .then((result) => {
            if (result === null) {
                return errors_1.default.throw('PLUGINS_FILE_ERROR', path_1.default.resolve(obj.projectRoot, pluginsFile));
            }
            debug('setting plugins file to %o', { result });
            obj.pluginsFile = result;
            return obj;
        });
    }).return(obj);
});
function setParentTestsPaths(obj) {
    // projectRoot:              "/path/to/project"
    // integrationFolder:        "/path/to/project/cypress/integration"
    // componentFolder:          "/path/to/project/cypress/components"
    // parentTestsFolder:        "/path/to/project/cypress"
    // parentTestsFolderDisplay: "project/cypress"
    obj = lodash_1.default.clone(obj);
    const ptfd = (obj.parentTestsFolder = path_1.default.dirname(obj.integrationFolder));
    const prd = path_1.default.dirname(obj.projectRoot != null ? obj.projectRoot : '');
    obj.parentTestsFolderDisplay = path_1.default.relative(prd, ptfd);
    return obj;
}
exports.setParentTestsPaths = setParentTestsPaths;
function setAbsolutePaths(obj) {
    let pr;
    obj = lodash_1.default.clone(obj);
    // if we have a projectRoot
    pr = obj.projectRoot;
    if (pr) {
        // reset fileServerFolder to be absolute
        // obj.fileServerFolder = path.resolve(pr, obj.fileServerFolder)
        // and do the same for all the rest
        lodash_1.default.extend(obj, convertRelativeToAbsolutePaths(pr, obj));
    }
    return obj;
}
exports.setAbsolutePaths = setAbsolutePaths;
function setUrls(obj) {
    obj = lodash_1.default.clone(obj);
    // TODO: rename this to be proxyServer
    const proxyUrl = `http://localhost:${obj.port}`;
    const rootUrl = obj.baseUrl ?
        (0, origin_1.default)(obj.baseUrl)
        :
            proxyUrl;
    lodash_1.default.extend(obj, {
        proxyUrl,
        browserUrl: rootUrl + obj.clientRoute,
        reporterUrl: rootUrl + obj.reporterRoute,
        xhrUrl: obj.namespace + obj.xhrRoute,
    });
    return obj;
}
exports.setUrls = setUrls;
function parseEnv(cfg, envCLI, resolved = {}) {
    const envVars = (resolved.env = {});
    const resolveFrom = (from, obj = {}) => {
        return lodash_1.default.each(obj, (val, key) => {
            return envVars[key] = {
                value: val,
                from,
            };
        });
    };
    const envCfg = cfg.env != null ? cfg.env : {};
    const envFile = cfg.envFile != null ? cfg.envFile : {};
    let envProc = (0, config_2.getProcessEnvVars)(process.env) || {};
    envCLI = envCLI != null ? envCLI : {};
    const configFromEnv = lodash_1.default.reduce(envProc, (memo, val, key) => {
        let cfgKey;
        cfgKey = config_1.default.matchesConfigKey(key);
        if (cfgKey) {
            // only change the value if it hasn't been
            // set by the CLI. override default + config
            if (resolved[cfgKey] !== 'cli') {
                cfg[cfgKey] = val;
                resolved[cfgKey] = {
                    value: val,
                    from: 'env',
                };
            }
            memo.push(key);
        }
        return memo;
    }, []);
    envProc = lodash_1.default.chain(envProc)
        .omit(configFromEnv)
        .mapValues(hideSpecialVals)
        .value();
    resolveFrom('config', envCfg);
    resolveFrom('envFile', envFile);
    resolveFrom('env', envProc);
    resolveFrom('cli', envCLI);
    // envCfg is from cypress.json
    // envFile is from cypress.env.json
    // envProc is from process env vars
    // envCLI is from CLI arguments
    return lodash_1.default.extend(envCfg, envFile, envProc, envCLI);
}
exports.parseEnv = parseEnv;
function getResolvedRuntimeConfig(config, runtimeConfig) {
    const resolvedRuntimeFields = lodash_1.default.mapValues(runtimeConfig, (v) => ({ value: v, from: 'runtime' }));
    return Object.assign(Object.assign(Object.assign({}, config), runtimeConfig), { resolved: Object.assign(Object.assign({}, config.resolved), resolvedRuntimeFields) });
}
exports.getResolvedRuntimeConfig = getResolvedRuntimeConfig;
function getNameFromRoot(root = '') {
    return path_1.default.basename(root);
}
exports.getNameFromRoot = getNameFromRoot;
