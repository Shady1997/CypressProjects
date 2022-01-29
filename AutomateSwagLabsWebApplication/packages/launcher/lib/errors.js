"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notDetectedAtPathErr = exports.notInstalledErr = void 0;
const notInstalledErr = (name, message) => {
    const err = new Error(message || `Browser not installed: ${name}`);
    err.notInstalled = true;
    return err;
};
exports.notInstalledErr = notInstalledErr;
const notDetectedAtPathErr = (stdout) => {
    const err = new Error(stdout);
    err.notDetectedAtPath = true;
    return err;
};
exports.notDetectedAtPathErr = notDetectedAtPathErr;
