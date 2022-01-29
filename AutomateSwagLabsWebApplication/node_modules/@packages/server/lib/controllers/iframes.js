"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iframesController = void 0;
const tslib_1 = require("tslib");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const files_1 = (0, tslib_1.__importDefault)(require("./files"));
const debug = (0, debug_1.default)('cypress:server:iframes');
exports.iframesController = {
    e2e: ({ getSpec, getRemoteState, config }, req, res) => {
        var _a;
        const extraOptions = {
            specFilter: (_a = getSpec()) === null || _a === void 0 ? void 0 : _a.specFilter,
            specType: 'integration',
        };
        debug('handling iframe for project spec %o', {
            spec: getSpec(),
            extraOptions,
        });
        files_1.default.handleIframe(req, res, config, getRemoteState, extraOptions);
    },
    component: ({ config, nodeProxy }, req, res) => {
        // always proxy to the index.html file
        // attach header data for webservers
        // to properly intercept and serve assets from the correct src root
        // TODO: define a contract for dev-server plugins to configure this behavior
        req.headers.__cypress_spec_path = req.params[0];
        req.url = `${config.devServerPublicPathRoute}/index.html`;
        // user the node proxy here instead of the network proxy
        // to avoid the user accidentally intercepting and modifying
        // our internal index.html handler
        nodeProxy.web(req, res, {}, (e) => {
            if (e) {
                // eslint-disable-next-line
                debug('Proxy request error. This is likely the socket hangup issue, we can basically ignore this because the stream will automatically continue once the asset will be available', e);
            }
        });
    },
};
