"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutesCT = void 0;
const tslib_1 = require("tslib");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const express_1 = require("express");
const send_1 = (0, tslib_1.__importDefault)(require("send"));
const resolve_dist_1 = require("../../resolve-dist");
const debug = (0, debug_1.default)('cypress:server:routes-ct');
const serveChunk = (req, res, clientRoute) => {
    let pathToFile = (0, resolve_dist_1.getPathToDist)('runner-ct', req.originalUrl.replace(clientRoute, ''));
    return (0, send_1.default)(req, pathToFile).pipe(res);
};
const createRoutesCT = ({ config, nodeProxy, }) => {
    const routesCt = (0, express_1.Router)();
    // user app code + spec code
    // default mounted to /__cypress/src/*
    routesCt.get(`${config.devServerPublicPathRoute}*`, (req, res) => {
        // user the node proxy here instead of the network proxy
        // to avoid the user accidentally intercepting and modifying
        // their own app.js files + spec.js files
        nodeProxy.web(req, res, {}, (e) => {
            if (e) {
                // eslint-disable-next-line
                debug('Proxy request error. This is likely the socket hangup issue, we can basically ignore this because the stream will automatically continue once the asset will be available', e);
            }
        });
    });
    const clientRoute = config.clientRoute;
    if (!clientRoute) {
        throw Error(`clientRoute is required. Received ${clientRoute}`);
    }
    // enables runner-ct to make a dynamic import
    routesCt.get([
        `${clientRoute}ctChunk-*`,
        `${clientRoute}vendors~ctChunk-*`,
    ], (req, res) => {
        debug('Serving Cypress front-end chunk by requested URL:', req.url);
        serveChunk(req, res, clientRoute);
    });
    return routesCt;
};
exports.createRoutesCT = createRoutesCT;
