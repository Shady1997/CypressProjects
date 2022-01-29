"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserEditor = exports.getUserEditor = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const env_editors_1 = require("./env-editors");
const shell_1 = (0, tslib_1.__importDefault)(require("./shell"));
const saved_state_1 = (0, tslib_1.__importDefault)(require("../saved_state"));
const debug = (0, debug_1.default)('cypress:server:editors');
const createEditor = (editor) => {
    return {
        id: editor.id,
        name: editor.name,
        openerId: editor.binary,
        isOther: false,
    };
};
const getOtherEditor = (preferredOpener) => {
    // if preferred editor is the 'other' option, use it since it has the
    // path (openerId) saved with it
    if (preferredOpener && preferredOpener.isOther) {
        return preferredOpener;
    }
    return {
        id: 'other',
        name: 'Other',
        openerId: '',
        isOther: true,
    };
};
const computerOpener = () => {
    const names = {
        darwin: 'Finder',
        win32: 'File Explorer',
        linux: 'File System',
    };
    return {
        id: 'computer',
        name: names[process.platform] || names.linux,
        openerId: 'computer',
        isOther: false,
    };
};
const getUserEditors = () => {
    return bluebird_1.default.filter((0, env_editors_1.getEnvEditors)(), (editor) => {
        debug('check if user has editor %s with binary %s', editor.name, editor.binary);
        return shell_1.default.commandExists(editor.binary);
    })
        .then((editors = []) => {
        debug('user has the following editors: %o', editors);
        return saved_state_1.default.create()
            .then((state) => {
            return state.get('preferredOpener');
        })
            .then((preferredOpener) => {
            debug('saved preferred editor: %o', preferredOpener);
            const cyEditors = lodash_1.default.map(editors, createEditor);
            // @ts-ignore
            return [computerOpener()].concat(cyEditors).concat([getOtherEditor(preferredOpener)]);
        });
    });
};
const getUserEditor = (alwaysIncludeEditors = false) => {
    debug('get user editor');
    return saved_state_1.default.create()
        .then((state) => state.get())
        .then((state) => {
        const preferredOpener = state.preferredOpener;
        if (preferredOpener) {
            debug('return preferred editor: %o', preferredOpener);
            if (!alwaysIncludeEditors) {
                return { preferredOpener };
            }
        }
        return getUserEditors().then((availableEditors) => {
            debug('return available editors: %o', availableEditors);
            return { availableEditors, preferredOpener };
        });
    });
};
exports.getUserEditor = getUserEditor;
const setUserEditor = (editor) => {
    debug('set user editor: %o', editor);
    return saved_state_1.default.create()
        .then((state) => {
        state.set('preferredOpener', editor);
    });
};
exports.setUserEditor = setUserEditor;
