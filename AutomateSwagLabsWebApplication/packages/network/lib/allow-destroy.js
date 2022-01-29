"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowDestroy = void 0;
/**
 * `allowDestroy` adds a `destroy` method to a `net.Server`. `destroy(cb)`
 * will kill all open connections and call `cb` when the server is closed.
 *
 * Note: `server-destroy` NPM package cannot be used - it does not track
 * `secureConnection` events.
 */
function allowDestroy(server) {
    let connections = [];
    function trackConn(conn) {
        connections.push(conn);
        conn.on('close', () => {
            connections = connections.filter((connection) => connection !== conn);
        });
    }
    server.on('connection', trackConn);
    server.on('secureConnection', trackConn);
    // @ts-ignore Property 'destroy' does not exist on type 'Server'.
    server.destroy = function (cb) {
        server.close(cb);
        connections.map((connection) => connection.destroy());
    };
    return server;
}
exports.allowDestroy = allowDestroy;
