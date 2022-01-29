"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serveChunk = exports.serve = exports.handle = void 0;
const tslib_1 = require("tslib");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const send_1 = (0, tslib_1.__importDefault)(require("send"));
const resolve_dist_1 = require("../../resolve-dist");
const debug = (0, debug_1.default)('cypress:server:runner-ct');
const handle = (req, res) => {
    const pathToFile = (0, resolve_dist_1.getPathToDist)('runner-ct', req.params[0]);
    return (0, send_1.default)(req, pathToFile)
        .pipe(res);
};
exports.handle = handle;
const serve = (req, res, options) => {
    const config = Object.assign(Object.assign({}, options.config), { browser: options.getCurrentBrowser(), specs: options.specsStore.specFiles });
    // TODO: move the component file watchers in here
    // and update them in memory when they change and serve
    // them straight to the HTML on load
    debug('serving runner index.html with config %o', lodash_1.default.pick(config, 'version', 'platform', 'arch', 'projectName'));
    // base64 before embedding so user-supplied contents can't break out of <script>
    // https://github.com/cypress-io/cypress/issues/4952
    const base64Config = Buffer.from(JSON.stringify(config)).toString('base64');
    const runnerPath = process.env.CYPRESS_INTERNAL_RUNNER_PATH || (0, resolve_dist_1.getPathToIndex)('runner-ct');
    return res.render(runnerPath, {
        base64Config,
        projectName: config.projectName,
    });
};
exports.serve = serve;
const serveChunk = (req, res, options) => {
    let { config } = options;
    let pathToFile = (0, resolve_dist_1.getPathToDist)('runner-ct', req.originalUrl.replace(config.clientRoute, ''));
    return (0, send_1.default)(req, pathToFile).pipe(res);
};
exports.serveChunk = serveChunk;
