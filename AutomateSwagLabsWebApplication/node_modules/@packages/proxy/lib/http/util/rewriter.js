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
exports.security = exports.html = void 0;
const inject = __importStar(require("./inject"));
const astRewriter = __importStar(require("./ast-rewriter"));
const regexRewriter = __importStar(require("./regex-rewriter"));
const doctypeRe = /(<\!doctype.*?>)/i;
const headRe = /(<head(?!er).*?>)/i;
const bodyRe = /(<body.*?>)/i;
const htmlRe = /(<html.*?>)/i;
function getRewriter(useAstSourceRewriting) {
    return useAstSourceRewriting ? astRewriter : regexRewriter;
}
function getHtmlToInject({ domainName, wantsInjection }) {
    switch (wantsInjection) {
        case 'full':
            return inject.full(domainName);
        case 'partial':
            return inject.partial(domainName);
        default:
            return;
    }
}
function html(html, opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const replace = (re, str) => {
            return html.replace(re, str);
        };
        const htmlToInject = yield Promise.resolve(getHtmlToInject(opts));
        // strip clickjacking and framebusting
        // from the HTML if we've been told to
        if (opts.wantsSecurityRemoved) {
            html = yield Promise.resolve(getRewriter(opts.useAstSourceRewriting).strip(html, opts));
        }
        if (!htmlToInject) {
            return html;
        }
        // TODO: move this into regex-rewriting and have ast-rewriting handle this in its own way
        switch (false) {
            case !headRe.test(html):
                return replace(headRe, `$1 ${htmlToInject}`);
            case !bodyRe.test(html):
                return replace(bodyRe, `<head> ${htmlToInject} </head> $1`);
            case !htmlRe.test(html):
                return replace(htmlRe, `$1 <head> ${htmlToInject} </head>`);
            case !doctypeRe.test(html):
                // if only <!DOCTYPE> content, inject <head> after doctype
                return `${html}<head> ${htmlToInject} </head>`;
            default:
                return `<head> ${htmlToInject} </head>${html}`;
        }
    });
}
exports.html = html;
function security(opts) {
    return getRewriter(opts.useAstSourceRewriting).stripStream(opts);
}
exports.security = security;
