'use strict';

// What the read-mes promise about supports, measured off the STL the page
// ships. A down-facing face steeper than 60 degrees from vertical sags without
// support; one past 75 is a ceiling. Found 2026-11-19: the rope said "every
// overhang is 45 degrees or gentler" while its thread flanks ran 60-75, and the
// landmine said "no supports" while its rocker printed a ~2200 mm2 flat ring.
//
// Run: node --test test/print-overhangs.test.js

const { test } = require('node:test');
const assert = require('node:assert');
const landmine = require('../lib/landmine');
const rope = require('../lib/rope');

function triangles(buf) {
    const n = buf.readUInt32LE(80);
    const out = [];
    for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;
        const v = (k) => [buf.readFloatLE(o + k * 12), buf.readFloatLE(o + k * 12 + 4), buf.readFloatLE(o + k * 12 + 8)];
        out.push([v(0), v(1), v(2)]);
    }
    return out;
}

// Down-facing area (mm2) by overhang angle from vertical, ignoring the bed.
function overhangs(stl) {
    const tris = triangles(stl);
    const zmin = Math.min(...tris.flat().map((p) => p[2]));
    const out = { steep: 0, ceiling: 0, ceilingZ: new Set() };
    for (const [a, b, c] of tris) {
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
        const len = Math.hypot(...n);
        if (!len) continue;
        const zc = (a[2] + b[2] + c[2]) / 3 - zmin;
        if (n[2] >= 0 || zc < 0.1) continue;
        const deg = Math.asin(Math.min(1, -n[2] / len)) * 180 / Math.PI;
        if (deg > 75) {
            out.ceiling += len / 2;
            out.ceilingZ.add(Math.round(zc));
        } else if (deg > 60) out.steep += len / 2;
    }
    return out;
}

test('rope cap and handle print with no supports: no ceilings, thread flanks not steep', () => {
    for (const part of rope.build().parts) {
        const o = overhangs(part.stl);
        assert.equal(Math.round(o.ceiling), 0, part.name + ' has a ceiling');
        assert.ok(o.steep < 30, part.name + ' steep overhang ' + o.steep.toFixed(0) + ' mm2');
    }
    assert.match(rope.plan().lines.join('\n'), /No supports/);
});

test('landmine rocker: thread flank not steep, and its one ceiling is the shoulder the read-me supports', () => {
    for (const bar of [50.8, 50, 31.75, 28, 25.4]) {
        const built = landmine.build({ bar });
        const rocker = built.parts.find((p) => p.name === 'rocker.stl');
        const o = overhangs(rocker.stl);
        // Before the ramp this was ~1200 mm2 at every bar size.
        assert.ok(o.steep < 300, bar + ': rocker steep overhang ' + o.steep.toFixed(0) + ' mm2');
        // The ceiling is one flat ring, at the seam (zTop - seamZ above the bed).
        const g = built.spec.geom;
        assert.deepEqual([...o.ceilingZ], [Math.round(g.zTop - g.seamZ)], bar + ' ceilings at ' + [...o.ceilingZ]);
        const text = landmine.plan({ bar }).lines.join('\n');
        assert.match(text, /rocker[^.]*WITH supports/);
        assert.match(text, /build plate only/);
    }
});
