"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAsync = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const path = (0, tslib_1.__importStar)(require("path"));
const cp = (0, tslib_1.__importStar)(require("child_process"));
const inspector = (0, tslib_1.__importStar)(require("inspector"));
const util = (0, tslib_1.__importStar)(require("../plugins/util"));
const errors = (0, tslib_1.__importStar)(require("../errors"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const debug = (0, debug_1.default)('cypress:server:require_async');
let requireProcess;
const killChildProcess = () => {
    requireProcess && requireProcess.kill();
    requireProcess = null;
};
function requireAsync(filePath, options) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            if (requireProcess) {
                debug('kill existing config process');
                killChildProcess();
            }
            const childOptions = {
                stdio: 'inherit',
            };
            if (inspector.url()) {
                childOptions.execArgv = lodash_1.default.chain(process.execArgv.slice(0))
                    .remove('--inspect-brk')
                    .push(`--inspect=${process.debugPort + 1}`)
                    .value();
            }
            const childArguments = ['--projectRoot', options.projectRoot, '--file', filePath];
            debug('fork child process', path.join(__dirname, 'require_async_child.js'), childArguments, childOptions);
            requireProcess = cp.fork(path.join(__dirname, 'require_async_child.js'), childArguments, childOptions);
            const ipc = util.wrapIpc(requireProcess);
            if (requireProcess.stdout && requireProcess.stderr) {
                // manually pipe plugin stdout and stderr for dashboard capture
                // @see https://github.com/cypress-io/cypress/issues/7434
                requireProcess.stdout.on('data', (data) => process.stdout.write(data));
                requireProcess.stderr.on('data', (data) => process.stderr.write(data));
            }
            ipc.on('loaded', (result) => {
                debug('resolving with result %o', result);
                resolve(result);
            });
            ipc.on('load:error', (type, ...args) => {
                var _a;
                debug('load:error %s, rejecting', type);
                killChildProcess();
                const err = errors.get(type, ...args);
                // if it's a non-cypress error, restore the initial error
                if (!((_a = err.message) === null || _a === void 0 ? void 0 : _a.length)) {
                    err.isCypressErr = false;
                    err.message = args[1];
                    err.code = type;
                    err.name = type;
                }
                reject(err);
            });
            debug('trigger the load of the file');
            ipc.send('load');
        });
    });
}
exports.requireAsync = requireAsync;
