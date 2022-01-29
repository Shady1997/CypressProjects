"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowDestroy = void 0;
const tslib_1 = require("tslib");
const bluebird_1 = (0, tslib_1.__importDefault)(require("bluebird"));
const network = (0, tslib_1.__importStar)(require("../../../network"));
const allowDestroy = (server) => {
    network.allowDestroy(server);
    server.destroyAsync = () => {
        return bluebird_1.default.promisify(server.destroy)()
            .catch(() => { }); // dont catch any errors
    };
    return server;
};
exports.allowDestroy = allowDestroy;
