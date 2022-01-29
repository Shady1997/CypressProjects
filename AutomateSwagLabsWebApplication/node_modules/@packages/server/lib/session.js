"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearSessions = exports.getState = exports.getSession = exports.saveSession = void 0;
const state = {
    sessions: {},
};
function saveSession(data) {
    if (!data.id)
        throw new Error('session data had no id');
    state.sessions[data.id] = data;
}
exports.saveSession = saveSession;
function getSession(id) {
    const session = state.sessions[id];
    if (!session)
        throw new Error(`session with id "${id}" not found`);
    return session;
}
exports.getSession = getSession;
function getState() {
    return state;
}
exports.getState = getState;
function clearSessions() {
    state.sessions = {};
}
exports.clearSessions = clearSessions;
