"use strict"
let b1 = new Bridge(8, 'b1', new MAC(1))
let b2 = new Bridge(8, 'b2', new MAC(2))
let b3 = new Bridge(8, 'b3', new MAC(3))
let b8 = new Bridge(8, 'b8', new MAC(8))
let h4 = new Hub(8, 'h4')
let h5 = new Hub(8, 'h5')
let h6 = new Hub(8, 'h6')
let h7 = new Hub(8, 'h7')
let e1 = new Edge('e1')
let e2 = new Edge('e2')
let e3 = new Edge('e3')
let e4 = new Edge('e4')
let e5 = new Edge('e5')
let e6 = new Edge('e6')
let e7 = new Edge('e7')
let e8 = new Edge('e8')

connect(b1.ports[1], e1.port)
connect(b2.ports[2], e2.port)
connect(b3.ports[3], e3.port)
connect(h4.ports[4], e4.port)
connect(h5.ports[5], e5.port)
connect(h6.ports[6], e6.port)
connect(h7.ports[7], e7.port)
connect(b8.ports[0], e8.port)

connect(b1.ports[4], h4.ports[1])
connect(b1.ports[5], h5.ports[1])
connect(b1.ports[6], h6.ports[1])
connect(b2.ports[4], h4.ports[2])
connect(b2.ports[5], h5.ports[2])
connect(b2.ports[7], h7.ports[2])
connect(b3.ports[5], h5.ports[3])
connect(b3.ports[6], h6.ports[3])
connect(b3.ports[7], h7.ports[3])
connect(b8.ports[4], h4.ports[0])


var gNodes = []
var gCombos = []
var gEdges = []
nodes.forEach((x) => {
    if(x instanceof BasePort) {
        if(x.parent instanceof Bridge) {
            gNodes.push({
                comboId: x.parent.id(),
                id: x.id(),
                label: x.id(),
                cluster: x.parent.id()
            })
        }
    }
    else if(x instanceof Edge) {
        gNodes.push({
            type: 'rect',
            id: x.id(),
            label: x.id(),
            cluster: x.id()
        })
    }
    else if(x instanceof Hub) {
        gNodes.push({
            type: 'diamond',
            id: x.id(),
            label: x.id(),
            cluster: x.id()
        })
    }
    else if(x instanceof Bridge) {
        gCombos.push({
            id: x.id(),
            label: x.id()
        })
    }
})
edges.forEach( (x) => {
    gEdges.push({
        source: x.split(',')[0],
        target: x.split(',')[1],
    })
})
