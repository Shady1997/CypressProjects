"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRetryingSocket = exports.getDelayForRetry = exports.getAddress = exports.byPortAndAddress = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const debug_1 = __importDefault(require("debug"));
const dns_1 = __importDefault(require("dns"));
const lodash_1 = __importDefault(require("lodash"));
const net_1 = __importDefault(require("net"));
const tls_1 = __importDefault(require("tls"));
const debug = (0, debug_1.default)('cypress:network:connect');
function byPortAndAddress(port, address) {
    // https://nodejs.org/api/net.html#net_net_connect_port_host_connectlistener
    return new bluebird_1.default((resolve, reject) => {
        const onConnect = () => {
            client.end();
            resolve(address);
        };
        const client = net_1.default.connect(port, address.address, onConnect);
        client.on('error', reject);
    });
}
exports.byPortAndAddress = byPortAndAddress;
function getAddress(port, hostname) {
    debug('beginning getAddress %o', { hostname, port });
    const fn = byPortAndAddress.bind({}, port);
    // promisify at the very last second which enables us to
    // modify dns lookup function (via hosts overrides)
    const lookupAsync = bluebird_1.default.promisify(dns_1.default.lookup, { context: dns_1.default });
    // this does not go out to the network to figure
    // out the addresess. in fact it respects the /etc/hosts file
    // https://github.com/nodejs/node/blob/dbdbdd4998e163deecefbb1d34cda84f749844a4/lib/dns.js#L108
    // https://nodejs.org/api/dns.html#dns_dns_lookup_hostname_options_callback
    // @ts-ignore
    return lookupAsync(hostname, { all: true })
        .then((addresses) => {
        debug('got addresses %o', { hostname, port, addresses });
        // convert to an array if string
        return Array.prototype.concat.call(addresses).map(fn);
    })
        .tapCatch((err) => {
        debug('error getting address %o', { hostname, port, err });
    })
        .any();
}
exports.getAddress = getAddress;
function getDelayForRetry(iteration) {
    return [0, 100, 200, 200][iteration];
}
exports.getDelayForRetry = getDelayForRetry;
function createSocket(opts, onConnect) {
    const netOpts = lodash_1.default.pick(opts, 'host', 'port');
    if (opts.useTls) {
        return tls_1.default.connect(netOpts, onConnect);
    }
    return net_1.default.connect(netOpts, onConnect);
}
function createRetryingSocket(opts, cb) {
    if (typeof opts.getDelayMsForRetry === 'undefined') {
        opts.getDelayMsForRetry = getDelayForRetry;
    }
    function tryConnect(iteration = 0) {
        const retry = (err) => {
            const delay = opts.getDelayMsForRetry(iteration, err);
            if (typeof delay === 'undefined') {
                debug('retries exhausted, bubbling up error %o', { iteration, err });
                return cb(err);
            }
            debug('received error on connect, retrying %o', { iteration, delay, err });
            setTimeout(() => {
                tryConnect(iteration + 1);
            }, delay);
        };
        function onError(err) {
            sock.on('error', (err) => {
                debug('second error received on retried socket %o', { opts, iteration, err });
            });
            retry(err);
        }
        function onConnect() {
            debug('successfully connected %o', { opts, iteration });
            // connection successfully established, pass control of errors/retries to consuming function
            sock.removeListener('error', onError);
            cb(undefined, sock, retry);
        }
        const sock = createSocket(opts, onConnect);
        sock.once('error', onError);
    }
    tryConnect();
}
exports.createRetryingSocket = createRetryingSocket;
