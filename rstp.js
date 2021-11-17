"use strict";
function toHex(x, digits) {
    return ('0'.repeat(digits) + Number(x).toString(16)).slice(-digits).toUpperCase();
}
class MAC {
    constructor(mac = randomMAC()) {
        this.mac = mac;
        this.macH = toHex(mac, 12);
    }
    equals(that) {
        return this.mac == that.mac;
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
        console.log(`src: ${this.src.macH}
dest: ${this.dest.macH}
type: ${this.type}
payload: ${Array.from(this.payload).map((x) => { return toHex(x, 2); }).join(' ')}`);
    }
}
const MS_PER_SECOND = 500;
const RSTP_HELLO_TIME = 2 * MS_PER_SECOND;
const RSTP_FWD_DELAY = 15 * MS_PER_SECOND;
const RSTP_MAX_AGE = 20;
class bpduBridgeID {
    constructor(mac, priority = 0x7fff) {
        this.mac = mac;
        this.priority = priority & 0xffff;
    }
    equals(that) {
        return this.mac.equals(that.mac) && this.priority === that.priority;
    }
    superior(that) {
        if (this.priority < that.priority)
            return true;
        if (this.priority > that.priority)
            return false;
        if (this.mac.mac < that.mac.mac)
            return true;
        if (this.mac.mac > that.mac.mac)
            return false;
        return false;
    }
}
class bpduPortID {
    constructor(id, priority = 0x8) {
        this.id = id;
        this.priority = priority & 0xf;
    }
    equals(that) {
        return this.id === that.id && this.priority === that.priority;
    }
    superior(that) {
        if (this.priority < that.priority)
            return true;
        if (this.priority > that.priority)
            return false;
        if (this.id < that.id)
            return true;
        if (this.id > that.id)
            return false;
        return false;
    }
}
var PortState;
(function (PortState) {
    PortState[PortState["Discard"] = 0] = "Discard";
    PortState[PortState["Learn"] = 1] = "Learn";
    PortState[PortState["Forward"] = 2] = "Forward";
})(PortState || (PortState = {}));
var PortRole;
(function (PortRole) {
    PortRole[PortRole["Alternate"] = 1] = "Alternate";
    PortRole[PortRole["Root"] = 2] = "Root";
    PortRole[PortRole["Designated"] = 3] = "Designated";
})(PortRole || (PortRole = {}));
class BPDU {
    constructor(root, cost, sender, port, state, role, age, proposal = false, agreement = false, topoChange = false, helloTime = RSTP_HELLO_TIME, fwdDelay = RSTP_FWD_DELAY, maxAge = RSTP_MAX_AGE) {
        this.rootID = root;
        this.cost = cost;
        this.senderID = sender;
        this.portID = port;
        this.state = state;
        this.role = role;
        this.msgAge = age;
        this.proposal = proposal;
        this.agreement = agreement;
        this.topoChange = topoChange;
        this.helloTime = helloTime;
        this.fwdDelay = fwdDelay;
        this.maxAge = maxAge;
    }
    superior(that) {
        if (this.rootID.superior(that.rootID))
            return true;
        if (that.rootID.superior(this.rootID))
            return false;
        if (this.cost < that.cost)
            return true;
        if (this.cost > that.cost)
            return false;
        if (this.senderID.superior(that.senderID))
            return true;
        if (that.senderID.superior(this.senderID))
            return false;
        if (this.portID.superior(that.portID))
            return true;
        if (that.portID.superior(this.portID))
            return false;
        return false;
    }
    print() {
        console.log(`BPDU: 
bridge ${this.senderID.priority}.${this.senderID.mac.macH} regards
bridge ${this.rootID.priority}.${this.rootID.mac.macH} as root with cost ${this.cost} at
${[, 'alternate', 'root', 'designated'][this.role]} port ${this.portID.priority}.${this.portID.id} ` +
            `which is ${['discarding', 'learning', 'forwarding',][this.state]}
age: ${this.msgAge} flag:${this.topoChange ? ' TC' : ''}${this.proposal ? ' proposal' : ''}${this.agreement ? ' agreement' : ''}`);
    }
    toFrame(src, agreement = false) {
        let payload = new Uint8Array(39);
        payload[0] = payload[1] = 0x42;
        payload[2] = 0x03;
        payload[5] = payload[6] = 0x02;
        payload[7] = (this.topoChange ? 1 : 0) + (this.proposal ? 2 : 0) + (this.role << 2) + (this.state << 4) + (this.agreement ? 64 : 0);
        for (let i = 0, j = 16 - 8; i < 2; i++, j -= 8)
            payload[8 + i] = (this.rootID.priority >>> j) & 0xff;
        for (let i = 0, j = 48 - 8; i < 6; i++, j -= 8)
            payload[10 + i] = Math.floor(this.rootID.mac.mac / Math.pow(2, j)) % 256;
        for (let i = 0, j = 32 - 8; i < 4; i++, j -= 8)
            payload[16 + i] = (this.cost >>> j) & 0xff;
        for (let i = 0, j = 16 - 8; i < 2; i++, j -= 8)
            payload[20 + i] = (this.senderID.priority >>> j) & 0xff;
        for (let i = 0, j = 48 - 8; i < 6; i++, j -= 8)
            payload[22 + i] = Math.floor(this.senderID.mac.mac / Math.pow(2, j)) % 256;
        payload[28] = (((this.portID.priority << 4) & 0xf0) + ((this.portID.id >>> 8) & 0x0f)) & 0xff;
        payload[29] = this.portID.id & 0xff;
        payload[30] = this.msgAge & 0xff;
        payload[32] = this.maxAge & 0xff;
        payload[34] = this.helloTime & 0xff;
        payload[36] = this.fwdDelay & 0xff;
        if (agreement) {
            payload[7] ^= 66;
        }
        return new Frame(new MAC(0x0180C2000000), src, 0x27, payload);
    }
    static fromFrame(frame) {
        let p = frame.payload;
        return new BPDU(new bpduBridgeID(new MAC(((p[10] << 8) + (p[11] << 0)) * Math.pow(2, 32) + (p[12] << 24) + (p[13] << 16) + (p[14] << 8) + (p[15] << 0)), (p[8] << 8) + (p[9] << 0)), (p[16] << 24) + (p[17] << 16) + (p[18] << 8) + (p[19] << 0), new bpduBridgeID(new MAC(((p[22] << 8) + (p[23] << 0)) * Math.pow(2, 32) + (p[24] << 24) + (p[25] << 16) + (p[26] << 8) + (p[27] << 0)), (p[20] << 8) + (p[21] << 0)), new bpduPortID(((p[28] & 0x0f) << 8) + (p[29] << 0), (p[28] >>> 4) & 0x0f), (p[7] >>> 4) & 0x03, (p[7] >>> 2) & 0x03, p[30], (p[7] & 0x02) ? true : false, (p[7] & 0x40) ? true : false, (p[7] & 0x01) ? true : false, p[34], p[36], p[32]);
    }
}
class BasePort {
    constructor(parent, id, bandwidth = 1000) {
        this.bandwidth = 1000;
        this.peer = null;
        this.duplex = null;
        this.speed = 0;
        this.queue = [];
        this.g = null;
        this.parent = parent;
        this._id = id;
        this.bandwidth = bandwidth;
        setInterval(() => {
            let frame = this.queue.pop();
            if (frame)
                this.recv(frame);
        }, 100);
    }
    destructor() {
    }
    id() {
        return `${this.parent.id()}-${this._id}`;
    }
    name() {
        return `${this.parent.name()} Port ${this._id}`;
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
    connect(that, g) {
        this.duplex = !(this.parent instanceof Hub || that.parent instanceof Hub);
        this.speed = this.bandwidth < that.bandwidth ? this.bandwidth : that.bandwidth;
        this.peer = that;
        this.g = g;
    }
    disconnect() {
        this.duplex = null;
        this.speed = 0;
        this.peer = null;
        this.g = null;
        this.queue = [];
    }
}
class BaseDevice {
    constructor(id = randomId(), mac = new MAC()) {
        this._id = id;
        this.mac = mac;
    }
    destructor() {
    }
    id() {
        return this._id;
    }
    name() {
        return `${this.constructor.name} ${this._id}(${this.mac.macH})`;
    }
    recv(frame, src) {
        frame;
        src;
        //console.log(`${this.name()} received a frame on port ${src.id()}:`)
        //frame.print()
    }
}
class Edge extends BaseDevice {
    constructor(id = randomId(), mac = new MAC()) {
        super(id, mac);
        this.port = new BasePort(this, 0);
        this.g = {
            type: 'rect',
            id: this.id(),
            label: this.id(),
            cluster: this.id()
        };
        graph.addItem('node', this.g);
    }
    send(to, payload = randomPayload(16)) {
        console.log(`${this.name()} sent a frame to ${to.macH}`);
        if (!this.port.send(new Frame(to, this.mac, 0x0800, payload))) {
            console.warn(`${this.name()} failed to send()`);
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
        this.g = {
            type: 'diamond',
            id: this.id(),
            label: this.id(),
            cluster: this.id()
        };
        graph.addItem('node', this.g);
    }
    recv(frame, src) {
        this.ports.forEach((x) => {
            if (x !== src)
                x.send(frame);
        });
    }
}
class RSTPPort extends BasePort {
    constructor(parent, id) {
        super(parent, id);
        this.edge = true;
        this._role = PortRole.Designated;
        this._state = PortState.Discard;
        this.topoChange = false;
        this.cost = 0;
        this.bestBPDU = null;
        this.timerState = null;
        this.timerBPDU = null;
        this.parent = parent;
        this.myID = new bpduPortID(id);
        setInterval(this.hello.bind(this), RSTP_HELLO_TIME);
        this.gRSTP = {
            comboId: this.parent.id(),
            id: this.id(),
            label: this.id(),
            cluster: this.parent.id(),
            style: {
                lineWidth: 20
            }
        };
        graph.addItem('node', this.gRSTP);
        graph.setItemState(this.id(), 'defunct', true);
        graph.updateCombo(this.parent.id());
    }
    get state() { return this._state; }
    set state(state) {
        this._state = state;
        graph.setItemState(this.id(), 'state', ['discard', 'learn', 'forward'][state]);
    }
    get role() { return this._role; }
    set role(role) {
        this._role = role;
        graph.setItemState(this.id(), 'role', [, 'alternate', 'root', 'designated'][role]);
    }
    myBPDU() {
        return new BPDU(this.parent.root, (this.parent.rootPort ? this.parent.rootCost : 0) + this.cost, this.parent.myID, this.myID, this.state, this.role, (this.parent.rootPort ? this.parent.rootAge : -1) + 1, (this.duplex === true &&
            this.role === PortRole.Designated &&
            this.state < PortState.Forward), false, this.topoChange);
    }
    connect(that, g) {
        super.connect(that, g);
        console.log(`${this.name()} connected`);
        this.role = PortRole.Designated;
        console.log(`${this.name()} is made DESIGNATED by up`);
        this.cost = Math.floor(20000000 / this.speed);
        if (this.edge) {
            console.log(`${this.name()} entering FORWARDING by edge`);
            this.state = PortState.Forward;
        }
        else {
            console.log(`${this.name()} converging by connect`);
            this.converge(PortRole.Designated);
        }
    }
    disconnect() {
        super.disconnect();
        console.log(`${this.name()} disconnected`);
        this.state = PortState.Discard;
        console.log(`${this.name()} entering DISCARDING by down`);
        if (this.timerState)
            clearTimeout(this.timerState);
        if (this.timerBPDU)
            clearTimeout(this.timerBPDU);
        this.bestBPDU = null;
        this.parent.fail(this);
        this.clearTable();
        graph.setItemState(this.id(), 'defunct', true);
    }
    hello() {
        if (this.peer &&
            (this.role === PortRole.Designated ||
                (this.role === PortRole.Root &&
                    this.topoChange))) {
            //console.log(`BPDU sent from ${this.name()}`)
            //this.myBPDU().print()
            this.send(this.myBPDU().toFrame(this.parent.mac));
        }
    }
    block(bpdu) {
        if (!this.bestBPDU || bpdu.superior(this.bestBPDU))
            this.bestBPDU = bpdu;
        if (this.role === PortRole.Alternate) {
            if (this.timerState)
                clearTimeout(this.timerState);
        }
        if (this.timerBPDU)
            clearTimeout(this.timerBPDU);
        this.timerBPDU = setTimeout(() => {
            this.parent.fail(this); ////
            console.log(`${this.name()} converging by timeout`);
            this.converge(PortRole.Designated);
        }, 3 * RSTP_HELLO_TIME);
    }
    converge(role) {
        this.bestBPDU = null;
        if (this.timerBPDU)
            clearTimeout(this.timerBPDU);
        this.role = role;
        this.state = PortState.Discard;
        console.log(`${this.name()} is made ${[, 'ALTERNATE', 'ROOT', 'DESIGNATED'][this.role]} by converging...`);
        console.log(`${this.name()} entering DISCARDING by converging...`);
        this.clearTable();
        if (this.timerState)
            clearTimeout(this.timerState);
        this.timerState = setTimeout(() => {
            this.state = PortState.Learn;
            console.log(`${this.name()} entering LEARNING by timer...`);
            this.timerState = setTimeout(() => {
                this.state = PortState.Forward;
                console.log(`${this.name()} entering FORWARDING by timer`);
                this.parent.topoChange(this, true);
            }, RSTP_FWD_DELAY);
        }, RSTP_FWD_DELAY);
        this.hello();
    }
    clearTable() {
        this.parent.table.forEach((port, mac) => {
            if (port === this)
                this.parent.table.delete(mac);
        });
    }
}
class Bridge extends BaseDevice {
    constructor(nPorts, id = randomId(), mac = new MAC()) {
        super(id, mac);
        this.ports = [];
        this.rootCost = 0;
        this.rootAge = 0;
        this.rootPort = null;
        this.table = new Map();
        this.root = this.myID = new bpduBridgeID(mac);
        this.g = {
            id: this.id(),
            label: this.id()
        };
        graph.createCombo(this.g, []);
        for (let i = 0; i < nPorts; i++) {
            this.ports[i] = new RSTPPort(this, i);
        }
    }
    recv(frame, src) {
        super.recv(frame, src);
        if (src.state > PortState.Discard) {
            this.table.set(frame.src.mac, src);
        }
        if (frame.dest.mac === 0x0180C2000000) {
            if (frame.type !== 0x27)
                return;
            if (frame.payload[0] !== 0x42)
                return;
            if (frame.payload[1] !== 0x42)
                return;
            if (frame.payload[3] !== 0x00)
                return;
            if (frame.payload[4] !== 0x00)
                return;
            if (frame.payload[5] !== 0x02)
                return;
            if (frame.payload[6] !== 0x02)
                return;
            this.recvBPDU(BPDU.fromFrame(frame), src);
        }
        else {
            if (src.state !== PortState.Forward)
                return;
            let destPort = this.table.get(frame.dest.mac);
            if (destPort &&
                destPort !== src &&
                destPort.state === PortState.Forward)
                destPort.send(frame);
            else {
                this.ports.forEach((x) => {
                    if (x !== src &&
                        x.state === PortState.Forward)
                        x.send(frame);
                });
            }
        }
    }
    recvBPDU(bpdu, src) {
        //bpdu.print()
        if (src.edge) {
            src.edge = false;
            console.log(`${src.name()} is converging by non-edge`);
            src.converge(PortRole.Designated);
        }
        if (bpdu.msgAge > bpdu.maxAge)
            return;
        if (bpdu.agreement &&
            src.role === PortRole.Designated &&
            src.duplex === true) {
            src.state = PortState.Forward;
            console.log(`${src.name()} entering FORWARDING by agreemnet`);
            this.topoChange(src, true);
            if (src.timerState)
                clearTimeout(src.timerState);
            return;
        }
        if (bpdu.topoChange &&
            src.state === PortState.Forward)
            this.topoChange(src);
        if (bpdu.rootID.superior(this.root) ||
            (this.rootPort &&
                this.rootPort.bestBPDU &&
                bpdu.superior(this.rootPort.bestBPDU))) {
            this.root = bpdu.rootID;
            this.rootCost = bpdu.cost;
            this.rootAge = bpdu.msgAge;
            this.rootPort = src;
            console.log(`${src.name()} converging by root`);
            src.converge(PortRole.Root);
            this.ports.forEach((x) => {
                if (x.peer &&
                    !x.edge &&
                    x !== src &&
                    x.role !== PortRole.Alternate) {
                    console.log(`${x.name()} converging by root update`);
                    x.converge(PortRole.Designated);
                }
            });
            if (bpdu.proposal &&
                src.duplex === true) {
                src.send(bpdu.toFrame(this.mac, true));
                src.state = PortState.Forward;
                console.log(`${src.name()} entering FORWARDING by send agreemnet`);
                this.topoChange(src, true);
                if (src.timerState)
                    clearTimeout(src.timerState);
            }
        }
        if (bpdu.superior(src.myBPDU())) { // bpdu > myBPDU
            if (src.role === PortRole.Designated) {
                src.role = PortRole.Alternate;
                console.log(`${src.name()} is made ALTERNATE by BPDU`);
                src.state = PortState.Discard;
                console.log(`${src.name()} entering DISCARDING by BPDU`);
                //bpdu.print()
            }
            src.block(bpdu);
        }
        else if (src.myBPDU().superior(bpdu) && // myBPDU > bpdu
            src.role === PortRole.Alternate &&
            src.bestBPDU &&
            src.bestBPDU.senderID.equals(bpdu.senderID)) {
            console.log(`${src.name()} converging by inferior bpdu`);
            //bpdu.print()
            src.converge(PortRole.Designated);
        }
    }
    topoChange(src, detected = false) {
        console.log(`Topology change ${detected ? 'detected' : 'received'} on ${src.name()}`);
        this.ports.forEach((x) => {
            if (detected || x !== src) {
                x.topoChange = true;
                setTimeout(() => {
                    x.topoChange = false;
                }, 2 * RSTP_HELLO_TIME);
            }
            if (x !== src) {
                x.clearTable();
            }
        });
    }
    fail(port) {
        if (port.role === PortRole.Root) {
            let newRoot = null;
            for (let x of this.ports) {
                if (x.role === PortRole.Alternate &&
                    x.bestBPDU && x.bestBPDU.rootID.equals(this.root) &&
                    (!newRoot ||
                        (newRoot.bestBPDU && x.bestBPDU.superior(newRoot.bestBPDU))))
                    newRoot = x;
            }
            if (newRoot && newRoot.bestBPDU) {
                this.rootCost = newRoot.bestBPDU.cost;
                this.rootAge = newRoot.bestBPDU.msgAge;
                this.rootPort = newRoot;
                newRoot.role = PortRole.Root;
                console.log(`${newRoot.name()} is made ROOT by root fail`);
                newRoot.state = PortState.Forward;
                console.log(`${newRoot.name()} entering FORWARDING by root fail`);
                this.topoChange(newRoot, true);
            }
            else {
                console.log(`${this.name()} lost connection to root!`);
                this.root = this.myID;
                this.rootAge = 0;
                this.rootCost = 0;
                this.rootPort = null;
                this.ports.forEach((x) => {
                    if (x.peer && !x.edge) {
                        console.log(`${x.name()} converging by root fail`);
                        x.converge(PortRole.Designated);
                    }
                });
            }
        }
        if (port.role === PortRole.Designated) {
            for (let x of this.ports) {
                if (x.role === PortRole.Alternate &&
                    x.bestBPDU &&
                    x.bestBPDU.senderID.equals(this.myID) &&
                    x.bestBPDU.portID.equals(port.myID)) {
                    x.bestBPDU = null;
                    if (x.timerBPDU)
                        clearTimeout(x.timerBPDU);
                    x.role = PortRole.Designated;
                    console.log(`${x.name()} is made DESIGNATED by designated fail`);
                    x.state = PortState.Forward;
                    console.log(`${x.name()} entering FORWARDING by designated fail`);
                    this.topoChange(x, true);
                    break;
                }
            }
        }
    }
}
function connect(x, y, cost) {
    if (x.peer || y.peer) {
        console.error(`Could not connect ${x.name()} with ${y.name()}!`);
        return false;
    }
    let xid = (x instanceof RSTPPort) ? x.id() : x.parent.id();
    let yid = (y instanceof RSTPPort) ? y.id() : y.parent.id();
    let g = {
        id: xid + ',' + yid,
        source: xid,
        target: yid,
    };
    graph.addItem('edge', g);
    x.connect(y, g);
    y.connect(x, g);
    if (cost && (x instanceof RSTPPort))
        x.cost = cost;
    if (cost && (y instanceof RSTPPort))
        y.cost = cost;
    return true;
}
function disconnect(x, y) {
    if (x.peer !== y || y.peer !== x) {
        console.error(`Could not disconnect ${x.name()} with ${y.name()}!`);
        return false;
    }
    x.disconnect();
    y.disconnect();
    let xid = (x instanceof RSTPPort) ? x.id() : x.parent.id();
    let yid = (y instanceof RSTPPort) ? y.id() : y.parent.id();
    let edge = graph.findById(xid + ',' + yid) || graph.findById(yid + ',' + xid);
    graph.removeItem(edge);
    return true;
}
function failure(x) {
    if (!x.peer) {
        console.error(`${x.name()} not connected!`);
        return false;
    }
    let xid = (x instanceof RSTPPort) ? x.id() : x.parent.id();
    let y = x.peer;
    let yid = (y instanceof RSTPPort) ? y.id() : y.parent.id();
    x.peer = null;
    y.peer = null;
    let edge = graph.findById(xid + ',' + yid) || graph.findById(yid + ',' + xid);
    graph.setItemState(edge, 'fail', true);
    return true;
}
