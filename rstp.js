"use strict";
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
class BasePort {
    constructor(parent, id) {
        this.peer = null;
        this.queue = [];
        this.parent = parent;
        this.id = id;
        setInterval(this.check.bind(this), 100);
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
    constructor(name = randomName(), mac = new MAC()) {
        this.name = name;
        this.mac = mac;
    }
    id() {
        return this.constructor.name + ' ' + this.name + '(' + this.mac.macH + ')';
    }
    recv(frame, src) {
        console.log(this.id() + ' received a frame on port ' + src.id + ':');
        console.log(frame.print());
    }
}
class Edge extends BaseDevice {
    constructor() {
        super(...arguments);
        this.port = new BasePort(this, 0);
    }
    send(to, payload = randomPayload(16)) {
        console.log(this.id() + ' sent a frame to ' + to.macH);
        if (!this.port.send(new Frame(to, this.mac, 0x0800, payload))) {
            console.warn(this.id() + ' failed to send()');
        }
    }
}
class Hub extends BaseDevice {
    constructor(nPorts, name = randomName(), mac = new MAC()) {
        super(name, mac);
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
    constructor(nPorts, name = randomName(), mac = new MAC()) {
        super(name, mac);
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
