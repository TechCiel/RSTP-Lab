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

interface Port {
    parent: Device
    id: number
    peer: Port|null
    queue: Frame[]
    recv(frame: Frame): void
    send(frame: Frame): boolean
}
interface Device {
    readonly mac: MAC
    readonly name: string
    recv(frame: Frame, src: Port): void
}

class BasePort implements Port {
    parent: Device
    id: number
    peer: Port|null = null
    queue: Frame[] = []
    constructor(parent: Device, id: number) {
        this.parent = parent
        this.id = id
        setInterval(this.check.bind(this), 100)
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
    readonly name: string
    constructor(name: string=randomName(), mac: MAC=new MAC()) {
        this.name = name
        this.mac = mac
    }
    id(): string {
        return this.constructor.name+' '+this.name+'('+this.mac.macH+')'
    }
    recv(frame: Frame, src: Port): void {
        console.log(this.id()+' received a frame on port '+src.id+':')
        console.log(frame.print())
    }
}

class Edge extends BaseDevice implements Device {
    port: Port = new BasePort(this, 0)
    send(to: MAC, payload: Uint8Array=randomPayload(16)): void {
        console.log(this.id()+' sent a frame to '+to.macH)
        if(!this.port.send(new Frame(to, this.mac, 0x0800, payload))) {
            console.warn(this.id()+' failed to send()')
        }
    }
}

class Hub extends BaseDevice implements Device {
    ports: Port[] = []
    constructor(nPorts: number, name: string=randomName(), mac: MAC=new MAC()) {
        super(name, mac)
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
    constructor(nPorts: number, name: string=randomName(), mac: MAC=new MAC()) {
        super(name, mac)
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
