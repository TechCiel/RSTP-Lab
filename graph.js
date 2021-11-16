"use strict";

const width = document.getElementById('mountNode').scrollWidth
const height = document.getElementById('mountNode').scrollHeight || 500
var graph = new G6.Graph({
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
        nodeSize: 50,
        nodeSpacing: 5,
        clustering: true,
        clusterNodeStrength: -5,
        clusterEdgeDistance: 200,
        clusterFociStrength: 2,
        clusterNodeSize: 60
    },
    workerEnabled: true,
    gpuEnabled: true,
    modes: {
        default: ['zoom-canvas', 'drag-canvas', 'drag-combo', 'collapse-expand-combo'],
    },
    defaultNode: {
        size: 50,
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
        //type: 'cubic',
        style: {
            stroke: '#0d47a1',
            lineWidth: 5
        }
    },
    nodeStateStyles: {
        'state:discard': {stroke: '#e53935'},
        'state:learn': {stroke: '#fb8c00'},
        'state:forward': {stroke: '#43a047'},
        'role:designated': {fill: '#fdd835'},
        'role:alternate': {fill: '#9c27b0'},
        'role:root': {fill: '#03a9f4'},
        defunct: {stroke: '#757575'}
    },
    edgeStateStyles: {
        fail: {
            stroke: '#ff1744'
        }
    }
});
graph.on('node:dragstart', function (e) {
    graph.layout()
    refreshDragedNodePosition(e)
})
graph.on('node:drag', function (e) {
    const forceLayout = graph.get('layoutController').layoutMethods[0];
    forceLayout.execute()
    refreshDragedNodePosition(e)
})
graph.on('node:dragend', function (e) {
    e.item.get('model').fx = null
    e.item.get('model').fy = null
})

