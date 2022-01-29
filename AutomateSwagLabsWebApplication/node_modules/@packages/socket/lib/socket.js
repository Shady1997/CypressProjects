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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClientSource = exports.getClientVersion = exports.getPathToClientSource = exports.SocketIOServer = exports.server = exports.client = void 0;
const fs_1 = __importDefault(require("fs"));
const buffer_1 = __importDefault(require("buffer"));
const socket_io_1 = __importStar(require("socket.io"));
exports.server = socket_io_1.default;
const browser_1 = require("./browser");
Object.defineProperty(exports, "client", { enumerable: true, get: function () { return browser_1.client; } });
const { version } = require('socket.io-client/package.json');
const clientSource = require.resolve('socket.io-client/dist/socket.io.js');
class SocketIOServer extends socket_io_1.Server {
    constructor(srv, opts) {
        var _a;
        opts = opts !== null && opts !== void 0 ? opts : {};
        // the maxHttpBufferSize is used to limit the message size sent over
        // the socket. Small values can be used to mitigate exposure to
        // denial of service attacks; the default as of v3.0 is 1MB.
        // because our server is local, we do not need to arbitrarily limit
        // the message size and can use the theoretical maximum value.
        opts.maxHttpBufferSize = (_a = opts.maxHttpBufferSize) !== null && _a !== void 0 ? _a : buffer_1.default.constants.MAX_LENGTH;
        super(srv, opts);
    }
}
exports.SocketIOServer = SocketIOServer;
const getPathToClientSource = () => {
    return clientSource;
};
exports.getPathToClientSource = getPathToClientSource;
const getClientVersion = () => {
    return version;
};
exports.getClientVersion = getClientVersion;
const getClientSource = () => {
    return fs_1.default.readFileSync((0, exports.getPathToClientSource)(), 'utf8');
};
exports.getClientSource = getClientSource;
