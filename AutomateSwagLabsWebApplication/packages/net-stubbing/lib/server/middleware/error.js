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
exports.InterceptError = void 0;
const debug_1 = __importDefault(require("debug"));
const lodash_1 = __importDefault(require("lodash"));
const errors_1 = __importDefault(require("../../../../server/lib/errors"));
const debug = (0, debug_1.default)('cypress:net-stubbing:server:intercept-error');
const InterceptError = function () {
    return __awaiter(this, void 0, void 0, function* () {
        const request = this.netStubbingState.requests[this.req.requestId];
        if (!request) {
            // the original request was not intercepted, nothing to do
            return this.next();
        }
        debug('intercepting error %o', { req: this.req, request });
        request.continueResponse = this.next;
        yield request.handleSubscriptions({
            eventName: 'network:error',
            data: {
                error: errors_1.default.clone(this.error),
            },
            mergeChanges: lodash_1.default.noop,
        });
        this.next();
    });
};
exports.InterceptError = InterceptError;
