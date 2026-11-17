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

test('eight 45 degree turns fit in one path, so a ring can close', () => {
    // The old cap of 8 runs allowed 7 turns, which stops at 315 degrees and
    // refuses the turn that completes the shape.
    assert.ok(ladder.MAX_RUNS >= 9, ladder.MAX_RUNS);
    const runs = [];
    for (let i = 0; i < 8; i++) runs.push({ squares: 2, turn: 45 });
    runs.push({ squares: 2, turn: 0 });
    const plan = ladder.plan({ runs });
    assert.equal(plan.runs.length, 9);
    assert.equal(plan.heading, 360);
    assert.deepEqual(plan.turnsOwed, []);
    assert.equal(plan.warnings.length, 0, plan.warnings.join('; '));
});

test('the planner says how much turning is left to close the shape', () => {
    // A 90 degree path closes as a square, a 45 degree one as an octagon, so
    // the shape that comes back is regular rather than a mix of both.
    assert.deepEqual(ladder.remainingTurns([{ squares: 2, turn: 90 }, { squares: 2, turn: 0 }]), [90, 90, 90]);
    assert.deepEqual(ladder.remainingTurns([{ squares: 2, turn: -45 }, { squares: 2, turn: 0 }]), [-45, -45, -45, -45, -45, -45, -45]);
    assert.deepEqual(ladder.remainingTurns([{ squares: 4, turn: 0 }]), []);
    // One 45 left after a run of them: a single turn, which is the case the
    // old 8 run cap refused.
    const sevenEighths = [{ squares: 1, turn: 45 }];
    for (let i = 0; i < 6; i++) sevenEighths.push({ squares: 2, turn: 45 });
    sevenEighths.push({ squares: 3, turn: 0 });
    assert.deepEqual(ladder.remainingTurns(sevenEighths), [45]);
});

test('closing the shape adds the turns the path still owes', () => {
    const open = [{ squares: 1, turn: 45 }];
    for (let i = 0; i < 6; i++) open.push({ squares: 2, turn: 45 });
    open.push({ squares: 3, turn: 0 });
    assert.equal(ladder.headingOf(open), 315);
    const closed = ladder.closeShape(open);
    assert.equal(ladder.headingOf(closed), 360);
    assert.equal(closed[closed.length - 1].turn, 0);
    const plan = ladder.plan({ runs: closed });
    assert.deepEqual(plan.turnsOwed, []);
    assert.equal(plan.warnings.length, 0, plan.warnings.join('; '));
    assert.equal(ladder.closeShape([{ squares: 4, turn: 0 }]), null);
});

test('a turn is refused with a reason, never silently dropped', () => {
    assert.equal(ladder.addTurn([{ squares: 2, turn: 45 }, { squares: 1, turn: 90 }], 45, 1), null);
    assert.equal(ladder.addTurn([{ squares: 2, turn: 0 }], 30, 1), null);
    const next = ladder.addTurn([{ squares: 2, turn: 0 }], 45, 3);
    assert.deepEqual(next, [{ squares: 2, turn: 45 }, { squares: 3, turn: 0 }]);
});

test('a corner costs a whole number of bays, so turns stay on the grid', () => {
    // An off-grid corner lead adds two odd-length segments per turn and
    // stretches the shape past the squares it is made of.
    for (const spacing of [150, 190, 250, 400, 800]) {
        for (const width of [120, 190, 450, 800]) {
            for (const name of ['octagon', 'diamond']) {
                const plan = ladder.plan({ spacing, width, runs: ladder.shapeRuns(name) });
                assert.equal(plan.endGap, 0, name + ' ' + spacing + '/' + width + ' gap ' + plan.endGap);
            }
        }
    }
    // Every bay is exactly the spacing, corners included.
    const plan = ladder.plan({ spacing: 400, runs: ladder.shapeRuns('diamond') });
    const bays = [...plan.svg.matchAll(/class="bay-hit" x1="(-?[\d.]+)" y1="(-?[\d.]+)" x2="(-?[\d.]+)" y2="(-?[\d.]+)"/g)];
    assert.ok(bays.length > 0);
    for (const b of bays) {
        const d = Math.hypot(b[3] - b[1], b[4] - b[2]);
        assert.ok(Math.abs(d - 400) < 0.6, 'bay ' + d);
    }
});

test('a closed shape brings the last rung back to the first', () => {
    // Turning a full circle is not enough: the first and last runs share one
    // side of the ring, so an even last run leaves the ends a side apart.
    for (const name of ['octagon', 'diamond']) {
        const plan = ladder.plan({ runs: ladder.shapeRuns(name) });
        assert.equal(plan.endGap, 0, name + ' gap ' + plan.endGap);
    }
    const open = [{ squares: 1, turn: 45 }];
    for (let i = 0; i < 6; i++) open.push({ squares: 2, turn: 45 });
    open.push({ squares: 2, turn: 0 });
    const closed = ladder.plan({ runs: ladder.closeShape(open) });
    assert.equal(closed.endGap, 0, 'closed gap ' + closed.endGap);
    assert.deepEqual(closed.turnsOwed, []);
    // A straight ladder is open on purpose, so its ends are far apart.
    assert.ok(ladder.plan({}).endGap > 100);
});

test('the closed presets come back to their starting direction', () => {
    for (const name of ['octagon', 'diamond']) {
        const runs = ladder.shapeRuns(name);
        assert.equal(Math.abs(ladder.headingOf(runs)) % 360, 0, name + ' ' + ladder.headingOf(runs));
        const plan = ladder.plan({ runs });
        assert.deepEqual(plan.turnsOwed, [], name);
        assert.equal(plan.warnings.length, 0, name + ' ' + plan.warnings.join('; '));
    }
    assert.equal(ladder.SHAPES.octagon.length, 9);
    assert.equal(ladder.SHAPES.diamond.filter((run) => run.turn === 90).length, 4);
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

// ---- Light parts, and a paracord that goes through ---------------------------

// Hole centres are where the arms put them; the mesh is checked, not the spec.
function bottomHoleWidths(mesh, spec) {
    const found = [];
    const step = Math.PI * 2 / spec.ports;
    for (const [k, radius] of Array.from({ length: spec.ports * 2 }, (_, i) => [i % spec.ports, i < spec.ports ? spec.cordRH : spec.cupRH])) {
        const cx = Math.cos(k * step) * radius;
        const cy = Math.sin(k * step) * radius;
        const pts = new Map();
        for (const tri of mesh) {
            for (const p of tri) {
                if (Math.abs(p.z) > 0.001) continue;
                if (Math.abs(Math.hypot(p.x - cx, p.y - cy) - spec.holeRad) < 0.06) pts.set(p.x + ',' + p.y, p);
            }
        }
        if (pts.size < 12) continue;
        // Narrowest chord through the centre of the polygon: what a cord really has to pass.
        const list = [...pts.values()];
        let narrow = Infinity;
        for (let a = 0; a < 90; a++) {
            const t = (a / 90) * Math.PI;
            const proj = list.map((p) => (p.x - cx) * Math.cos(t) + (p.y - cy) * Math.sin(t));
            narrow = Math.min(narrow, Math.max(...proj) - Math.min(...proj));
        }
        found.push(narrow);
    }
    return found;
}

test('the cord holes admit 4 mm paracord, in the printed mesh', () => {
    for (const input of [{}, { rails: 'cord', rungs: 'cord' }]) {
        const built = ladder.assemble(input);
        assert.ok(built.spec.cord === 4);
        assert.ok(built.spec.holeRad * 2 >= 4.5, 'hole ' + built.spec.holeRad * 2);
        let seen = 0;
        for (const m of built.meshes) {
            const widths = bottomHoleWidths(m.mesh, built.spec);
            for (const w of widths) {
                assert.ok(w >= 4.5, m.name + ' hole is only ' + w.toFixed(2) + ' mm wide');
                seen++;
            }
        }
        assert.ok(seen >= 3, 'no cord holes were found in the meshes: ' + seen);
        // The cup is wide enough to sit a double overhand knot (about 3 cords across).
        assert.ok(built.spec.wellR * 2 >= 3 * built.spec.cord, 'cup ' + built.spec.wellR * 2);
        // The cord lies in a groove at least one cord deep, so it does not stand proud of the part.
        assert.ok(built.spec.grooveDepth >= built.spec.cord, 'groove ' + built.spec.grooveDepth);
    }
});

test('a paracord-and-paracord ladder builds, and says how long to cut each cord', () => {
    const built = ladder.assemble({ rails: 'cord', rungs: 'cord' });
    assert.equal(built.meshes.every((m) => m.stats.watertight), true);
    assert.ok(built.plan.cord.perRailMm > 0 && built.plan.cord.rungCount > 0);
    assert.match(built.plan.cordLine, /Cut 2 lengths of 4 mm paracord/);
    const note = ladder.kitZip({ rails: 'cord', rungs: 'cord' }).toString('utf8');
    assert.match(note, /UP through the hole from underneath/);
    assert.match(note, /550 cord is about 4 mm/);
    const mixed = ladder.assemble({});
    assert.match(mixed.plan.cordLine, /each about \d+ mm \(\d+ ft \d+ in\)/);
});

test('connectors and bars are thin open shapes, and the whole ladder stays under its mass budget', () => {
    const built = ladder.assemble({});
    const plan = built.plan;
    const bySuffix = (re) => plan.parts.filter((p) => re.test(p.name));
    // Before: ~89 g per connector (a 97 mm solid disc), ~12.7 g per rung piece, ~1.2 kg all told.
    for (const row of bySuffix(/^coupler/)) assert.ok(row.grams <= 8, row.name + ' ' + row.grams + ' g');
    for (const row of bySuffix(/^rung-stick/)) assert.ok(row.grams <= 5.5, row.name + ' ' + row.grams + ' g');
    for (const row of bySuffix(/^joiner/)) assert.ok(row.grams <= 5.5, row.name + ' ' + row.grams + ' g');
    for (const row of bySuffix(/^pin/)) assert.ok(row.grams <= 0.5, row.name + ' ' + row.grams + ' g');
    assert.ok(plan.totalGrams <= 200, 'default ladder ' + plan.totalGrams + ' g');
    const cordOnly = ladder.assemble({ rails: 'cord', rungs: 'cord' }).plan;
    assert.ok(cordOnly.totalGrams <= 60, 'paracord ladder ' + cordOnly.totalGrams + ' g');
    // The kit says what it weighs.
    assert.match(ladder.kitZip({}).toString('utf8'), /About \d+ g of PETG/);
    // Every connector is one hub with arms, not a disc: its footprint is well inside the circle.
    const disc = Math.PI * built.spec.outerR * built.spec.outerR * built.spec.H / 1000 * 1.27;
    for (const m of built.meshes) assert.ok(m.stats.volume / 1000 * 1.27 < disc * 0.1, m.name);
});

test('45 degree ladders keep every connector arm apart', () => {
    const runs = [];
    for (let i = 0; i < 8; i++) runs.push({ squares: 1, turn: 45 });
    runs.push({ squares: 1, turn: 0 });
    for (const input of [{ runs }, { runs, rails: 'cord', rungs: 'cord' }]) {
        const built = ladder.assemble(input);
        assert.equal(built.spec.ports, 8);
        for (const m of built.meshes) assert.equal(m.stats.watertight, true, m.name);
    }
});
