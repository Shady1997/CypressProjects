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
exports.InterceptedRequest = void 0;
const lodash_1 = __importDefault(require("lodash"));
const util_1 = require("./util");
class InterceptedRequest {
    constructor(opts) {
        this.subscriptionsByRoute = [];
        this.includeBodyInAfterResponse = false;
        this.responseSent = false;
        this.onResponse = (incomingRes, resStream) => {
            if (this.responseSent) {
                throw new Error('onResponse cannot be called twice');
            }
            this.responseSent = true;
            this._onResponse(incomingRes, resStream);
        };
        this.id = lodash_1.default.uniqueId('interceptedRequest');
        this.req = opts.req;
        this.res = opts.res;
        this.continueRequest = opts.continueRequest;
        this.onError = opts.onError;
        this._onResponse = opts.onResponse;
        this.matchingRoutes = opts.matchingRoutes;
        this.state = opts.state;
        this.socket = opts.socket;
        this.addDefaultSubscriptions();
    }
    addDefaultSubscriptions() {
        if (this.subscriptionsByRoute.length) {
            throw new Error('cannot add default subscriptions to non-empty array');
        }
        for (const route of this.matchingRoutes) {
            const subscriptionsByRoute = {
                routeId: route.id,
                immediateStaticResponse: route.staticResponse,
                subscriptions: [{
                        eventName: 'before:request',
                        await: !!route.hasInterceptor,
                        routeId: route.id,
                    },
                    ...(['response:callback', 'after:response', 'network:error'].map((eventName) => {
                        // notification-only default event
                        return { eventName, await: false, routeId: route.id };
                    }))],
            };
            this.subscriptionsByRoute.push(subscriptionsByRoute);
        }
    }
    static resolveEventHandler(state, options) {
        const pendingEventHandler = state.pendingEventHandlers[options.eventId];
        if (!pendingEventHandler) {
            return;
        }
        delete state.pendingEventHandlers[options.eventId];
        pendingEventHandler(options);
    }
    addSubscription(subscription) {
        const subscriptionsByRoute = lodash_1.default.find(this.subscriptionsByRoute, { routeId: subscription.routeId });
        if (!subscriptionsByRoute) {
            throw new Error('expected to find existing subscriptions for route, but request did not originally match route');
        }
        // filter out any defaultSub subscriptions that are no longer needed
        const defaultSub = lodash_1.default.find(subscriptionsByRoute.subscriptions, ({ eventName, routeId, id, skip }) => {
            return eventName === subscription.eventName && routeId === subscription.routeId && !id && !skip;
        });
        defaultSub && (defaultSub.skip = true);
        subscriptionsByRoute.subscriptions.push(subscription);
    }
    /*
     * Run all subscriptions for an event, awaiting responses if applicable.
     * Subscriptions are run in order, first sorted by matched route order, then by subscription definition order.
     * Resolves with the updated object, or the original object if no changes have been made.
     */
    handleSubscriptions({ eventName, data, mergeChanges }) {
        return __awaiter(this, void 0, void 0, function* () {
            const eventNames = Array.isArray(eventName) ? eventName : [eventName];
            let stopPropagationNow;
            outerLoop: for (const eventName of eventNames) {
                this.lastEvent = eventName;
                const handleSubscription = (subscription) => __awaiter(this, void 0, void 0, function* () {
                    if (subscription.skip || subscription.eventName !== eventName) {
                        return;
                    }
                    const eventId = lodash_1.default.uniqueId('event');
                    const eventFrame = {
                        eventId,
                        subscription,
                        browserRequestId: this.req.browserPreRequest && this.req.browserPreRequest.requestId,
                        requestId: this.id,
                        data,
                    };
                    // https://github.com/cypress-io/cypress/issues/17139
                    // Routes should be counted before they're sent.
                    if (eventName === 'before:request') {
                        const route = this.matchingRoutes.find(({ id }) => id === subscription.routeId);
                        route.matches++;
                        if (route.routeMatcher.times && route.matches >= route.routeMatcher.times) {
                            route.disabled = true;
                        }
                    }
                    const _emit = () => (0, util_1.emit)(this.socket, eventName, eventFrame);
                    if (!subscription.await) {
                        _emit();
                        return;
                    }
                    const p = new Promise((resolve) => {
                        this.state.pendingEventHandlers[eventId] = resolve;
                    });
                    _emit();
                    const { changedData, stopPropagation } = yield p;
                    stopPropagationNow = stopPropagation;
                    if (changedData) {
                        mergeChanges(data, changedData);
                    }
                });
                for (const { subscriptions, immediateStaticResponse } of this.subscriptionsByRoute) {
                    for (const subscription of subscriptions) {
                        yield handleSubscription(subscription);
                        if (stopPropagationNow) {
                            break;
                        }
                    }
                    if (eventName === 'before:request') {
                        if (immediateStaticResponse) {
                            yield (0, util_1.sendStaticResponse)(this, immediateStaticResponse);
                            return data;
                        }
                    }
                    if (stopPropagationNow) {
                        break outerLoop;
                    }
                }
            }
            return data;
        });
    }
}
exports.InterceptedRequest = InterceptedRequest;
