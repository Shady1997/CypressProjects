"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replacedStack = exports.stackWithoutMessage = exports.getStackLines = exports.unsplitStack = exports.splitStack = void 0;
const tslib_1 = require("tslib");
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const stackLineRegex = /^\s*(at )?.*@?\(?.*\:\d+\:\d+\)?$/;
// returns tuple of [message, stack]
const splitStack = (stack) => {
    const lines = stack.split('\n');
    return lodash_1.default.reduce(lines, (memo, line) => {
        if (memo.messageEnded || stackLineRegex.test(line)) {
            memo.messageEnded = true;
            memo[1].push(line);
        }
        else {
            memo[0].push(line);
        }
        return memo;
    }, [[], []]);
};
exports.splitStack = splitStack;
const unsplitStack = (messageLines, stackLines) => {
    return lodash_1.default.castArray(messageLines).concat(stackLines).join('\n');
};
exports.unsplitStack = unsplitStack;
const getStackLines = (stack) => {
    const [, stackLines] = (0, exports.splitStack)(stack);
    return stackLines;
};
exports.getStackLines = getStackLines;
const stackWithoutMessage = (stack) => {
    return (0, exports.getStackLines)(stack).join('\n');
};
exports.stackWithoutMessage = stackWithoutMessage;
const replacedStack = (err, newStack) => {
    // if err already lacks a stack or we've removed the stack
    // for some reason, keep it stackless
    if (!err.stack)
        return err.stack;
    const errString = err.toString();
    const stackLines = (0, exports.getStackLines)(newStack);
    return (0, exports.unsplitStack)(errString, stackLines);
};
exports.replacedStack = replacedStack;
