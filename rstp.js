"use strict";
var nodes = new Map();
var edges = new Set();
function toHex(x, digits) {
    return ('0'.repeat(digits) + Number(x).toString(16)).slice(-digits).toUpperCase();
}
class MAC {
    constructor(mac = randomMAC()) {
        this.mac = mac;
        this.macH = toHex(mac, 12);
    }
}
class Frame {
    constructor(dest, src, type, payload) {
        this.dest = dest;
        this.src = src;
        this.type = type;
        this.payload = payload;
    }
    print() {
        return 'src: ' + this.src.macH + '\ndest: ' + this.dest.macH +
            '\ntype: ' + this.type + '\npayload:' +
            Array.from(this.payload).map((x) => { return toHex(x, 2); }).join(' ');
    }
}
const RSTP_HELLO_TIME = 2;
const RSTP_FWD_DELAY = 15;
const RSTP_MAX_AGE = 20;
class BasePort {
    constructor(parent, id) {
        this.peer = null;
        this.queue = [];
        this.parent = parent;
        this._id = id;
        nodes.set(this.id(), this);
        setInterval(this.check.bind(this), 100);
    }
    destructor() {
        nodes.delete(this.id());
    }
    id() {
        return this.parent.id() + '-' + this._id;
    }
    name() {
        return this.parent.id() + ' Port' + this._id;
    }
    check() {
        let frame = this.queue.pop();
        if (frame)
            this.recv(frame);
    }
    recv(frame) {
        this.parent.recv(frame, this);
    }
    send(frame) {
        if (this.peer === null)
            return false;
        this.peer.queue.push(frame);
        return true;
    }
}
class BaseDevice {
    constructor(id = randomId(), mac = new MAC()) {
        this._id = id;
        this.mac = mac;
        nodes.set(this.id(), this);
    }
    destructor() {
        nodes.delete(this.id());
    }
    id() {
        return this._id;
    }
    name() {
        return this.constructor.name + ' ' + this._id + '(' + this.mac.macH + ')';
    }
    recv(frame, src) {
        console.log(this.name() + ' received a frame on port ' + src.id() + ':');
        console.log(frame.print());
    }
}
class Edge extends BaseDevice {
    constructor() {
        super(...arguments);
        this.port = new BasePort(this, 0);
    }
    send(to, payload = randomPayload(16)) {
        console.log(this.name() + ' sent a frame to ' + to.macH);
        if (!this.port.send(new Frame(to, this.mac, 0x0800, payload))) {
            console.warn(this.name() + ' failed to send()');
        }
    }
}
class Hub extends BaseDevice {
    constructor(nPorts, id = randomId(), mac = new MAC()) {
        super(id, mac);
        this.ports = [];
        for (let i = 0; i < nPorts; i++) {
            this.ports[i] = new BasePort(this, i);
        }
    }
    recv(frame, src) {
        this.ports.forEach((x) => {
            if (x !== src)
                x.send(frame);
        });
    }
}
class Bridge extends BaseDevice {
    constructor(nPorts, id = randomId(), mac = new MAC()) {
        super(id, mac);
        this.ports = [];
        for (let i = 0; i < nPorts; i++) {
            this.ports[i] = new BasePort(this, i);
        }
        this.table = new Map();
    }
    recv(frame, src) {
        super.recv(frame, src);
        this.table.set(frame.src.mac, src);
        let destPort = this.table.get(frame.dest.mac);
        if (destPort) {
            if (destPort !== src)
                destPort.send(frame);
        }
        else {
            this.ports.forEach((x) => {
                if (x !== src)
                    x.send(frame);
            });
        }
    }
}
function connect(x, y) {
    if (x.peer || y.peer) {
        console.error('Could not connect ' + x.id() + ' with ' + y.id() + '!');
        return false;
    }
    x.peer = y;
    y.peer = x;
    let xid = (x.parent instanceof Bridge) ? x.id() : x.parent.id();
    let yid = (y.parent instanceof Bridge) ? y.id() : y.parent.id();
    edges.add(xid + ',' + yid);
    return true;
}
function disconnect(x, y) {
    if (x.peer !== y || y.peer !== x) {
        console.error('Could not disconnect ' + x.id() + ' with ' + y.id() + '!');
        return false;
    }
    x.peer = null;
    y.peer = null;
    let xid = (x.parent instanceof Bridge) ? x.id() : x.parent.id();
    let yid = (y.parent instanceof Bridge) ? y.id() : y.parent.id();
    edges.delete(xid + ',' + yid);
    edges.delete(yid + ',' + xid);
    return true;
}
