var nodes = new Map<string, Device|Port>();
var edges = new Set<string>();

function toHex(x: number, digits: number): string {
    return ('0'.repeat(digits)+Number(x).toString(16)).slice(-digits).toUpperCase()
}

class MAC {
    readonly mac: number
    readonly macH: string
    constructor(mac: number=randomMAC()) {
        this.mac = mac
        this.macH = toHex(mac, 12)
    }
}

class Frame {
    readonly dest: MAC
    readonly src: MAC
    readonly type: number
    readonly payload: Uint8Array
    constructor(dest: MAC, src: MAC, type: number, payload: Uint8Array) {
        this.dest = dest
        this.src = src
        this.type = type
        this.payload = payload
    }
    print() {
        return 'src: '+this.src.macH+'\ndest: '+this.dest.macH+
            '\ntype: '+this.type+'\npayload:'+
            Array.from(this.payload).map((x) => {return toHex(x, 2)}).join(' ')
    }
}

const RSTP_HELLO_TIME = 2;
const RSTP_FWD_DELAY = 15;
const RSTP_MAX_AGE = 20;

//class BPDU {
//    const prefix: string = '42420300000202'
//}

interface Port {
    readonly parent: Device
    peer: Port|null
    queue: Frame[]
    destructor(): void
    id(): string
    name(): string
    recv(frame: Frame): void
    send(frame: Frame): boolean
}

interface Device {
    readonly mac: MAC
    destructor(): void
    id(): string
    name(): string
    recv(frame: Frame, src: Port): void
}

class BasePort implements Port {
    parent: Device
    _id: number
    peer: Port|null = null
    queue: Frame[] = []
    constructor(parent: Device, id: number) {
        this.parent = parent
        this._id = id
        nodes.set(this.id(), this)
        setInterval(this.check.bind(this), 100)
    }
    destructor(): void {
        nodes.delete(this.id())
    }
    id(): string {
        return this.parent.id()+'-'+this._id
    }
    name(): string {
        return this.parent.id()+' Port'+this._id
    }
    check(): void {
        let frame = this.queue.pop()
        if(frame) this.recv(frame)
    }
    recv(frame: Frame): void {
        this.parent.recv(frame, this)
    }
    send(frame: Frame): boolean {
        if(this.peer === null) return false
        this.peer.queue.push(frame)
        return true
    }
}

class BaseDevice implements Device {
    readonly mac: MAC
    readonly _id: string
    constructor(id: string=randomId(), mac: MAC=new MAC()) {
        this._id = id
        this.mac = mac
        nodes.set(this.id(), this)
    }
    destructor(): void {
        nodes.delete(this.id())
    }
    id(): string {
        return this._id
    }
    name(): string {
        return this.constructor.name+' '+this._id+'('+this.mac.macH+')'
    }
    recv(frame: Frame, src: Port): void {
        console.log(this.name()+' received a frame on port '+src.id()+':')
        console.log(frame.print())
    }
}

class Edge extends BaseDevice implements Device {
    port: Port = new BasePort(this, 0)
    send(to: MAC, payload: Uint8Array=randomPayload(16)): void {
        console.log(this.name()+' sent a frame to '+to.macH)
        if(!this.port.send(new Frame(to, this.mac, 0x0800, payload))) {
            console.warn(this.name()+' failed to send()')
        }
    }
}

class Hub extends BaseDevice implements Device {
    ports: Port[] = []
    constructor(nPorts: number, id: string=randomId(), mac: MAC=new MAC()) {
        super(id, mac)
        for(let i=0; i<nPorts; i++) {
            this.ports[i] = new BasePort(this, i)
        }
    }
    override recv(frame: Frame, src: Port): void {
        this.ports.forEach((x) => {
            if(x!==src) x.send(frame)
        })
    }
}

class Bridge extends BaseDevice implements Device {
    ports: Port[] = []
    table: Map<number, Port>
    constructor(nPorts: number, id: string=randomId(), mac: MAC=new MAC()) {
        super(id, mac)
        for(let i=0; i<nPorts; i++) {
            this.ports[i] = new BasePort(this, i)
        }
        this.table = new Map<number, Port>()
    }
    override recv(frame: Frame, src: Port): void {
        super.recv(frame, src)
        this.table.set(frame.src.mac, src)
        let destPort = this.table.get(frame.dest.mac)
        if(destPort) {
            if(destPort!==src) destPort.send(frame)
        }
        else {
            this.ports.forEach((x) => {
                if(x!==src) x.send(frame)
            })
        }
    }
}

function connect(x: Port, y: Port): boolean {
    if(x.peer || y.peer) {
        console.error('Could not connect '+x.id()+' with '+y.id()+'!')
        return false
    }
    x.peer = y
    y.peer = x
    let xid = (x.parent instanceof Bridge) ? x.id() : x.parent.id()
    let yid = (y.parent instanceof Bridge) ? y.id() : y.parent.id()
    edges.add(xid+','+yid)
    return true
}
function disconnect(x: Port, y: Port): boolean {
    if(x.peer!==y || y.peer!==x) {
        console.error('Could not disconnect '+x.id()+' with '+y.id()+'!')
        return false
    }
    x.peer = null
    y.peer = null
    let xid = (x.parent instanceof Bridge) ? x.id() : x.parent.id()
    let yid = (y.parent instanceof Bridge) ? y.id() : y.parent.id()
    edges.delete(xid+','+yid)
    edges.delete(yid+','+xid)
    return true
}
