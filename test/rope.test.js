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
