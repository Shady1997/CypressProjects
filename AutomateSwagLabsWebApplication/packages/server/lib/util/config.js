"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProcessEnvVars = exports.isDefault = exports.CYPRESS_SPECIAL_ENV_VARS = exports.CYPRESS_RESERVED_ENV_VARS = exports.CYPRESS_ENV_PREFIX_LENGTH = exports.CYPRESS_ENV_PREFIX = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const coerce_1 = require("./coerce");
exports.CYPRESS_ENV_PREFIX = 'CYPRESS_';
exports.CYPRESS_ENV_PREFIX_LENGTH = 'CYPRESS_'.length;
exports.CYPRESS_RESERVED_ENV_VARS = [
    'CYPRESS_INTERNAL_ENV',
];
exports.CYPRESS_SPECIAL_ENV_VARS = [
    'RECORD_KEY',
];
const isDefault = (config, prop) => {
    return config.resolved[prop].from === 'default';
};
exports.isDefault = isDefault;
const getProcessEnvVars = (obj) => {
    return lodash_1.default.reduce(obj, (memo, value, key) => {
        if (!value) {
            return memo;
        }
        if (isCypressEnvLike(key)) {
            memo[removeEnvPrefix(key)] = (0, coerce_1.coerce)(value);
        }
        return memo;
    }, {});
};
exports.getProcessEnvVars = getProcessEnvVars;
const isCypressEnvLike = (key) => {
    return lodash_1.default.chain(key)
        .invoke('toUpperCase')
        .startsWith(exports.CYPRESS_ENV_PREFIX)
        .value() &&
        !lodash_1.default.includes(exports.CYPRESS_RESERVED_ENV_VARS, key);
};
const removeEnvPrefix = (key) => {
    return key.slice(exports.CYPRESS_ENV_PREFIX_LENGTH);
};
