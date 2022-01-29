"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutesE2E = void 0;
const tslib_1 = require("tslib");
const path_1 = (0, tslib_1.__importDefault)(require("path"));
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const express_1 = require("express");
const app_data_1 = (0, tslib_1.__importDefault)(require("./util/app_data"));
const cache_buster_1 = (0, tslib_1.__importDefault)(require("./util/cache_buster"));
const spec_1 = (0, tslib_1.__importDefault)(require("./controllers/spec"));
const reporter_1 = (0, tslib_1.__importDefault)(require("./controllers/reporter"));
const client_1 = (0, tslib_1.__importDefault)(require("./controllers/client"));
const files_1 = (0, tslib_1.__importDefault)(require("./controllers/files"));
const debug = (0, debug_1.default)('cypress:server:routes-e2e');
const createRoutesE2E = ({ config, networkProxy, onError, }) => {
    const routesE2E = (0, express_1.Router)();
    // routing for the actual specs which are processed automatically
    // this could be just a regular .js file or a .coffee file
    routesE2E.get('/__cypress/tests', (req, res, next) => {
        // slice out the cache buster
        const test = decodeURIComponent(cache_buster_1.default.strip(req.query.p));
        spec_1.default.handle(test, req, res, config, next, onError);
    });
    routesE2E.get('/__cypress/socket.io.js', (req, res) => {
        client_1.default.handle(req, res);
    });
    routesE2E.get('/__cypress/reporter/*', (req, res) => {
        reporter_1.default.handle(req, res);
    });
    routesE2E.get('/__cypress/automation/getLocalStorage', (req, res) => {
        // gathers and sends localStorage and sessionStorage via postMessage to the Cypress frame
        // detect existence of local/session storage with JSON.stringify(...).length since localStorage.length may not be accurate
        res.send(`<html><body><script>(${(function () {
            const _localStorageStr = JSON.stringify(window.localStorage);
            const _localStorage = _localStorageStr.length > 2 && JSON.parse(_localStorageStr);
            const _sessionStorageStr = JSON.stringify(window.sessionStorage);
            const _sessionStorage = _sessionStorageStr.length > 2 && JSON.parse(JSON.stringify(window.sessionStorage));
            const value = {};
            if (_localStorage) {
                value.localStorage = _localStorage;
            }
            if (_sessionStorage) {
                value.sessionStorage = _sessionStorage;
            }
            window.parent.postMessage({
                value,
                type: 'localStorage',
            }, '*');
        }).toString()})()</script></body></html>`);
    });
    /* eslint-disable no-undef */
    routesE2E.get('/__cypress/automation/setLocalStorage', (req, res) => {
        const origin = req.originalUrl.slice(req.originalUrl.indexOf('?') + 1);
        networkProxy.http.getRenderedHTMLOrigins()[origin] = true;
        res.send(`<html><body><script>(${(function () {
            window.onmessage = function (event) {
                const msg = event.data;
                if (msg.type === 'set:storage:data') {
                    const { data } = msg;
                    const setData = (storageData, type) => {
                        if (!storageData)
                            return;
                        const { clear, value } = storageData;
                        if (clear) {
                            // @ts-ignore
                            window[type].clear();
                        }
                        if (value) {
                            Object.keys(value).forEach((key) => {
                                // @ts-ignore
                                window[type].setItem(key, value[key]);
                            });
                        }
                    };
                    setData(data.localStorage, 'localStorage');
                    setData(data.sessionStorage, 'sessionStorage');
                    window.parent.postMessage({ type: 'set:storage:complete' }, '*');
                }
            };
            window.parent.postMessage({ type: 'set:storage:load' }, '*');
        }).toString()})()</script></body></html>`);
    });
    /* eslint-enable no-undef */
    // routing for /files JSON endpoint
    routesE2E.get('/__cypress/files', (req, res) => {
        files_1.default.handleFiles(req, res, config);
    });
    routesE2E.get('/__cypress/source-maps/:id.map', (req, res) => {
        networkProxy.handleSourceMapRequest(req, res);
    });
    // special fallback - serve local files from the project's root folder
    routesE2E.get('/__root/*', (req, res) => {
        const file = path_1.default.join(config.projectRoot, req.params[0]);
        res.sendFile(file, { etag: false });
    });
    // special fallback - serve dist'd (bundled/static) files from the project path folder
    routesE2E.get('/__cypress/bundled/*', (req, res) => {
        const file = app_data_1.default.getBundledFilePath(config.projectRoot, path_1.default.join('src', req.params[0]));
        debug(`Serving dist'd bundle at file path: %o`, { path: file, url: req.url });
        res.sendFile(file, { etag: false });
    });
    return routesE2E;
};
exports.createRoutesE2E = createRoutesE2E;
