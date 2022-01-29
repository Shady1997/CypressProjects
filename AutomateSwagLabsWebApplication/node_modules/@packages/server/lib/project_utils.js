"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultConfigFilePath = exports.checkSupportFile = exports.getSpecUrl = void 0;
const tslib_1 = require("tslib");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const settings = (0, tslib_1.__importStar)(require("./util/settings"));
const errors_1 = (0, tslib_1.__importDefault)(require("./errors"));
const fs_1 = require("./util/fs");
const escape_filename_1 = require("./util/escape_filename");
const configFiles_1 = require("./configFiles");
const debug = (0, debug_1.default)('cypress:server:project_utils');
const multipleForwardSlashesRe = /[^:\/\/](\/{2,})/g;
const backSlashesRe = /\\/g;
const normalizeSpecUrl = (browserUrl, specUrl) => {
    const replacer = (match) => match.replace('//', '/');
    return [
        browserUrl,
        '#/tests',
        (0, escape_filename_1.escapeFilenameInUrl)(specUrl),
    ].join('/')
        .replace(multipleForwardSlashesRe, replacer);
};
const getPrefixedPathToSpec = ({ integrationFolder, componentFolder, projectRoot, type, pathToSpec, }) => {
    type !== null && type !== void 0 ? type : (type = 'integration');
    // for now hard code the 'type' as integration
    // but in the future accept something different here
    // strip out the integration folder and prepend with "/"
    // example:
    //
    // /Users/bmann/Dev/cypress-app/.projects/cypress/integration
    // /Users/bmann/Dev/cypress-app/.projects/cypress/integration/foo.js
    //
    // becomes /integration/foo.js
    const folderToUse = type === 'integration' ? integrationFolder : componentFolder;
    // To avoid having invalid urls from containing backslashes,
    // we normalize specUrls to posix by replacing backslash by slash
    // Indeed, path.realtive will return something different on windows
    // than on posix systems which can lead to problems
    const url = `/${path_1.default.join(type, path_1.default.relative(folderToUse, path_1.default.resolve(projectRoot, pathToSpec))).replace(backSlashesRe, '/')}`;
    debug('prefixed path for spec %o', { pathToSpec, type, url });
    return url;
};
const getSpecUrl = ({ absoluteSpecPath, specType, browserUrl, integrationFolder, componentFolder, projectRoot, }) => {
    specType !== null && specType !== void 0 ? specType : (specType = 'integration');
    browserUrl !== null && browserUrl !== void 0 ? browserUrl : (browserUrl = '');
    debug('get spec url: %s for spec type %s', absoluteSpecPath, specType);
    // if we don't have a absoluteSpecPath or its __all
    if (!absoluteSpecPath || (absoluteSpecPath === '__all')) {
        const url = normalizeSpecUrl(browserUrl, '/__all');
        debug('returning url to run all specs: %s', url);
        return url;
    }
    // TODO:
    // to handle both unit + integration tests we need
    // to figure out (based on the config) where this absoluteSpecPath
    // lives. does it live in the integrationFolder or
    // the unit folder?
    // once we determine that we can then prefix it correctly
    // with either integration or unit
    const prefixedPath = getPrefixedPathToSpec({
        integrationFolder,
        componentFolder,
        projectRoot,
        pathToSpec: absoluteSpecPath,
        type: specType,
    });
    const url = normalizeSpecUrl(browserUrl, prefixedPath);
    debug('return path to spec %o', { specType, absoluteSpecPath, prefixedPath, url });
    return url;
};
exports.getSpecUrl = getSpecUrl;
const checkSupportFile = ({ supportFile, configFile, }) => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    if (supportFile && typeof supportFile === 'string') {
        const found = yield fs_1.fs.pathExists(supportFile);
        if (!found) {
            errors_1.default.throw('SUPPORT_FILE_NOT_FOUND', supportFile, settings.configFile({ configFile }));
        }
    }
    return;
});
exports.checkSupportFile = checkSupportFile;
function getDefaultConfigFilePath(projectRoot, returnDefaultValueIfNotFound = true) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const filesInProjectDir = yield fs_1.fs.readdir(projectRoot);
        const foundConfigFiles = configFiles_1.CYPRESS_CONFIG_FILES.filter((file) => filesInProjectDir.includes(file));
        // if we only found one default file, it is the one
        if (foundConfigFiles.length === 1) {
            return foundConfigFiles[0];
        }
        // if we found more than one, throw a language conflict
        if (foundConfigFiles.length > 1) {
            throw errors_1.default.throw('CONFIG_FILES_LANGUAGE_CONFLICT', projectRoot, ...foundConfigFiles);
        }
        if (returnDefaultValueIfNotFound) {
            // Default is to create a new `cypress.json` file if one does not exist.
            return configFiles_1.CYPRESS_CONFIG_FILES[0];
        }
        throw errors_1.default.get('NO_DEFAULT_CONFIG_FILE_FOUND', projectRoot);
    });
}
exports.getDefaultConfigFilePath = getDefaultConfigFilePath;
