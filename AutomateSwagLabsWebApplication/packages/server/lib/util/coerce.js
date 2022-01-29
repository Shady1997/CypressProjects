"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coerce = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const toBoolean_1 = (0, tslib_1.__importDefault)(require("underscore.string/toBoolean"));
// https://github.com/cypress-io/cypress/issues/6810
const toArray = (value) => {
    const valueIsNotStringOrArray = typeof (value) !== 'string' || (value[0] !== '[' && value[value.length - 1] !== ']');
    if (valueIsNotStringOrArray) {
        return;
    }
    // '[foo,bar]' => ['foo', 'bar']
    const convertStringToArray = () => value.substring(1, value.length - 1).split(',');
    const arr = convertStringToArray();
    // The default `toString` array method returns one string containing each array element separated
    // by commas, but without '[' or ']'. If an environment variable is intended to be an array, it
    // will begin and end with '[' and ']' respectively. To correctly compare the value argument to
    // the value in `process.env`, the `toString` method must be updated to include '[' and ']'.
    // Default `toString()` on array: ['foo', 'bar'].toString() => 'foo,bar'
    // Custom `toString()` on array: ['foo', 'bar'].toString() => '[foo,bar]'
    arr.toString = () => `[${arr.join(',')}]`;
    return arr;
};
// https://github.com/cypress-io/cypress/issues/8818
// toArray() above doesn't handle JSON string properly.
// For example, '[{a:b,c:d},{e:f,g:h}]' isn't the parsed object but ['{a:b', 'c:d}', '{e:f', 'g:h}']. It's useless.
// Because of that, we check if the value is a JSON string.
const fromJson = (value) => {
    try {
        return JSON.parse(value);
    }
    catch (e) {
        // do nothing
    }
};
const coerce = (value) => {
    const num = lodash_1.default.toNumber(value);
    if (lodash_1.default.invoke(num, 'toString') === value) {
        return num;
    }
    const bool = (0, toBoolean_1.default)(value);
    if (lodash_1.default.invoke(bool, 'toString') === value) {
        return bool;
    }
    const obj = fromJson(value);
    if (obj && typeof obj === 'object') {
        return obj;
    }
    const arr = toArray(value);
    if (lodash_1.default.invoke(arr, 'toString') === value) {
        return arr;
    }
    return value;
};
exports.coerce = coerce;
