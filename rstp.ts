var nodes = new Map<string, Device|Port>()
var edges = new Set<string>()

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
    print(): void {
        console.log(`src: ${this.src.macH}
dest: ${this.dest.macH}
type: ${this.type}
payload: ${Array.from(this.payload).map((x) => {return toHex(x, 2)}).join(' ')}`)
    }
}

const RSTP_HELLO_TIME = 2
const RSTP_FWD_DELAY = 15
const RSTP_MAX_AGE = 20
const MS_PER_SECOND = 100
class bpduBridgeID {
    readonly priority: number
    readonly mac: MAC
    constructor(mac: MAC, priority: number=0x7fff) {
        this.mac = mac
        this.priority = priority&0xffff
    }
    superior(that: bpduBridgeID): boolean {
        if(this.priority < that.priority) return true
        if(this.priority > that.priority) return false
        if(this.mac.mac < that.mac.mac) return true
        if(this.mac.mac > that.mac.mac) return false
        return false
    }
}
class bpduPortID {
    readonly priority: number
    readonly id: number
    constructor(id: number, priority: number=0x8) {
        this.id = id
        this.priority = priority&0xf
    }
    superior(that: bpduPortID): boolean {
        if(this.priority < that.priority) return true
        if(this.priority > that.priority) return false
        if(this.id < that.id) return true
        if(this.id > that.id) return false
        return false
    }
}
enum PortState {Discard=0, Learn=1, Forward=2}
enum PortRole {Alternate=1, Root=2, Designated=3}
class BPDU {
    readonly topoChange: boolean
    readonly proposal: boolean
    readonly agreement: boolean
    readonly state: PortState
    readonly role: PortRole
    readonly rootID: bpduBridgeID
    readonly cost: number
    readonly senderID: bpduBridgeID
    readonly portID: bpduPortID
    readonly msgAge: number
    readonly maxAge: number
    readonly helloTime: number
    readonly fwdDelay: number
    constructor(
        root: bpduBridgeID,
        cost: number,
        sender: bpduBridgeID,
        port: bpduPortID,
        state: PortState,
        role: PortRole,
        age: number,
        proposal: boolean = false,
        agreement: boolean = false,
        topoChange: boolean = false,
        helloTime: number = RSTP_HELLO_TIME,
        fwdDelay: number = RSTP_FWD_DELAY,
        maxAge: number = RSTP_MAX_AGE
    ) {
        this.rootID = root
        this.cost = cost
        this.senderID = sender
        this.portID = port
        this.state = state
        this.role = role
        this.msgAge = age
        this.proposal = proposal
        this.agreement = agreement
        this.topoChange = topoChange
        this.helloTime = helloTime
        this.fwdDelay = fwdDelay
        this.maxAge = maxAge
    }
    superior(that: BPDU): boolean {
        if(this.rootID.superior(that.rootID)) return true
        if(that.rootID.superior(this.rootID)) return false
        if(this.cost < that.cost) return true
        if(this.cost > that.cost) return false
        if(this.senderID.superior(that.senderID)) return true
        if(that.senderID.superior(this.senderID)) return false
        if(this.portID.superior(that.portID)) return true
        if(that.portID.superior(this.portID)) return false
        return false
    }
    print(): void {
        console.log(
`BPDU: 
bridge ${this.senderID.priority}.${this.senderID.mac.macH} regards
bridge ${this.rootID.priority}.${this.rootID.mac.macH} as root with cost ${this.cost} at
${[, 'alternate', 'root', 'designated'][this.role]} port ${this.portID.priority}.${this.portID.id} `+
`which is ${['discarding', 'learning', 'forwarding',][this.state]}
age: ${this.msgAge} flag:${this.topoChange?' TC':''}${this.proposal?' proposal':''}${this.agreement?' agreement':''}`
        )
    }
    toFrame(src: MAC): Frame {
        let payload = new Uint8Array(39)
        payload[0] = payload[1] = 0x42
        payload[2] = 0x03
        payload[5] = payload[6] = 0x02
        payload[7] =  (this.topoChange?1:0) + (this.proposal?2:0) + (this.role<<2) + (this.state<<4) + (this.agreement?64:0)
        for(let i=0, j=16-8; i<2; i++, j-=8) payload[8+i] = (this.rootID.priority>>>j)&0xff
        for(let i=0, j=48-8; i<6; i++, j-=8) payload[10+i] = Math.floor(this.rootID.mac.mac/Math.pow(2,j))%256
        for(let i=0, j=32-8; i<4; i++, j-=8) payload[16+i] = (this.cost>>>j)&0xff
        for(let i=0, j=16-8; i<2; i++, j-=8) payload[20+i] = (this.senderID.priority>>>j)&0xff
        for(let i=0, j=48-8; i<6; i++, j-=8) payload[22+i] = Math.floor(this.senderID.mac.mac/Math.pow(2,j))%256
        payload[28] = (((this.portID.priority<<4)&0xf0)+((this.portID.id>>>8)&0x0f))&0xff
        payload[29] = this.portID.id&0xff
        payload[30] = this.msgAge&0xff
        payload[32] = this.maxAge&0xff
        payload[34] = this.helloTime&0xff
        payload[36] = this.fwdDelay&0xff
        return new Frame(new MAC(0x0180C2000000), src, 0x27, payload)
    }
    static fromFrame(frame: Frame): BPDU {
        let p = frame.payload
        return new BPDU(
            new bpduBridgeID(
                new MAC(
                    ((p[10]<<8)+(p[11]<<0))*Math.pow(2,32)+(p[12]<<24)+(p[13]<<16)+(p[14]<<8)+(p[15]<<0)
                ),
                (p[8]<<8)+(p[9]<<0)
            ),
            (p[16]<<24)+(p[17]<<16)+(p[18]<<8)+(p[19]<<0),
            new bpduBridgeID(
                new MAC(
                    ((p[22]<<8)+(p[23]<<0))*Math.pow(2,32)+(p[24]<<24)+(p[25]<<16)+(p[26]<<8)+(p[27]<<0)
                ),
                (p[20]<<8)+(p[21]<<0)
            ),
            new bpduPortID(
                ((p[28]&0x0f)<<8)+(p[29]<<0),
                (p[28]>>>4)&0x0f
            ),
            (p[7]>>>4)&0x03,
            (p[7]>>>2)&0x03,
            p[30],
            (p[7]&0x02)?true:false,
            (p[7]&0x40)?true:false,
            (p[7]&0x01)?true:false,
            p[34],
            p[36],
            p[32]
        )
    }
}

interface Port {
    readonly parent: Device
    peer: Port|null
    ptp: boolean|null
    queue: Frame[]
    destructor(): void
    id(): string
    name(): string
    recv(frame: Frame): void
    send(frame: Frame): boolean
    connect(that: Port): void
    disconnect(): void
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
    ptp: boolean|null = null
    queue: Frame[] = []
    constructor(parent: Device, id: number) {
        this.parent = parent
        this._id = id
        nodes.set(this.id(), this)
        setInterval(() => {
            let frame = this.queue.pop()
            if(frame) this.recv(frame)
        }, 100)
    }
    destructor(): void {
        nodes.delete(this.id())
    }
    id(): string {
        return `${this.parent.id()}-${this._id}`
    }
    name(): string {
        return `${this.parent.id()} Port ${this._id}`
    }
    recv(frame: Frame): void {
        this.parent.recv(frame, this)
    }
    send(frame: Frame): boolean {
        if(this.peer === null) return false
        this.peer.queue.push(frame)
        return true
    }
    connect(that: Port): void {
        this.ptp = !(this.parent instanceof Hub || that.parent instanceof Hub)
        this.peer = that
    }
    disconnect(): void {
        this.ptp = null
        this.peer = null
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
        return `${this.constructor.name} ${this._id}(${this.mac.macH})`
    }
    recv(frame: Frame, src: Port): void {
        frame
        src
        //console.log(`${this.name()} received a frame on port ${src.id()}:`)
        //frame.print()
    }
}

class Edge extends BaseDevice implements Device {
    port: Port = new BasePort(this, 0)
    send(to: MAC, payload: Uint8Array=randomPayload(16)): void {
        console.log(`${this.name()} sent a frame to ${to.macH}`)
        if(!this.port.send(new Frame(to, this.mac, 0x0800, payload))) {
            console.warn(`${this.name()} failed to send()`)
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

class RSTPPort extends BasePort implements Port {
    override readonly parent: Bridge
    edge: boolean = true
    role: PortRole = PortRole.Designated
    state: PortState = PortState.Discard
    topoChange: boolean = false
    readonly myID: bpduPortID
    readonly cost: number
    bestBPDU: BPDU|null = null
    timerState: number|null = null
    timerBPDU: number|null = null

    constructor(parent: Bridge, id: number, cost: number=20000) {
        super(parent, id)
        this.parent = parent
        this.cost = cost
        this.myID = new bpduPortID(id)
        setInterval(this.hello.bind(this), RSTP_HELLO_TIME*MS_PER_SECOND)
    }
    myBPDU(): BPDU {
        return new BPDU(
            this.parent.root,
            (this.parent.rootPort?this.parent.rootCost:0)+this.cost,
            this.parent.myID,
            this.myID,
            this.state,
            this.role,
            (this.parent.rootPort?this.parent.rootAge:-1)+1,
            (this.role === PortRole.Designated && this.state < PortState.Forward),
            false,
            this.topoChange
        )
    }
    override connect(that: Port): void {
        super.connect(that)
        console.log(`${this.id()} connected`)
        console.log(`${this.id()} is made DESIGNATED by up`)
        if(this.edge) {
            console.log(`${this.id()} entering FORWARDING by edge`)
            this.state = PortState.Forward
        }
        else {
            this.converge(PortRole.Designated)
        }
    }
    override disconnect(): void {
        super.disconnect()
        console.log(`${this.id()} disconnected`)
        this.state = PortState.Discard
        console.log(`${this.id()} entering DISCARDING by down`)
        // TODO: Alternate/Backup election
        //////////////// TODO: Physical Failure handle
        this.bestBPDU = null
        if(this.timerState) {
            clearTimeout(this.timerState)
            this.timerState = null
        }
        if(this.timerBPDU) {
            clearTimeout(this.timerBPDU)
            this.timerBPDU = null
        }
    }
    hello() {
        if(
            this.peer &&
            (
                this.role === PortRole.Designated ||
                (
                    this.role === PortRole.Root &&
                    this.topoChange
                )
            )
        ) {
            //console.log(`BPDU sent from ${this.id()}`)
            //this.myBPDU().print()
            this.send(this.myBPDU().toFrame(this.parent.mac))
        }
    }
    block(bpdu: BPDU): void {
        if(!this.bestBPDU||bpdu.superior(this.bestBPDU)) this.bestBPDU = bpdu
        if(this.role !== PortRole.Root) {
            if(this.timerState) clearTimeout(this.timerState)
        }
        if(this.timerBPDU) clearTimeout(this.timerBPDU)
        this.timerBPDU = setTimeout(() => {
            this.converge(PortRole.Designated)
        }, 3*RSTP_HELLO_TIME*MS_PER_SECOND)
    }
    converge(role: PortRole): void {
        this.bestBPDU = null
        if(this.timerBPDU) clearTimeout(this.timerBPDU)
        this.role = role
        this.state = PortState.Discard
        console.log(`${this.id()} is made ${[, 'ALTERNATE', 'ROOT', 'DESIGNATED'][this.role]} by converging...`)
        console.log(`${this.id()} entering DISCARDING by converging...`)
        if(this.timerState) clearTimeout(this.timerState)
        this.timerState = setTimeout(() => {
            this.state = PortState.Learn
            console.log(`${this.id()} entering LEARNING by timer...`)
            this.timerState = setTimeout(() => {
                this.state = PortState.Forward
                console.log(`${this.id()} entering FORWARDING by timer`)
                this.parent.topoChange(this, true)
            }, RSTP_FWD_DELAY*MS_PER_SECOND)
        }, RSTP_FWD_DELAY*MS_PER_SECOND)
        this.hello()
    }
    flushMAC(): void {
        this.parent.table.forEach((port, mac) => {
            if(this === port) this.parent.table.delete(mac)
        })
    }
}

class Bridge extends BaseDevice implements Device {
    ports: RSTPPort[] = []
    table: Map<number, RSTPPort>
    root: bpduBridgeID
    rootCost: number = 0
    rootAge: number = 0
    rootPort: RSTPPort|null = null
    myID: bpduBridgeID
    constructor(nPorts: number, id: string=randomId(), mac: MAC=new MAC()) {
        super(id, mac)
        this.table = new Map<number, RSTPPort>()
        this.root = this.myID = new bpduBridgeID(mac)
        for(let i=0; i<nPorts; i++) {
            this.ports[i] = new RSTPPort(this, i)
        }
    }
    override recv(frame: Frame, src: RSTPPort): void {
        super.recv(frame, src)
        if(src.state > PortState.Discard) {
            this.table.set(frame.src.mac, src)
        }
        if(frame.dest.mac === 0x0180C2000000) {
            if(frame.type !== 0x27) return
            if(frame.payload[0] !== 0x42) return
            if(frame.payload[1] !== 0x42) return
            if(frame.payload[3] !== 0x00) return
            if(frame.payload[4] !== 0x00) return
            if(frame.payload[5] !== 0x02) return
            if(frame.payload[6] !== 0x02) return
            this.recvBPDU(BPDU.fromFrame(frame), src)
        }
        else {
            if(src.state !== PortState.Forward) return
            let destPort = this.table.get(frame.dest.mac)
            if(
                destPort &&
                destPort !== src &&
                destPort.state === PortState.Forward
            ) destPort.send(frame)
            else {
                this.ports.forEach((x) => {
                    if(
                        x !== src &&
                        x.state === PortState.Forward
                    ) x.send(frame)
                })
            }
        }
    }
    recvBPDU(bpdu: BPDU, src: RSTPPort): void {
        //bpdu.print()
        if(src.edge) {
            src.edge = false
            console.log(`${src.id()} is not edge!`)
            src.converge(PortRole.Designated)
        }
        if(bpdu.topoChange) this.topoChange(src)
        if(
            bpdu.rootID.superior(this.root) ||
            (
                this.rootPort &&
                this.rootPort.bestBPDU && // makes tsc happy
                bpdu.superior(this.rootPort.bestBPDU)
            )
        ) {

            this.root = bpdu.rootID
            this.rootCost = bpdu.cost
            this.rootAge = bpdu.msgAge
            this.rootPort = src
            bpdu.print()
            src.converge(PortRole.Root)
            src.block(bpdu)
            this.ports.forEach((x) => {
                if(!x.edge && x!==src) x.converge(PortRole.Designated)
            })
        }
        if(bpdu.superior(src.myBPDU())) { // bpdu > myBPDU
            if(src.role !== PortRole.Root) {
                if(
                    src.role !== PortRole.Alternate ||
                    src.state !== PortState.Discard) {
                    console.log(`${src.id()} is made ALTERNATE by BPDU`)
                    console.log(`${src.id()} entering DISCARDING by BPDU`)
                    bpdu.print()
                }
                src.role = PortRole.Alternate
                src.state = PortState.Discard
            }
            src.block(bpdu)
        }
        else if(
            src.myBPDU().superior(bpdu) && // myBPDU > bpdu
            src.role !== PortRole.Designated
        ){
            src.converge(PortRole.Designated)
        }
    }
    topoChange(src: RSTPPort, detected: boolean=false): void {
        this.ports.forEach((x) => {
            if(detected || x !== src) {
                x.topoChange = true
                setTimeout(() => {
                    x.topoChange = false
                }, 2*RSTP_HELLO_TIME)
            }
            if(x !== src) src.flushMAC()
        })
    }
}

function connect(x: Port, y: Port): boolean {
    if(x.peer || y.peer) {
        console.error(`Could not connect ${x.id()} with ${y.id()}!`)
        return false
    }
    x.connect(y)
    y.connect(x)
    let xid = (x.parent instanceof Bridge) ? x.id() : x.parent.id()
    let yid = (y.parent instanceof Bridge) ? y.id() : y.parent.id()
    edges.add(xid+','+yid)
    return true
}
function disconnect(x: Port, y: Port): boolean {
    if(x.peer!==y || y.peer!==x) {
        console.error(`Could not disconnect ${x.id()} with ${y.id()}!`)
        return false
    }
    x.disconnect()
    y.disconnect()
    let xid = (x.parent instanceof Bridge) ? x.id() : x.parent.id()
    let yid = (y.parent instanceof Bridge) ? y.id() : y.parent.id()
    edges.delete(xid+','+yid)
    edges.delete(yid+','+xid)
    return true
}
