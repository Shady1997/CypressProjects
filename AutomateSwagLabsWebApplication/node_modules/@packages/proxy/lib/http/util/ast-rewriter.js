"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripStream = exports.strip = void 0;
const rewriter_1 = require("../../../../rewriter");
const duplexify_1 = __importDefault(require("duplexify"));
const network_1 = require("../../../../network");
const stream_1 = __importDefault(require("stream"));
const pumpify = require('pumpify');
const utf8Stream = require('utf8-stream');
const strip = (source, opts) => __awaiter(void 0, void 0, void 0, function* () {
    if (opts.isHtml) {
        return (0, rewriter_1.rewriteHtmlJsAsync)(opts.url, source, opts.deferSourceMapRewrite); // threaded
    }
    return (0, rewriter_1.rewriteJsAsync)(opts.url, source, opts.deferSourceMapRewrite); // threaded
});
exports.strip = strip;
const stripStream = (opts) => {
    if (opts.isHtml) {
        return pumpify(utf8Stream(), (0, rewriter_1.HtmlJsRewriter)(opts.url, opts.deferSourceMapRewrite));
    }
    const pt = new (stream_1.default.PassThrough)();
    return (0, duplexify_1.default)(pumpify(utf8Stream(), (0, network_1.concatStream)((body) => __awaiter(void 0, void 0, void 0, function* () {
        pt.write(yield (0, exports.strip)(body.toString(), opts));
        pt.end();
    }))), pt);
};
exports.stripStream = stripStream;
