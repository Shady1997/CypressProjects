"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpecsStore = void 0;
const tslib_1 = require("tslib");
const chokidar_1 = (0, tslib_1.__importDefault)(require("chokidar"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const specs_1 = (0, tslib_1.__importDefault)(require("./util/specs"));
// TODO: shouldn't this be on the trailing edge, not leading?
const debounce = (fn) => lodash_1.default.debounce(fn, 250, { leading: true });
class SpecsStore {
    constructor(cypressConfig, runner) {
        this.cypressConfig = cypressConfig;
        this.runner = runner;
        this.watcher = null;
        this.specFiles = [];
    }
    get specDirectory() {
        if (this.runner === 'e2e') {
            return this.cypressConfig.resolved.integrationFolder.value;
        }
        if (this.runner === 'component') {
            return this.cypressConfig.resolved.componentFolder.value;
        }
    }
    get testFiles() {
        return this.cypressConfig.resolved.testFiles.value;
    }
    get watchOptions() {
        return {
            cwd: this.specDirectory,
            ignored: this.cypressConfig.ignoreTestFiles,
            ignoreInitial: true,
        };
    }
    storeSpecFiles() {
        return this.getSpecFiles()
            .then((specFiles) => {
            this.specFiles = specFiles;
        });
    }
    getSpecFiles() {
        const searchOptions = {
            projectRoot: this.cypressConfig.projectRoot,
            fixturesFolder: this.cypressConfig.fixturesFolder,
            supportFile: this.cypressConfig.supportFile,
            testFiles: this.cypressConfig.testFiles,
            ignoreTestFiles: this.cypressConfig.ignoreTestFiles,
        };
        searchOptions.testFiles = this.testFiles;
        return specs_1.default.findSpecsOfType(this.specDirectory, searchOptions);
    }
    watch(options) {
        this.watcher = chokidar_1.default.watch(this.cypressConfig.testFiles, this.watchOptions);
        const onSpecsChanged = debounce(() => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            const newSpecs = yield this.getSpecFiles();
            if (lodash_1.default.isEqual(newSpecs, this.specFiles))
                return;
            this.specFiles = newSpecs;
            options.onSpecsChanged(newSpecs);
        }));
        this.watcher.on('add', onSpecsChanged);
        this.watcher.on('unlink', onSpecsChanged);
    }
    reset() {
        var _a;
        (_a = this.watcher) === null || _a === void 0 ? void 0 : _a.removeAllListeners();
    }
}
exports.SpecsStore = SpecsStore;
