"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.full = exports.partial = void 0;
const common_tags_1 = require("common-tags");
const resolve_dist_1 = require("../../../../resolve-dist");
function partial(domain) {
    return (0, common_tags_1.oneLine) `
    <script type='text/javascript'>
      document.domain = '${domain}';
    </script>
  `;
}
exports.partial = partial;
function full(domain) {
    return (0, resolve_dist_1.getRunnerInjectionContents)().then((contents) => {
        return (0, common_tags_1.oneLine) `
      <script type='text/javascript'>
        document.domain = '${domain}';

        ${contents}
      </script>
    `;
    });
}
exports.full = full;
