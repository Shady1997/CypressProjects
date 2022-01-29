"use strict";
/* eslint-disable no-console */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fs = void 0;
const tslib_1 = require("tslib");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const fs_extra_1 = (0, tslib_1.__importDefault)(require("fs-extra"));
// warn users if somehow synchronous file methods are invoked
// these methods due to "too many files" errors are a huge pain
const warnOnSyncFileSystem = () => {
    console.error('WARNING: fs sync methods can fail due to EMFILE errors');
    console.error('Cypress only works reliably when ALL fs calls are async');
    return console.error('You should modify these sync calls to be async');
};
const topLines = (from, n, text) => {
    return text.split('\n').slice(from, n).join('\n');
};
// just hide this function itself
// stripping top few lines of the stack
const getStack = () => {
    const err = new Error();
    return topLines(3, 10, err.stack);
};
const addSyncFileSystemWarnings = (fs) => {
    const oldExistsSync = fs.existsSync;
    fs.existsSync = (filename) => {
        warnOnSyncFileSystem();
        console.error(getStack());
        return oldExistsSync(filename);
    };
};
addSyncFileSystemWarnings(fs_extra_1.default);
exports.fs = bluebird_1.default.promisifyAll(fs_extra_1.default);
