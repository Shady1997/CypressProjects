"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showSaveDialog = exports.show = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const electron_1 = require("electron");
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const windows_1 = require("./windows");
const show = () => {
    // associate this dialog to the mainWindow
    // so the user never loses track of which
    // window the dialog belongs to. in other words
    // if they blur off, they only need to focus back
    // on the Cypress app for this dialog to appear again
    // https://developer.apple.com/library/mac/documentation/Cocoa/Conceptual/Sheets/Concepts/AboutSheets.html
    const props = {
        // we only want the user to select a single
        // directory. not multiple, and not files
        properties: ['openDirectory'],
    };
    return electron_1.dialog.showOpenDialog(props)
        .then((obj) => {
        // return the first path since there can only ever
        // be a single directory selection
        return lodash_1.default.get(obj, ['filePaths', 0]);
    });
};
exports.show = show;
const showSaveDialog = (integrationFolder) => {
    // attach to the desktop-gui window so it displays as a modal rather than a standalone window
    const window = (0, windows_1.get)('INDEX');
    const props = {
        defaultPath: path_1.default.join(integrationFolder, 'untitled.spec.js'),
        buttonLabel: 'Create File',
        showsTagField: false,
        filters: [{
                name: 'JavaScript',
                extensions: ['js'],
            }, {
                name: 'TypeScript',
                extensions: ['ts'],
            }, {
                name: 'Other',
                extensions: ['*'],
            }],
        properties: ['createDirectory', 'showOverwriteConfirmation'],
    };
    return electron_1.dialog.showSaveDialog(window, props).then((obj) => {
        return obj.filePath || null;
    });
};
exports.showSaveDialog = showSaveDialog;
