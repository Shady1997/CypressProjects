"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommonRoutes = void 0;
const tslib_1 = require("tslib");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const express_1 = require("express");
const xhrs_1 = (0, tslib_1.__importDefault)(require("./controllers/xhrs"));
const runner_1 = require("./controllers/runner");
const iframes_1 = require("./controllers/iframes");
const debug = (0, debug_1.default)('cypress:server:routes');
const createCommonRoutes = ({ config, networkProxy, testingType, getSpec, getCurrentBrowser, specsStore, getRemoteState, nodeProxy, exit, }) => {
    const router = (0, express_1.Router)();
    router.get('/__cypress/runner/*', (req, res) => {
        runner_1.runner.handle(testingType, req, res);
    });
    router.all('/__cypress/xhrs/*', (req, res, next) => {
        xhrs_1.default.handle(req, res, config, next);
    });
    router.get('/__cypress/iframes/*', (req, res) => {
        if (testingType === 'e2e') {
            iframes_1.iframesController.e2e({ config, getSpec, getRemoteState }, req, res);
        }
        if (testingType === 'component') {
            iframes_1.iframesController.component({ config, nodeProxy }, req, res);
        }
    });
    const clientRoute = config.clientRoute;
    if (!clientRoute) {
        throw Error(`clientRoute is required. Received ${clientRoute}`);
    }
    router.get(clientRoute, (req, res) => {
        debug('Serving Cypress front-end by requested URL:', req.url);
        runner_1.runner.serve(req, res, testingType === 'e2e' ? 'runner' : 'runner-ct', {
            config,
            testingType,
            getSpec,
            getCurrentBrowser,
            getRemoteState,
            specsStore,
            exit,
        });
    });
    router.all('*', (req, res) => {
        networkProxy.handleHttpRequest(req, res);
    });
    // when we experience uncaught errors
    // during routing just log them out to
    // the console and send 500 status
    // and report to raygun (in production)
    const errorHandlingMiddleware = (err, req, res) => {
        console.log(err.stack); // eslint-disable-line no-console
        res.set('x-cypress-error', err.message);
        res.set('x-cypress-stack', JSON.stringify(err.stack));
        res.sendStatus(500);
    };
    router.use(errorHandlingMiddleware);
    return router;
};
exports.createCommonRoutes = createCommonRoutes;
