"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPathToDesktopIndex = exports.getPathToIndex = exports.getRunnerInjectionContents = exports.getPathToDist = void 0;
const path_1 = __importDefault(require("path"));
let fs;
const getPathToDist = (folder, ...args) => {
    return path_1.default.join(...[__dirname, '..', '..', folder, 'dist', ...args]);
};
exports.getPathToDist = getPathToDist;
const getRunnerInjectionContents = () => {
    fs !== null && fs !== void 0 ? fs : (fs = require('fs-extra'));
    return fs.readFile((0, exports.getPathToDist)('runner', 'injection.js'));
};
exports.getRunnerInjectionContents = getRunnerInjectionContents;
const getPathToIndex = (pkg) => {
    return (0, exports.getPathToDist)(pkg, 'index.html');
};
exports.getPathToIndex = getPathToIndex;
const getPathToDesktopIndex = () => {
    return `file://${path_1.default.join(__dirname, '..', '..', 'desktop-gui', 'dist', 'index.html')}`;
};
exports.getPathToDesktopIndex = getPathToDesktopIndex;
