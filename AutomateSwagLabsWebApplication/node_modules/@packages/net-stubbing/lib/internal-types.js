"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRING_MATCHER_FIELDS = exports.DICT_STRING_MATCHER_FIELDS = exports.PLAIN_FIELDS = exports.SERIALIZABLE_RES_PROPS = exports.SERIALIZABLE_REQ_PROPS = void 0;
const _ = __importStar(require("lodash"));
exports.SERIALIZABLE_REQ_PROPS = [
    'headers',
    'body',
    'url',
    'method',
    'httpVersion',
    'responseTimeout',
    'followRedirect',
];
exports.SERIALIZABLE_RES_PROPS = _.concat(exports.SERIALIZABLE_REQ_PROPS, 'statusCode', 'statusMessage', 'delay', 'throttleKbps');
exports.PLAIN_FIELDS = ['https', 'port', 'middleware', 'times'];
exports.DICT_STRING_MATCHER_FIELDS = ['headers', 'query'];
exports.STRING_MATCHER_FIELDS = ['auth.username', 'auth.password', 'hostname', 'method', 'path', 'pathname', 'url'];
