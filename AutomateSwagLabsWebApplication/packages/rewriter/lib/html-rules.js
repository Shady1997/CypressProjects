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
exports.install = void 0;
const find_1 = __importDefault(require("lodash/find"));
const js = __importStar(require("./js"));
function install(url, rewriter, deferSourceMapRewrite) {
    let currentlyInsideJsScriptTag = false;
    let inlineJsIndex = 0;
    rewriter.on('startTag', (startTag, raw) => {
        if (startTag.tagName !== 'script') {
            currentlyInsideJsScriptTag = false;
            return rewriter.emitRaw(raw);
        }
        const typeAttr = (0, find_1.default)(startTag.attrs, { name: 'type' });
        if (typeAttr && typeAttr.value !== 'text/javascript' && typeAttr.value !== 'module') {
            // we don't care about intercepting non-JS <script> tags
            currentlyInsideJsScriptTag = false;
            return rewriter.emitRaw(raw);
        }
        currentlyInsideJsScriptTag = true;
        // rename subresource integrity attr since cypress's rewriting will invalidate SRI hashes
        // @see https://github.com/cypress-io/cypress/issues/2393
        const sriAttr = (0, find_1.default)(startTag.attrs, { name: 'integrity' });
        if (sriAttr) {
            sriAttr.name = 'cypress:stripped-integrity';
        }
        return rewriter.emitStartTag(startTag);
    });
    rewriter.on('endTag', (_endTag, raw) => {
        currentlyInsideJsScriptTag = false;
        return rewriter.emitRaw(raw);
    });
    rewriter.on('text', (_textToken, raw) => {
        if (!currentlyInsideJsScriptTag) {
            return rewriter.emitRaw(raw);
        }
        // rewrite inline JS in <script> tags
        // create a unique filename per inline script
        const fakeJsUrl = [url, inlineJsIndex++].join(':');
        return rewriter.emitRaw(js.rewriteJs(fakeJsUrl, raw, deferSourceMapRewrite));
    });
}
exports.install = install;
