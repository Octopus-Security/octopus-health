'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ladder = require('../lib/ladder');

function expectClosed(mesh, label) {
    const stats = ladder.meshStats(mesh);
    assert.equal(stats.watertight, true, label + ' bad edges ' + stats.badEdges + ' tris ' + stats.triangles);
    assert.ok(stats.volume > 0, label + ' volume ' + stats.volume);
    return stats;
}

test('a 10 mm box has volume 1000 and is watertight', () => {
    const mesh = ladder.solidWithPockets({
        outer: [[0, 0], [10, 0], [10, 10], [0, 10]],
        throughHoles: [],
        pockets: [],
        z0: 0,
        z1: 10,
    });
    const stats = expectClosed(mesh, 'box');
    assert.ok(Math.abs(stats.volume - 1000) < 0.01, stats.volume);
    assert.ok(Math.abs(stats.area - 600) < 0.01, stats.area);
    const stl = ladder.writeStl(mesh);
    assert.equal(stl.readUInt32LE(80), mesh.length);
    assert.equal(stl.length, 84 + mesh.length * 50);
    assert.equal(stl.toString('ascii', 0, 14), 'octopus ladder');
});

test('a hole through a plate keeps the remaining volume', () => {
    const mesh = ladder.solidWithPockets({
        outer: [[0, 0], [10, 0], [10, 10], [0, 10]],
        throughHoles: [[[4, 4], [6, 4], [6, 6], [4, 6]]],
        pockets: [],
        z0: 0,
        z1: 10,
    });
    const stats = expectClosed(mesh, 'plate');
    assert.ok(Math.abs(stats.volume - 960) < 1, stats.volume);
});

test('a pocket leaves a floor', () => {
    const mesh = ladder.solidWithPockets({
        outer: [[0, 0], [10, 0], [10, 10], [0, 10]],
        throughHoles: [],
        pockets: [{ poly: [[3, 3], [7, 3], [7, 7], [3, 7]], floorZ: 5, holes: [] }],
        z0: 0,
        z1: 10,
    });
    const stats = expectClosed(mesh, 'pocket');
    assert.ok(Math.abs(stats.volume - 920) < 1, stats.volume);
});

test('4 sockets reject a 45 degree bar and 8 sockets accept it', () => {
    assert.throws(() => ladder.portIndex(1, 1, 4));
    assert.equal(ladder.portIndex(1, 1, 8), 1);
    assert.equal(ladder.portIndex(1, 0, 4), 0);
});

test('a 45 degree path upgrades a 4 socket request', () => {
    const plan = ladder.plan({
        ports: 4,
        runs: [{ squares: 1, turn: 45 }, { squares: 1, turn: 0 }],
    });
    assert.equal(plan.ports, 8);
    assert.match(plan.portsNote, /8/);
    assert.equal(plan.lockPorts, true);
});

test('default kit fits an A1 mini and uses paracord rails', () => {
    const built = ladder.assemble({});
    const plan = built.plan;
    assert.ok(plan.diameter <= 180, plan.diameter);
    assert.ok(plan.diameter <= plan.printer.maxPart, plan.diameter + ' vs ' + plan.printer.maxPart);
    assert.equal(plan.gripClamped, false);
    assert.equal(plan.gripUsed, 32);
    assert.equal(plan.rails, 'cord');
    assert.equal(plan.counts.railPieces, 0);
    assert.ok(plan.counts.rungPieces > 0);
    assert.ok(plan.cord && plan.cord.mm > 0);
    assert.match(plan.fitLine, /A1 mini/);
    assert.match(plan.fitLine, /180/);
    assert.match(plan.rungLine, /printed as/);
    assert.equal(plan.parts.some((p) => p.name.startsWith('rail-stick')), false);
    assert.equal(plan.parts.some((p) => p.name.startsWith('rung-stick')), true);
    for (const mesh of built.meshes) expectClosed(mesh.mesh, mesh.name);
    const zip = ladder.kitZip({});
    assert.equal(zip[0], 0x50);
    assert.equal(zip[1], 0x4b);
    const text = zip.toString('latin1');
    assert.match(text, /A1 mini/);
    assert.match(text, /paracord/);
    assert.match(text, /read-me\.txt/);
    for (const file of built.files) {
        if (!file.name.endsWith('.stl')) continue;
        assert.equal(file.data.readUInt32LE(80) > 0, true, file.name);
        assert.equal(file.data.length, 84 + file.data.readUInt32LE(80) * 50, file.name);
    }
});

test('a long grip is shortened so the connector fits the bed', () => {
    const plan = ladder.plan({ grip: 60, stickW: 25, printer: 'a1-mini' });
    assert.equal(plan.gripClamped, true);
    assert.ok(plan.diameter <= 165.05, plan.diameter);
    assert.match(plan.messages.join(' '), /Shortened the grip to \d/);
});

test('paracord rails and printed rungs are both in a mixed kit', () => {
    const plan = ladder.plan({ rails: 'cord', rungs: 'stick' });
    assert.ok(plan.cordLine.includes('paracord') || plan.cordLine.includes('Paracord'));
    assert.ok(plan.counts.rungPieces > 0);
    assert.equal(plan.counts.railPieces, 0);
});

test('stick rails on a 45 degree turn stay on the bed', () => {
    const built = ladder.assemble({
        rails: 'stick',
        rungs: 'stick',
        runs: [{ squares: 1, turn: 45 }, { squares: 1, turn: 0 }],
    });
    assert.equal(built.plan.ports, 8);
    assert.equal(built.plan.warnings.length, 0, built.plan.warnings.join('; '));
    assert.ok(built.plan.counts.railPieces > 0);
    for (const part of built.plan.parts) assert.equal(part.fits, true, part.name + ' ' + part.size);
    for (const mesh of built.meshes) expectClosed(mesh.mesh, mesh.name);
});

test('a stick shorter than two grips is refused by the splitter', () => {
    const split = ladder.splitSpan(20, 32, 165);
    assert.equal(split.ok, false);
});

test('deleting the bay before a corner keeps the corner', () => {
    const next = ladder.deleteBay([{ squares: 10, turn: 45 }, { squares: 2, turn: 0 }], 9);
    assert.deepEqual(next, [{ squares: 9, turn: 45 }, { squares: 2, turn: 0 }]);
    assert.deepEqual(ladder.deleteBay([{ squares: 1, turn: 0 }], 0), [{ squares: 1, turn: 0 }]);
});

test('shape presets are fixed layouts and do not change a one-bay ladder into nothing', () => {
    assert.deepEqual(ladder.shapeRuns('straight'), [{ squares: 8, turn: 0 }]);
    assert.equal(ladder.SHAPES.l[0].turn, 90);
    assert.equal(ladder.SHAPES.square.length, 4);
    assert.equal(ladder.SHAPES.zigzag[1].turn, -45);
    assert.equal(ladder.SHAPES.u.length, 3);
    assert.equal(ladder.shapeRuns('nope'), null);
});

test('the layout drawing marks every bay for a click', () => {
    const plan = ladder.plan({});
    const hits = plan.svg.match(/class="bay-hit"/g) || [];
    assert.equal(hits.length, 4);
    assert.match(plan.svg, /data-bay="0"/);
    assert.match(plan.svg, /data-bay="3"/);
    assert.match(plan.svg, /scale\(1,-1\)/);
});

test('dowel rungs ask for a zip tie and do not add pins', () => {
    const plan = ladder.plan({ rails: 'cord', rungs: 'dowel', dowel: 16 });
    assert.match(plan.dowelLine, /zip tie/);
    assert.equal(plan.counts.pins, 0);
    assert.equal(plan.counts.rungPieces, 0);
});
