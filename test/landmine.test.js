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

// ---- The sleeve and rocker screw together ---------------------------------
//
// 2026-11 field report: the printed pair would not screw together. Cause: the
// rocker is built upside down and flipped in z to print thread-down, and a flip
// is a mirror, so the printed rocker came out a LEFT-hand thread; the sleeve's
// pocket is a RIGHT-hand thread. The sleeve is the heavier piece (it is
// ~10-35% more plastic at every bar size), so the rocker is the piece that was
// changed, and the sleeve must stay byte-identical so the owner's printed
// sleeve still fits. The hashes below are the sleeve STL before the fix.

const crypto = require('node:crypto');

const SLEEVE_GOLDEN = [
    [{}, '1191dd69daa23872f5d605c54c0362ff369f6cee6d519964adb819cd95336b27'],
    [{"bar":50}, '9c69c2f7a76b4620b6c84dca24e5f739485d59e373c7f1935cdc222431ccd23f'],
    [{"bar":31.75}, '4805a8733b0b36f7f8a6b9b4fe34eb662a46f32a3392369c761e72c8a8e4c80d'],
    [{"bar":28}, '829596bd218240449faf3638a3209926d0d0531869b36f0ac82daaeeb5a8b2d2'],
    [{"bar":25.4}, '00d0c53484d32784045bec7cdb48142c7fb3859f01ecc53499a4c84bcc073824'],
    [{"bar":60,"ball":100}, 'e5a0d405a0fb007df306f67c0d4850300929dd08ce3f4df8016d9d28745244ea'],
    [{"bar":50.8,"ball":140,"printer":"a1"}, '9a1232000f3882e14c5e6bd72e24f5a2c3ca1c35d06a7d2a81d9f250274c123b'],
    [{"bar":70,"ball":100}, 'c65f189b0cddbe295e69fbea0c0ff8cc313969601f9c02ad8a4dc28721fd839f'],
];

test('the sleeve STL is byte-identical to the one already printed', () => {
    for (const [spec, hash] of SLEEVE_GOLDEN) {
        const got = crypto.createHash('sha256').update(landmine.build(spec).parts[0].stl).digest('hex');
        assert.equal(got, hash, 'sleeve changed for ' + JSON.stringify(spec));
    }
});

test('the rocker is the piece with less plastic, so it is the one that was reworked', () => {
    for (const [spec] of SLEEVE_GOLDEN) {
        const parts = landmine.build(spec).parts;
        assert.ok(parts[1].stats.volume < parts[0].stats.volume, JSON.stringify(spec));
    }
});

function readStl(buf) {
    const n = buf.readUInt32LE(80);
    const pts = new Map();
    for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;
        for (let v = 0; v < 3; v++) {
            const x = buf.readFloatLE(o + v * 12);
            const y = buf.readFloatLE(o + v * 12 + 4);
            const z = buf.readFloatLE(o + v * 12 + 8);
            pts.set(x.toFixed(2) + ',' + y.toFixed(2) + ',' + z.toFixed(2), [x, y, z]);
        }
    }
    return [...pts.values()];
}

const NANG = 48;
const TAU = Math.PI * 2;
// Radius by (ring z, angle index), measured off the real STL. The rocker prints
// thread-down; turning it over to screw it in is a 180 degree turn about a
// horizontal axis, which sends (x, y, z) to (x, -y, zTop - z).
function profile(points, pick, toBody) {
    const rings = new Map();
    for (const p of points) {
        const [x, y, z] = toBody(p);
        const r = Math.hypot(x, y);
        if (!pick(r, z)) continue;
        let k = Math.round(((Math.atan2(y, x) + TAU) % TAU) / (TAU / NANG)) % NANG;
        const key = Math.round(z * 20);
        if (!rings.has(key)) rings.set(key, { z, r: new Array(NANG).fill(null) });
        const row = rings.get(key);
        row.r[k] = row.r[k] == null ? r : (pick.min ? Math.min(row.r[k], r) : Math.max(row.r[k], r));
    }
    return [...rings.values()].sort((a, b) => a.z - b.z);
}

function crestAngle(row) {
    let c = 0;
    let s = 0;
    const mean = row.r.reduce((a, b) => a + b, 0) / NANG;
    row.r.forEach((r, k) => {
        c += (r - mean) * Math.cos(k * TAU / NANG);
        s += (r - mean) * Math.sin(k * TAU / NANG);
    });
    return { psi: Math.atan2(s, c), amp: Math.hypot(c, s) / NANG };
}

// +1 right-hand (crest angle grows with z), measured pitch in mm.
function helix(rows) {
    let sum = 0;
    let dz = 0;
    let n = 0;
    for (let i = 1; i < rows.length; i++) {
        const a = crestAngle(rows[i - 1]);
        const b = crestAngle(rows[i]);
        if (a.amp < 0.3 || b.amp < 0.3) continue;
        let d = b.psi - a.psi;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        sum += d;
        dz += rows[i].z - rows[i - 1].z;
        n++;
    }
    assert.ok(n >= 6, 'too few thread rings measured: ' + n);
    return { hand: Math.sign(sum), pitch: TAU / (Math.abs(sum) / dz) };
}

const SPECS = [{}, { bar: 50 }, { bar: 31.75 }, { bar: 28 }, { bar: 25.4 }, { bar: 60 }, { bar: 70 }, { bar: 50.8, ball: 140, printer: 'a1' }];
const MIN_RADIAL_CLEARANCE = 0.75;

test('the sleeve and rocker screw together: same hand, same pitch, clearance at every angle', () => {
    for (const spec of SPECS) {
        const built = landmine.build(spec);
        const g = built.spec.geom;
        const label = JSON.stringify(spec);
        const sleevePts = readStl(built.parts[0].stl);
        const rockerPts = readStl(built.parts[1].stl);
        const top = Math.round(g.zTop * 100) / 100;
        const male = profile(rockerPts, Object.assign((r) => r > g.maleMinor - 2, { min: false }), (p) => [p[0], -p[1], top - p[2]])
            .filter((row) => row.z > g.z0 + 0.5 && row.z <= top + 0.02);
        const pocketMax = g.maleMajor + 0.55 + 0.01;
        const female = profile(sleevePts, Object.assign((r, z) => r <= pocketMax && r > g.maleMinor && z > g.z0 + 0.5 && z <= top + 0.02, { min: true }), (p) => p)
            .filter((row) => row.z > g.z0 + 0.5 && row.z <= top + 0.02);
        assert.ok(male.length >= 10 && female.length >= 10, label + ' rings ' + male.length + '/' + female.length);

        const interior = (rows) => rows.filter((row) => row.z > g.z0 + 2.6 && row.z < top - 2.6);
        const hm = helix(interior(male));
        const hf = helix(interior(female));
        assert.equal(hm.hand, 1, label + ': rocker thread must be right-hand like the sleeve');
        assert.equal(hf.hand, 1, label + ': sleeve thread must be right-hand');
        assert.ok(Math.abs(hm.pitch - 8) < 0.4 && Math.abs(hf.pitch - 8) < 0.4, label + ' pitch ' + hm.pitch + '/' + hf.pitch);

        // Radial clearance at every ring and every one of the 48 angles.
        let worst = Infinity;
        let compared = 0;
        for (const fr of female) {
            const mr = male.find((row) => Math.abs(row.z - fr.z) < 0.03);
            if (!mr) continue;
            for (let k = 0; k < NANG; k++) {
                if (fr.r[k] == null || mr.r[k] == null) continue;
                worst = Math.min(worst, fr.r[k] - mr.r[k]);
                compared++;
            }
        }
        assert.ok(compared >= 10 * NANG * 0.9, label + ' compared ' + compared);
        assert.ok(worst >= MIN_RADIAL_CLEARANCE, label + ' radial clearance ' + worst.toFixed(3));

        // Engaged turns: a thread longer than two full turns carries the load.
        assert.ok((g.zTop - g.z0) / landmine.PITCH >= 2.4, label + ' turns');
        const turns = male.filter((row) => crestAngle(row).amp > 0.3).length * 1 / landmine.PITCH;
        assert.ok(turns >= 1.8, label + ' engaged turns ' + turns.toFixed(2));
    }
});
