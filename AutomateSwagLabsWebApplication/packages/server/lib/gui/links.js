"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openExternal = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const electron_1 = require("electron");
const openExternal = (opts) => {
    if (lodash_1.default.isString(opts)) {
        return electron_1.shell.openExternal(opts);
    }
    const url = new URL(opts.url);
    if (opts.params) {
        // just add the utm_source here so we don't have to duplicate it on every link
        if (lodash_1.default.find(opts.params, (_val, key) => lodash_1.default.includes(key, 'utm_'))) {
            opts.params.utm_source = 'Test Runner';
        }
        url.search = new URLSearchParams(opts.params).toString();
    }
    return electron_1.shell.openExternal(url.href);
};
exports.openExternal = openExternal;
