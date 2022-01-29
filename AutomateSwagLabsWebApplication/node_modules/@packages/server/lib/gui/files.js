"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showDialogAndCreateSpec = void 0;
const tslib_1 = require("tslib");
const open_project_1 = require("../open_project");
const spec_writer_1 = require("../util/spec_writer");
const dialog_1 = require("./dialog");
const showDialogAndCreateSpec = () => (0, tslib_1.__awaiter)(void 0, void 0, void 0, function* () {
    const cfg = open_project_1.openProject.getConfig();
    const path = yield (0, dialog_1.showSaveDialog)(cfg.integrationFolder || '');
    if (!path) {
        return {
            specs: null,
            path,
        };
    }
    // only create file if they selected a file
    if (path) {
        yield (0, spec_writer_1.createFile)(path);
    }
    // reload specs now that we've added a new file
    // we reload here so we can update ui immediately instead of
    // waiting for file watching to send updated spec list
    const specs = yield open_project_1.openProject.getSpecs(cfg);
    return {
        specs,
        path,
    };
});
exports.showDialogAndCreateSpec = showDialogAndCreateSpec;
