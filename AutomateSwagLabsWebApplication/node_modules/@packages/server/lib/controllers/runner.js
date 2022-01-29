"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runner = exports.serveRunner = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const send_1 = (0, tslib_1.__importDefault)(require("send"));
const os_1 = (0, tslib_1.__importDefault)(require("os"));
const fs_1 = require("../util/fs");
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const root_1 = (0, tslib_1.__importDefault)(require("../../../root"));
const resolve_dist_1 = require("../../../resolve-dist");
const debug = (0, debug_1.default)('cypress:server:runner');
const PATH_TO_NON_PROXIED_ERROR = path_1.default.join(__dirname, '..', 'html', 'non_proxied_error.html');
const _serveNonProxiedError = (res) => {
    return fs_1.fs.readFile(PATH_TO_NON_PROXIED_ERROR)
        .then((html) => {
        return res.type('html').end(html);
    });
};
const serveRunner = (runnerPkg, config, res) => {
    // base64 before embedding so user-supplied contents can't break out of <script>
    // https://github.com/cypress-io/cypress/issues/4952
    const base64Config = Buffer.from(JSON.stringify(config)).toString('base64');
    const runnerPath = process.env.CYPRESS_INTERNAL_RUNNER_PATH || (0, resolve_dist_1.getPathToIndex)(runnerPkg);
    return res.render(runnerPath, {
        base64Config,
        projectName: config.projectName,
    });
};
exports.serveRunner = serveRunner;
exports.runner = {
    serve(req, res, runnerPkg, options) {
        var _a;
        if (req.proxiedUrl.startsWith('/')) {
            debug('request was not proxied via Cypress, erroring %o', lodash_1.default.pick(req, 'proxiedUrl'));
            return _serveNonProxiedError(res);
        }
        let { config, getRemoteState, getCurrentBrowser, getSpec, specsStore, exit } = options;
        config = lodash_1.default.clone(config);
        // at any given point, rather than just arbitrarily modifying it.
        // @ts-ignore
        config.testingType = options.testingType;
        // TODO #1: bug. Passing `remote.domainName` breaks CT for unknown reasons.
        // If you pass a remote object with a domainName key, we get cross-origin
        // iframe access errors.
        // repro:
        // {
        //    "domainName": "localhost"
        // }
        // TODO: Find out what the problem.
        if (options.testingType === 'e2e') {
            config.remote = getRemoteState();
        }
        config.version = root_1.default.version;
        config.platform = os_1.default.platform();
        config.arch = os_1.default.arch();
        config.spec = (_a = getSpec()) !== null && _a !== void 0 ? _a : null;
        config.specs = specsStore.specFiles;
        config.browser = getCurrentBrowser();
        config.exit = exit !== null && exit !== void 0 ? exit : true;
        debug('serving runner index.html with config %o', lodash_1.default.pick(config, 'version', 'platform', 'arch', 'projectName'));
        // log the env object's keys without values to avoid leaking sensitive info
        debug('env object has the following keys: %s', lodash_1.default.keys(config.env).join(', '));
        return (0, exports.serveRunner)(runnerPkg, config, res);
    },
    handle(testingType, req, res) {
        const pathToFile = (0, resolve_dist_1.getPathToDist)(testingType === 'e2e' ? 'runner' : 'runner-ct', req.params[0]);
        return (0, send_1.default)(req, pathToFile)
            .pipe(res);
    },
};
