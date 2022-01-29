"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketCt = void 0;
const tslib_1 = require("tslib");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const dev_server_1 = (0, tslib_1.__importDefault)(require("../lib/plugins/dev-server"));
const socket_base_1 = require("../lib/socket-base");
const debug = (0, debug_1.default)('cypress:server:socket-ct');
class SocketCt extends socket_base_1.SocketBase {
    constructor(config) {
        super(config);
        dev_server_1.default.emitter.on('dev-server:compile:error', (error) => {
            this.toRunner('dev-server:hmr:error', error);
        });
        // should we use this option at all for component testing 😕?
        if (config.watchForFileChanges) {
            dev_server_1.default.emitter.on('dev-server:compile:success', ({ specFile }) => {
                this.toRunner('dev-server:compile:success', { specFile });
            });
        }
    }
    startListening(server, automation, config, options) {
        const { componentFolder } = config;
        this.testsDir = componentFolder;
        return super.startListening(server, automation, config, options, {
            onSocketConnection(socket) {
                debug('do onSocketConnection');
            },
        });
    }
}
exports.SocketCt = SocketCt;
