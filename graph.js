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
        type: 'force',
        linkDistance: 15,
        nodeStrength: 5, 
        edgeStrength: -0.1,
        preventOverlap: true,
        collideStrength: 1,
        nodeSize: 30,
        nodeSpacing: 5,
        clustering: true,
        clusterNodeStrength: -5,
        clusterEdgeDistance: 200,
        clusterFociStrength: 2,
        clusterNodeSize: 50
    },
    workerEnabled: true,
    gpuEnabled: true,
    modes: {
        default: ['zoom-canvas', 'drag-canvas', 'drag-combo', 'collapse-expand-combo'],
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
graph.on('node:dragstart', function (e) {
    graph.layout();
    refreshDragedNodePosition(e);
});
graph.on('node:drag', function (e) {
    const forceLayout = graph.get('layoutController').layoutMethods[0];
    forceLayout.execute();
    refreshDragedNodePosition(e);
});
graph.on('node:dragend', function (e) {
    e.item.get('model').fx = null;
    e.item.get('model').fy = null;
});
graph.data(data);
graph.render();
