"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.matches = void 0;
const lodash_1 = __importDefault(require("lodash"));
const minimatch_1 = __importDefault(require("minimatch"));
const uri_1 = require("./uri");
function matches(urlToCheck, blockHosts) {
    // normalize into flat array
    blockHosts = [].concat(blockHosts);
    urlToCheck = (0, uri_1.stripProtocolAndDefaultPorts)(urlToCheck);
    // use minimatch against the url
    // to see if any match
    const matchUrl = (hostMatcher) => {
        return (0, minimatch_1.default)(urlToCheck, hostMatcher);
    };
    return lodash_1.default.find(blockHosts, matchUrl);
}
exports.matches = matches;
