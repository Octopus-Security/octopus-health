'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const landmine = require('../lib/landmine');
const ladder = require('../lib/ladder');

test('the landmine thread is coarse and the default hole is a 2 in sleeve', () => {
    assert.equal(landmine.PITCH, 8);
    assert.equal(landmine.DEPTH, 3);
    assert.ok(landmine.PITCH >= 4, 'pitch ' + landmine.PITCH);
    assert.ok(landmine.DEPTH >= 1.5, 'depth ' + landmine.DEPTH);
    const spec = landmine.normalize({});
    assert.equal(spec.bar, 50.8);
    assert.equal(spec.bore, 52);
    assert.equal(spec.ball, 100);
    assert.equal(spec.raised, false);
    assert.equal(spec.fits, true);
    assert.ok(spec.xy <= 165, 'xy ' + spec.xy);
    assert.ok(spec.upperH <= 175, 'upper ' + spec.upperH);
    assert.ok(spec.lowerH <= 175, 'lower ' + spec.lowerH);
    assert.ok(spec.geom.zMouth - spec.geom.zFloor >= 40, 'bore ' + (spec.geom.zMouth - spec.geom.zFloor));
    const gap = landmine.minGap(spec);
    assert.ok(gap >= 0.55 - 0.02, 'gap ' + gap);
});

test('both halves are watertight and the sleeve is the ball, not larger', () => {
    const built = landmine.build({});
    assert.deepEqual(built.parts.map((p) => p.name), ['sleeve.stl', 'rocker.stl']);
    for (const part of built.parts) {
        assert.equal(part.stats.watertight, true, part.name);
        assert.equal(part.stats.badEdges, 0, part.name);
        assert.ok(part.stats.volume > 0, part.name + ' ' + part.stats.volume);
    }
    const sleeve = built.parts[0];
    const rocker = built.parts[1];
    assert.ok(sleeve.stats.size.x <= built.spec.ball + 0.5, 'sleeve x ' + sleeve.stats.size.x);
    assert.ok(sleeve.stats.size.y <= built.spec.ball + 0.5, 'sleeve y ' + sleeve.stats.size.y);
    assert.ok(sleeve.stats.size.x >= built.spec.ball - 1, 'sleeve equator ' + sleeve.stats.size.x);
    assert.ok(rocker.stats.size.x <= built.spec.ball, 'rocker x ' + rocker.stats.size.x);
    assert.equal(sleeve.stl.toString('ascii', 0, 23), 'octopus landmine sleeve');
    assert.equal(rocker.stl.toString('ascii', 0, 23), 'octopus landmine rocker');
    const header = ladder.writeStl([[{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }]]);
    assert.equal(header.toString('ascii', 0, 14), 'octopus ladder');
});

test('a larger bar opens a larger hole, and a ball that is too small is raised', () => {
    const big = landmine.normalize({ bar: 60, ball: 100 });
    assert.equal(big.bore, 61.2);
    assert.ok(big.bore > 52);
    const inch = landmine.normalize({ bar: 25.4, ball: 100 });
    assert.equal(inch.bore, 26.6);
    assert.equal(inch.raised, false);
    const raised = landmine.plan({ bar: 50.8, ball: 60 });
    assert.equal(raised.ok, true);
    assert.equal(raised.ball > 60, true);
    assert.match(raised.notes.join(' '), /Raised the ball/);
    assert.equal(raised.parts.some((p) => p.stl), false);
    const wide = landmine.plan({ ball: 200, printer: 'a1-mini' });
    assert.equal(wide.fits, false);
    assert.equal(wide.ok, true);
});

test('the kit is a zip whose instructions name PETG and the screw', () => {
    const zip = landmine.kitZip({});
    assert.equal(zip[0], 0x50);
    assert.equal(zip[1], 0x4b);
    const text = zip.toString('utf8');
    assert.match(text, /sleeve\.stl/);
    assert.match(text, /rocker\.stl/);
    assert.match(text, /PETG/);
    assert.match(text, /screw/i);
    const plan = landmine.plan({});
    const lines = plan.lines.join('\n');
    assert.match(lines, /PETG/);
    assert.match(lines, /screw/i);
    assert.match(lines, /smooth/);
    assert.doesNotMatch(lines, /Nothing else is required/);
    assert.equal(plan.parts.map((p) => p.count).join(','), '1,1');
    const preview = landmine.preview({});
    assert.equal(preview.parts.length, 2);
    assert.equal(Buffer.from(preview.parts[0].stl, 'base64').readUInt32LE(80) > 0, true);
    assert.equal(Buffer.from(preview.parts[1].stl, 'base64').readUInt32LE(80) > 0, true);
});
