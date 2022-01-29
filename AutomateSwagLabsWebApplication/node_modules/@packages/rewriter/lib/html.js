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
exports.rewriteHtmlJs = exports.HtmlJsRewriter = void 0;
const parse5_html_rewriting_stream_1 = __importDefault(require("parse5-html-rewriting-stream"));
const htmlRules = __importStar(require("./html-rules"));
// the HTML rewriter passes inline JS to the JS rewriter, hence
// the lack of basic `rewriteHtml` or `HtmlRewriter` exports here
function HtmlJsRewriter(url, deferSourceMapRewrite) {
    const rewriter = new parse5_html_rewriting_stream_1.default();
    htmlRules.install(url, rewriter, deferSourceMapRewrite);
    return rewriter;
}
exports.HtmlJsRewriter = HtmlJsRewriter;
function rewriteHtmlJs(url, html, deferSourceMapRewrite) {
    let out = '';
    const rewriter = HtmlJsRewriter(url, deferSourceMapRewrite);
    rewriter.on('data', (chunk) => {
        out += chunk;
    });
    rewriter.end(html);
    return new Promise((resolve) => {
        rewriter.on('end', () => {
            resolve(out);
        });
    });
}
exports.rewriteHtmlJs = rewriteHtmlJs;
