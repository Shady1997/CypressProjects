"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const detect_1 = require("../detect");
(0, detect_1.detect)(undefined, false).then((browsers) => {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(browsers, null, 2));
});
