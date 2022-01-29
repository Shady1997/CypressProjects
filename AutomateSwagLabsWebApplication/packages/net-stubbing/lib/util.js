"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.caseInsensitiveHas = exports.caseInsensitiveGet = void 0;
const caseInsensitiveGet = function (obj, lowercaseProperty) {
    for (let key of Object.keys(obj)) {
        if (key.toLowerCase() === lowercaseProperty) {
            return obj[key];
        }
    }
};
exports.caseInsensitiveGet = caseInsensitiveGet;
const caseInsensitiveHas = function (obj, lowercaseProperty) {
    for (let key of Object.keys(obj)) {
        if (key.toLowerCase() === lowercaseProperty) {
            return true;
        }
    }
    return false;
};
exports.caseInsensitiveHas = caseInsensitiveHas;
