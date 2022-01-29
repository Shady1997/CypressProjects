"use strict";
// this is designed to run as its own thread, managed by `threads.ts`
// WARNING: take care to not over-import modules here - the upfront
// mem/CPU cost is paid up to threads.MAX_WORKER_THREADS times
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
if (worker_threads_1.isMainThread) {
    throw new Error(`${__filename} should only be run as a worker thread`);
}
const js_1 = require("../js");
const html_1 = require("../html");
worker_threads_1.parentPort.postMessage(true);
let _idCounter = 0;
worker_threads_1.parentPort.on('message', (req) => __awaiter(void 0, void 0, void 0, function* () {
    if (req.shutdown) {
        return process.exit();
    }
    const startedAt = Date.now();
    function _deferSourceMapRewrite(deferredSourceMap) {
        const uniqueId = [worker_threads_1.threadId, _idCounter++].join('.');
        _reply({
            threadMs: _getThreadMs(),
            deferredSourceMap: Object.assign({ uniqueId }, deferredSourceMap),
        });
        return uniqueId;
    }
    function _reply(res) {
        req.port.postMessage(res);
    }
    function _getThreadMs() {
        return Date.now() - startedAt;
    }
    function _getOutput() {
        if (req.isHtml) {
            return (0, html_1.rewriteHtmlJs)(req.url, req.source, _deferSourceMapRewrite);
        }
        if (req.sourceMap) {
            return (0, js_1.rewriteJsSourceMap)(req.url, req.source, req.inputSourceMap);
        }
        return (0, js_1.rewriteJs)(req.url, req.source, _deferSourceMapRewrite);
    }
    try {
        const output = yield _getOutput();
        _reply({ output, threadMs: _getThreadMs() });
    }
    catch (error) {
        _reply({ error, threadMs: _getThreadMs() });
    }
    return req.port.close();
}));
