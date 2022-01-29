"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const lazy_ass_1 = (0, tslib_1.__importDefault)(require("lazy-ass"));
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const check_more_types_1 = (0, tslib_1.__importDefault)(require("check-more-types"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const minimatch_1 = (0, tslib_1.__importDefault)(require("minimatch"));
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const pluralize_1 = (0, tslib_1.__importDefault)(require("pluralize"));
const glob_1 = (0, tslib_1.__importDefault)(require("./glob"));
const cli_table3_1 = (0, tslib_1.__importDefault)(require("cli-table3"));
const debug = (0, debug_1.default)('cypress:server:specs');
const MINIMATCH_OPTIONS = { dot: true, matchBase: true };
/**
 * Enums to help keep track of what types of spec files we find.
 * By default, every spec file is assumed to be integration.
*/
const SPEC_TYPES = {
    INTEGRATION: 'integration',
    COMPONENT: 'component',
};
const getPatternRelativeToProjectRoot = (specPattern, projectRoot) => {
    return lodash_1.default.map(specPattern, (p) => {
        return path_1.default.relative(projectRoot, p);
    });
};
/**
 * Finds all spec files that pass the config for given type. Note that "commonSearchOptions" is
 * a subset of the project's "config" object
 */
function findSpecsOfType(searchFolder, commonSearchOptions, specPattern) {
    let fixturesFolderPath = undefined;
    // @ts-ignore - types are incorrect
    (0, lazy_ass_1.default)(check_more_types_1.default.maybe.strings(specPattern), 'invalid spec pattern', specPattern);
    (0, lazy_ass_1.default)(check_more_types_1.default.unemptyString(searchFolder), 'expected spec folder path in', commonSearchOptions);
    debug('looking for test specs in the folder:', searchFolder);
    if (specPattern) {
        debug('spec pattern "%s"', specPattern);
    }
    else {
        debug('there is no spec pattern');
    }
    // support files are not automatically
    // ignored because only _fixtures are hard
    // coded. the rest is simply whatever is in
    // the javascripts array
    if (typeof commonSearchOptions.fixturesFolder === 'string' && commonSearchOptions.fixturesFolder !== '') {
        // users should be allowed to set the fixtures folder
        // the same as the specs folder
        if (commonSearchOptions.fixturesFolder !== searchFolder) {
            fixturesFolderPath = path_1.default.join(commonSearchOptions.fixturesFolder, '**', '*');
        }
    }
    const supportFilePath = commonSearchOptions.supportFile || [];
    // TODO: think about moving this into config
    // ignore fixtures
    const options = {
        sort: true,
        absolute: true,
        nodir: true,
        cwd: searchFolder,
        ignore: lodash_1.default.compact(lodash_1.default.flatten([
            supportFilePath,
            fixturesFolderPath,
        ])),
    };
    // example of resolved paths in the returned spec object
    // filePath                          = /Users/bmann/Dev/my-project/cypress/integration/foo.js
    // integrationFolderPath             = /Users/bmann/Dev/my-project/cypress/integration
    // relativePathFromSearchFolder      = foo.js
    // relativePathFromProjectRoot       = cypress/integration/foo.js
    const relativePathFromSearchFolder = (file) => {
        return path_1.default.relative(searchFolder, file).replace(/\\/g, '/');
    };
    const relativePathFromProjectRoot = (file) => {
        return path_1.default.relative(commonSearchOptions.projectRoot, file).replace(/\\/g, '/');
    };
    const setNameParts = (file) => {
        debug('found spec file %s', file);
        if (!path_1.default.isAbsolute(file)) {
            throw new Error(`Cannot set parts of file from non-absolute path ${file}`);
        }
        return {
            name: relativePathFromSearchFolder(file),
            relative: relativePathFromProjectRoot(file),
            absolute: file,
        };
    };
    const ignorePatterns = [].concat(commonSearchOptions.ignoreTestFiles);
    // a function which returns true if the file does NOT match
    // all of our ignored patterns
    const doesNotMatchAllIgnoredPatterns = (file) => {
        // using {dot: true} here so that folders with a '.' in them are matched
        // as regular characters without needing an '.' in the
        // using {matchBase: true} here so that patterns without a globstar **
        // match against the basename of the file
        return lodash_1.default.every(ignorePatterns, (pattern) => {
            return !(0, minimatch_1.default)(file, pattern, MINIMATCH_OPTIONS);
        });
    };
    const matchesSpecPattern = (file) => {
        if (!specPattern) {
            return true;
        }
        const matchesPattern = (pattern) => {
            return (0, minimatch_1.default)(file, pattern, MINIMATCH_OPTIONS);
        };
        // check to see if the file matches
        // any of the spec patterns array
        return lodash_1.default
            .chain([])
            .concat(specPattern)
            .some(matchesPattern)
            .value();
    };
    // grab all the files
    debug('globbing test files "%s"', commonSearchOptions.testFiles);
    debug('glob options %o', options);
    // ensure we handle either a single string or a list of strings the same way
    const testFilesPatterns = [].concat(commonSearchOptions.testFiles);
    /**
     * Finds matching files for the given pattern, filters out specs to be ignored.
     */
    const findOnePattern = (pattern) => {
        return (0, glob_1.default)(pattern, options)
            .tap(debug)
            // filter out anything that matches our
            // ignored test files glob
            .filter(doesNotMatchAllIgnoredPatterns)
            .filter(matchesSpecPattern)
            .map(setNameParts)
            .tap((files) => {
            return debug('found %s: %o', (0, pluralize_1.default)('spec file', files.length, true), files);
        });
    };
    return bluebird_1.default.mapSeries(testFilesPatterns, findOnePattern).then(lodash_1.default.flatten);
}
const findIntegrationSpecs = (searchFolder, commonSearchOptions, specPattern) => {
    if (!searchFolder) {
        return [];
    }
    return findSpecsOfType(searchFolder, commonSearchOptions, specPattern)
        .then((val) => val.map((s) => (Object.assign(Object.assign({}, s), { specType: SPEC_TYPES.INTEGRATION }))));
};
const findComponentSpecs = (searchFolder, commonSearchOptions, specPattern) => {
    if (!searchFolder) {
        return [];
    }
    return findSpecsOfType(searchFolder, commonSearchOptions, specPattern)
        .then((val) => val.map((s) => (Object.assign(Object.assign({}, s), { specType: SPEC_TYPES.COMPONENT }))));
};
const printFoundSpecs = (foundSpecs) => {
    const table = new cli_table3_1.default({
        head: ['relative', 'specType'],
    });
    foundSpecs.forEach((spec) => {
        // @ts-ignore - types are incorrect
        table.push([spec.relative, spec.specType]);
    });
    /* eslint-disable no-console */
    console.error(table.toString());
};
/**
 * First, finds all integration specs, then finds all component specs.
 * Resolves with an array of objects. Each object has a "testType" property
 * with one of TEST_TYPES values.
 */
const findSpecs = (payload, specPattern) => {
    const { componentFolder, integrationFolder } = payload, commonSearchOptions = (0, tslib_1.__rest)(payload, ["componentFolder", "integrationFolder"]);
    return bluebird_1.default.all([
        findComponentSpecs(componentFolder, commonSearchOptions, specPattern),
        findIntegrationSpecs(integrationFolder, commonSearchOptions, specPattern),
    ]).then(([ct, e2e]) => {
        const foundSpecs = [...ct, ...e2e];
        if (debug.enabled) {
            printFoundSpecs(foundSpecs);
        }
        return foundSpecs;
    });
};
exports.default = {
    findSpecs,
    findSpecsOfType,
    getPatternRelativeToProjectRoot,
};
