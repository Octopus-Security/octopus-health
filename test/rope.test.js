'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const rope = require('../lib/rope');
const ladder = require('../lib/ladder');

test('the screw is a coarse thread with room to wear', () => {
    assert.equal(rope.PITCH, 5.5);
    assert.equal(rope.DEPTH, 2);
    assert.ok(rope.PITCH >= 4, 'pitch ' + rope.PITCH);
    assert.ok(rope.DEPTH >= 1.5, 'depth ' + rope.DEPTH);
    assert.equal(rope.HOLE_DIA, 5.5);
    assert.ok(rope.HOLE_DIA >= 5 && rope.HOLE_DIA <= 6.5);
    const gap = rope.minGap();
    assert.ok(gap >= rope.CLEARANCE - 0.02, 'gap ' + gap);
    assert.ok(rope.MALE_MAJOR - rope.FEMALE_CREST > 1, 'engagement ' + (rope.MALE_MAJOR - rope.FEMALE_CREST));
    assert.ok(rope.MALE_MAJOR > rope.FEMALE_CREST);
});

test('both handles are watertight and fit a 180 mm bed', () => {
    const built = rope.build();
    for (const part of built.parts) {
        const measured = part.stats;
        assert.equal(measured.watertight, true, part.name);
        assert.equal(measured.badEdges, 0, part.name);
        assert.ok(measured.volume > 0, part.name);
        for (const axis of ['x', 'y', 'z']) {
            assert.ok(measured.size[axis] <= 165, part.name + ' ' + axis + ' ' + measured.size[axis]);
        }
    }
    assert.equal(built.parts.map((p) => p.name).sort().join(','), 'cap.stl,handle.stl');
});

test('the kit is a zip whose instructions say how to change the rope', () => {
    const zip = rope.kitZip();
    assert.equal(zip[0], 0x50);
    assert.equal(zip[1], 0x4b);
    const text = zip.toString('utf8');
    assert.match(text, /cap\.stl/);
    assert.match(text, /handle\.stl/);
    assert.match(text, /double knot/i);
    assert.match(text, /unscrew/i);
    assert.match(text, /5\.5/);
    const plan = rope.plan();
    assert.equal(plan.ok, true);
    assert.deepEqual(plan.parts.map((p) => p.name).sort(), ['cap.stl', 'handle.stl']);
    assert.match(plan.lines.join('\n'), /double knot/i);
    assert.match(plan.lines.join('\n'), /wide crest/);
    const preview = rope.preview();
    assert.equal(preview.parts.length, 2);
    assert.equal(Buffer.from(preview.parts[0].stl, 'base64').readUInt32LE(80) > 0, true);
});

// ---- Assembly: does it go together, and is it light --------------------------

const TAU = Math.PI * 2;

function stlPoints(buf) {
    const n = buf.readUInt32LE(80);
    const pts = [];
    for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;
        for (let v = 0; v < 3; v++) pts.push([buf.readFloatLE(o + v * 12), buf.readFloatLE(o + v * 12 + 4), buf.readFloatLE(o + v * 12 + 8)]);
    }
    return pts;
}

test('the mesh really carries the thread the clearance maths describes', () => {
    const built = rope.build();
    const cap = rope.capGeometry();
    const handle = stlPoints(built.parts.find((p) => p.name === 'handle.stl').stl);
    const capPts = stlPoints(built.parts.find((p) => p.name === 'cap.stl').stl);
    const hStart = rope.GRIP_LEN + rope.SHOULDER;
    let checkedH = 0;
    for (const [x, y, z] of handle) {
        const u = z - hStart;
        const r = Math.hypot(x, y);
        if (u < 0.5 || u > rope.THREAD_LEN - 0.5 || r < rope.MALE_MINOR - 0.05) continue;
        const want = rope.maleRadius(u, Math.atan2(y, x));
        assert.ok(Math.abs(r - want) < 0.06, 'handle thread vertex off by ' + (r - want));
        checkedH++;
    }
    let checkedC = 0;
    for (const [x, y, z] of capPts) {
        const v = z - cap.threadStart;
        const r = Math.hypot(x, y);
        if (v < 0.5 || v > rope.THREAD_LEN - 0.5 || r > rope.FEMALE_VALLEY + 0.05 || r < rope.FEMALE_CREST - 0.05) continue;
        const want = rope.femaleRadius(v, Math.atan2(y, x));
        assert.ok(Math.abs(r - want) < 0.06, 'cap thread vertex off by ' + (r - want));
        checkedC++;
    }
    assert.ok(checkedH > 1000 && checkedC > 1000, checkedH + '/' + checkedC);
});

test('the rope assembles: threads mate, the handle seats, the knot and cord have room', () => {
    const cap = rope.capGeometry();
    // Handle thread coordinate u runs from the shoulder (0) to the tip. Turned
    // over into the cap that is a 180 degree turn about a horizontal axis, which
    // keeps the hand of the thread. The shoulder seats SEAT_DEPTH inside the mouth.
    const threadStartInCap = cap.top - rope.SEAT_DEPTH;
    // 1. The shoulder is what stops the handle: the grip is wider than the mouth.
    assert.ok(rope.GRIP_R >= rope.FEMALE_VALLEY + 0.5, 'grip ' + rope.GRIP_R + ' vs mouth ' + rope.FEMALE_VALLEY);
    assert.ok(rope.SEAT_DEPTH > 0 && rope.SEAT_DEPTH < rope.SHOULDER);
    // 2. At that stop the tip is clear of the ramp into the knot chamber.
    const tipZ = threadStartInCap - rope.THREAD_LEN;
    assert.ok(tipZ >= cap.rampEnd - rope.RELIEF, 'tip z ' + tipZ + ' ramp end ' + cap.rampEnd);
    const rampR = Math.min(rope.FEMALE_VALLEY, rope.CHAMBER_R + (tipZ - cap.chamberEnd));
    assert.ok(rampR - rope.MALE_MAJOR >= 0.7 || tipZ >= cap.rampEnd - 0.5, 'tip clear of the ramp ' + rampR);
    assert.ok(rampR - rope.MALE_MINOR >= 1.5, 'ramp radius ' + rampR + ' vs tip ' + rope.MALE_MINOR);
    // 3. The two threads are the same helix: same hand, same pitch.
    const crest = (fn, z) => {
        let c = 0;
        let sn = 0;
        for (let k = 0; k < 360; k++) {
            const t = (k / 360) * TAU;
            const r = fn(z, t);
            c += r * Math.cos(t);
            sn += r * Math.sin(t);
        }
        return Math.atan2(sn, c);
    };
    const turn = (fn) => {
        let sum = 0;
        for (const z of [8, 9, 10, 11]) {
            let d = crest(fn, z + 1) - crest(fn, z);
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            sum += d;
        }
        return sum / 4;
    };
    const dm = turn(rope.maleRadius);
    const df = turn(rope.femaleRadius);
    assert.ok(dm > 0 && df > 0, 'both right-hand: ' + dm + ' ' + df);
    assert.ok(Math.abs(TAU / dm - rope.PITCH) < 0.1 && Math.abs(TAU / df - rope.PITCH) < 0.1);
    // 4. Seated, over the whole overlap, at some turn of the handle, radial clearance
    //    stays above 0.75 mm, and at least 2 turns of full-depth thread overlap.
    let best = -Infinity;
    for (let a = 0; a < 360; a++) {
        const alpha = (a / 360) * TAU;
        let worst = Infinity;
        for (let i = 0; i <= 80; i++) {
            const v = (i / 80) * rope.THREAD_LEN;
            const u = rope.THREAD_LEN - rope.SEAT_DEPTH - v;
            if (u < 0 || u > rope.THREAD_LEN) continue;
            for (let k = 0; k < 64; k++) {
                const theta = (k / 64) * TAU;
                worst = Math.min(worst, rope.femaleRadius(v, theta) - rope.maleRadius(u, -theta + alpha));
            }
        }
        best = Math.max(best, worst);
    }
    assert.ok(best >= 0.75, 'best radial clearance when seated ' + best);
    const lead = 0.35 * rope.PITCH;
    const lo = Math.max(lead, rope.THREAD_LEN - rope.SEAT_DEPTH - (rope.THREAD_LEN - lead));
    const hi = Math.min(rope.THREAD_LEN - lead, rope.THREAD_LEN - rope.SEAT_DEPTH - lead);
    assert.ok((hi - lo) / rope.PITCH >= 2, 'full-depth overlap turns ' + ((hi - lo) / rope.PITCH));
    // 5. The cord goes through the hole, the double knot does not, and fits the chamber.
    assert.ok(rope.HOLE_DIA >= rope.CORD_DIA + 0.5, 'hole ' + rope.HOLE_DIA);
    const knot = 3 * rope.CORD_DIA;
    assert.ok(knot > rope.HOLE_DIA, 'knot ' + knot + ' must not pull through the hole');
    assert.ok(rope.CHAMBER_R * 2 >= knot + 1.5, 'chamber ' + rope.CHAMBER_R * 2);
    // The handle's bore opens into the chamber side, so nothing is sealed shut.
    assert.ok(rope.BORE_R > 4, 'bore ' + rope.BORE_R);
    // And the hole in the real cap mesh is the one the maths says.
    const bottom = stlPoints(rope.build().parts.find((p) => p.name === 'cap.stl').stl).filter((p) => Math.abs(p[2]) < 0.01);
    const holeR = Math.min(...bottom.map((p) => Math.hypot(p[0], p[1])));
    assert.ok(holeR * 2 >= 4.5 && Math.abs(holeR * 2 - rope.HOLE_DIA) < 0.05, 'cap hole ' + holeR * 2);
});

test('the whole rope stays under 35 g of plastic', () => {
    const built = rope.build();
    const total = built.parts.reduce((sum, p) => sum + p.stats.volume / 1000 * 1.27 * p.count, 0);
    assert.ok(total <= 35, 'total ' + total.toFixed(1) + ' g');
    assert.ok(Math.abs(total - built.totalGrams) < 0.2);
    assert.ok(rope.plan().grams <= 35);
    assert.match(rope.plan().lines.join('\n'), /about \d+ g of plastic/);
    for (const p of built.parts) assert.ok(p.stats.volume / 1000 * 1.27 <= 13, p.name + ' ' + p.grams);
});
