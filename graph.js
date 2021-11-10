"use strict";

const data = {
    nodes: gNodes,
    combos: gCombos,
    edges: gEdges,
};

const width = document.getElementById('mountNode').scrollWidth;
const height = document.getElementById('mountNode').scrollHeight || 500;
const graph = new G6.Graph({
    container: 'mountNode',
    width,
    height,
    fitView: true,
    animate: true,
    layout: {
        type: 'comboForce',
        preventOverlap: true,
        nodeSize: 30,
        nodeSpacing: 5,
        comboSpacing: 5,
        comboGravity: 50
    },
    workerEnabled: true,
    gpuEnabled: true,
    modes: {
        default: ['zoom-canvas', 'drag-canvas', 'drag-node', 'drag-combo', 'collapse-expand-combo'],
    },
    defaultNode: {
        size: 30,
        //anchorPoints: [15, 15],
        style: {
            lineWidth: 2
        }
    },
    defaultCombo: {
        style: {
            fill: '#e1f5fe',
            stroke: '#0288d1',
            lineWidth: 3
        }
    },
    defaultEdge: {
        style: {
            stroke: '#0d47a1',
            lineWidth: 5
        }
    }
});

graph.data(data);
graph.render();
