'use strict';

// Landmine pivot for the end of a barbell. Two pieces screw together on a
// coarse thread: a sleeve the bar slides into, and a rocker that is the other
// half of the ball. The thread is large on purpose (8 mm per turn, 3 mm deep)
// so wear does not shave it off. The outside of the ball is smooth so it rolls
// and so the print needs no supports.
//
// Print the sleeve with the opening on the bed and the tube up. Print the
// rocker with the thread on the bed and the dome up. PETG, thick walls.

const ladder = require('./ladder');

const PITCH = 8;
const DEPTH = 3;
const CREST = 2.4;
const ROOT = 2.4;
const T_CLEAR = 0.55;
const TURNS = 2.5;
const TAPER_TURNS = 0.3;
const N = 48;
const SLEEVE_WALL = 10;
const BAR_CLEAR = 1.2;
const SKIN = 7;
const FLOOR = 8;
const LIP = 8;
const MARGIN = 15;
// Extra radial room taken off the ROCKER's thread only. The sleeve's pocket is
// the one piece that must not change, so all added slack comes from the male.
// A printed thread loses about 0.1-0.2 mm per side (outer surfaces print
// oversize, holes undersize); T_CLEAR alone is 0.55 radially but only ~0.26 mm
// measured square to a flank, which is inside that error band.
const MALE_RELIEF = 0.3;
// The rocker prints thread-end down. The first layers flare (elephant's foot),
// so the last ring on the bed is pulled in by this much and the flare lands
// on the cone, not on the thread.
const BED_CHAMFER = 0.8;

const PRINTERS = {
    'a1-mini': { id: 'a1-mini', name: 'Bambu A1 mini', bed: 180 },
    a1: { id: 'a1', name: 'Bambu A1', bed: 256 },
};

const BARS = [
    { id: 'olympic-2', label: '2 in Olympic sleeve', bar: 50.8 },
    { id: 'olympic-50', label: '50 mm Olympic sleeve', bar: 50 },
    { id: 'standard', label: '1.25 in standard', bar: 31.75 },
    { id: 'shaft-28', label: '28 mm shaft', bar: 28 },
    { id: 'inch-1', label: '1 in bar', bar: 25.4 },
];

function q(n) {
    return Math.round(n * 100) / 100;
}

function clamp(n, lo, hi, fallback) {
    n = Number(n);
    if (!Number.isFinite(n)) n = fallback;
    return Math.min(hi, Math.max(lo, n));
}

function fail(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
}

function smooth(u) {
    const t = Math.min(1, Math.max(0, u));
    return t * t * (3 - 2 * t);
}

function threadHeight(phase) {
    let p = phase - Math.floor(phase);
    const crestW = CREST / PITCH;
    const rootW = ROOT / PITCH;
    const flankW = (1 - crestW - rootW) / 2;
    const a = rootW / 2;
    const b = a + flankW;
    const c = b + crestW;
    const d = c + flankW;
    if (p < a || p >= d) return 0;
    if (p < b) return smooth((p - a) / flankW);
    if (p < c) return 1;
    return 1 - smooth((p - c) / flankW);
}

function taper(z, length) {
    const lead = TAPER_TURNS * PITCH;
    if (z <= 0 || z >= length) return 0;
    if (z < lead) return z / lead;
    if (z > length - lead) return (length - z) / lead;
    return 1;
}

function sphereR(R, z) {
    const v = R * R - z * z;
    return v > 0 ? Math.sqrt(v) : 0;
}

function solve(R, boreR) {
    const threadLen = PITCH * TURNS;
    const zTop = Math.min(16, R * 0.26);
    const z0 = zTop - threadLen;
    const maleMajor = Math.max(boreR + 14, 30);
    const maleMinor = maleMajor - DEPTH;
    const rAt = (z) => sphereR(R, z);
    if (zTop >= R - 4) return null;
    if (maleMajor + T_CLEAR + SKIN > rAt(zTop) + 0.05) return null;
    const sleeveR = boreR + SLEEVE_WALL;
    if (sleeveR + 6 > R) return null;
    let seamZ = null;
    for (let z = z0; z > -R + 1; z -= 0.2) {
        const rim = maleMinor + (z0 - z) + LIP;
        if (rim >= rAt(z) - 0.15) {
            seamZ = q(z);
            break;
        }
    }
    if (seamZ == null) return null;
    const rSeam = rAt(seamZ);
    if (rSeam - LIP < maleMinor + 1) return null;
    // The thread pocket is open on the bed. Close it with a 45° cone, then
    // leave FLOOR mm of solid before the bar stops. A flat lid would bridge.
    const zFloor = q(zTop + maleMajor + T_CLEAR + FLOOR);
    return { R, zTop, z0, seamZ, rSeam, maleMajor, maleMinor, sleeveR, boreR, threadLen, zFloor };
}

function normalize(input) {
    const src = input || {};
    const printer = PRINTERS[src.printer] || PRINTERS['a1-mini'];
    const bed = src.printer === 'custom'
        ? clamp(src.bed, 120, 400, 180)
        : printer.bed;
    const bar = q(clamp(src.bar, 20, 70, 50.8));
    const bore = q(bar + BAR_CLEAR);
    const boreR = bore / 2;
    let ball = clamp(src.ball, 60, 240, 100);
    let R = ball / 2;
    let geom = null;
    let raised = false;
    for (let i = 0; i < 50 && !geom; i++) {
        geom = solve(R, boreR);
        if (!geom) {
            R = q(R + 2);
            raised = true;
        }
    }
    if (!geom) throw fail('That bar does not fit a ball this page can build');
    ball = q(R * 2);
    let stick = Math.round(clamp(bar * 1.15, 48, 80, 58));
    const maxZ = bed - 5;
    const maxXY = bed - MARGIN;
    let shortened = false;
    let lengthened = false;
    const minMouth = geom.zFloor + 40;
    let zMouth = geom.R + stick;
    if (zMouth < minMouth) {
        stick = Math.ceil(minMouth - geom.R);
        zMouth = geom.R + stick;
        lengthened = true;
    }
    while (zMouth - geom.seamZ > maxZ && zMouth - 2 >= minMouth - 0.01) {
        stick -= 2;
        zMouth = geom.R + stick;
        shortened = true;
    }
    const upperH = q(zMouth - geom.seamZ);
    const lowerH = q(geom.zTop - (-geom.R));
    const xy = q(Math.max(ball, geom.sleeveR * 2));
    const fits = xy <= maxXY + 0.2 && upperH <= maxZ + 0.2 && lowerH <= maxZ + 0.2;
    return {
        printer: src.printer === 'custom' ? 'custom' : printer.id,
        printerName: src.printer === 'custom' ? 'Other bed' : printer.name,
        bed,
        bar,
        bore,
        ball,
        stick,
        raised,
        shortened,
        lengthened,
        fits,
        maxXY,
        maxZ,
        upperH,
        lowerH,
        xy,
        geom: { ...geom, zMouth, stick },
    };
}

// The thread of the ROCKER AS ASSEMBLED, in the sleeve's own frame: right-hand,
// the same helix the sleeve's pocket is cut with.
function maleRadius(geom, z, theta) {
    const rel = z - geom.z0;
    const tp = taper(rel, geom.threadLen);
    const h = threadHeight(rel / PITCH - theta / (Math.PI * 2)) * tp;
    return geom.maleMinor + DEPTH * h - MALE_RELIEF * tp;
}

function femaleRadius(geom, z, theta) {
    const rel = z - geom.z0;
    const h = threadHeight(rel / PITCH - theta / (Math.PI * 2) + 0.5) * taper(rel, geom.threadLen);
    return geom.maleMajor + T_CLEAR - DEPTH * h;
}

function plugRadius(geom, z) {
    if (z >= geom.z0) return geom.maleMinor;
    return geom.maleMinor + (geom.z0 - z);
}

function minGap(spec) {
    const geom = spec.geom;
    let gap = Infinity;
    const steps = 40;
    for (let i = 1; i < steps; i++) {
        const z = geom.z0 + (i / steps) * geom.threadLen;
        for (let k = 0; k < N; k++) {
            const theta = (k / N) * Math.PI * 2;
            const g = femaleRadius(geom, z, theta) - maleRadius(geom, z, theta);
            if (g < gap) gap = g;
        }
    }
    return gap;
}

function ring(z, rAt) {
    const pts = [];
    const zz = q(z);
    for (let i = 0; i < N; i++) {
        const theta = (i / N) * Math.PI * 2;
        const r = rAt(theta);
        pts.push({ x: q(Math.cos(theta) * r), y: q(Math.sin(theta) * r), z: zz });
    }
    return pts;
}

function dot(z) {
    return [{ x: 0, y: 0, z: q(z) }];
}

function connect(tris, A, B, outward) {
    if (A.length === 1) {
        for (let k = 0; k < B.length; k++) {
            const k2 = (k + 1) % B.length;
            tris.push(outward ? [A[0], B[k2], B[k]] : [A[0], B[k], B[k2]]);
        }
        return;
    }
    if (B.length === 1) {
        for (let k = 0; k < A.length; k++) {
            const k2 = (k + 1) % A.length;
            tris.push(outward ? [B[0], A[k], A[k2]] : [B[0], A[k2], A[k]]);
        }
        return;
    }
    const n = A.length;
    for (let k = 0; k < n; k++) {
        const k2 = (k + 1) % n;
        if (outward) tris.push([A[k], A[k2], B[k2]], [A[k], B[k2], B[k]]);
        else tris.push([A[k], B[k2], A[k2]], [A[k], B[k], B[k2]]);
    }
}

function annulus(outer, inner, up) {
    const tris = [];
    for (let k = 0; k < outer.length; k++) {
        const k2 = (k + 1) % outer.length;
        const a = outer[k];
        const b = outer[k2];
        const c = inner[k2];
        const d = inner[k];
        if (up) tris.push([a, b, c], [a, c, d]);
        else tris.push([a, c, b], [a, d, c]);
    }
    return tris;
}

function zs(z0, z1, step) {
    const out = [];
    const a = q(z0);
    const b = q(z1);
    out.push(a);
    for (let z = a + step; z < b - step * 0.35; z += step) out.push(q(z));
    if (out[out.length - 1] !== b) out.push(b);
    return out;
}

function chain(tris, rings, outward) {
    for (let i = 0; i < rings.length - 1; i++) connect(tris, rings[i], rings[i + 1], outward);
}

function upperMesh(spec) {
    const g = spec.geom;
    const sleeveStart = Math.sqrt(Math.max(0, g.R * g.R - g.sleeveR * g.sleeveR));
    const outerZ = zs(g.seamZ, Math.min(sleeveStart, g.zMouth), 2.4).concat(zs(Math.min(sleeveStart, g.zMouth), g.zMouth, 3));
    const outer = [];
    const seen = new Set();
    for (const z of outerZ) {
        if (seen.has(z) || z < g.seamZ - 0.001 || z > g.zMouth + 0.001) continue;
        seen.add(z);
        const rs = sphereR(g.R, z);
        let r = z >= sleeveStart - 0.05 ? g.sleeveR : Math.max(rs, g.sleeveR);
        if (z > g.zMouth - 1.6) r = g.sleeveR - 1.2;
        outer.push(ring(z, () => r));
    }
    const pocketZ = zs(g.seamZ, g.z0, 1.6).concat(zs(g.z0, g.zTop, PITCH / 8));
    const pocket = [];
    const seenP = new Set();
    for (const z of pocketZ) {
        if (seenP.has(z)) continue;
        seenP.add(z);
        const rAt = z < g.z0 - 0.02
            ? () => plugRadius(g, z) + DEPTH + T_CLEAR
            : (theta) => femaleRadius(g, z, theta);
        pocket.push(ring(z, rAt));
    }
    const bore0 = q(g.zFloor);
    const bore = [ring(bore0, () => g.boreR)];
    for (const z of zs(bore0, g.zMouth, 3).slice(1)) {
        const flare = z > g.zMouth - 3 ? g.boreR + 1.6 : g.boreR;
        bore.push(ring(z, () => flare));
    }
    // 45° roof. A flat cap across the thread is an 80 mm bridge.
    const roof = [];
    const roofR = g.maleMajor + T_CLEAR;
    const tipZ = q(g.zTop + roofR);
    for (let z = g.zTop + 2.4; z < tipZ - 0.6; z += 2.4) {
        const r = roofR - (z - g.zTop);
        if (r < 1.2) break;
        roof.push(ring(z, () => r));
    }
    const tris = [];
    tris.push(...annulus(outer[0], pocket[0], false));
    chain(tris, outer, true);
    chain(tris, pocket.concat(roof), false);
    connect(tris, roof.length ? roof[roof.length - 1] : pocket[pocket.length - 1], dot(tipZ), false);
    connect(tris, dot(q(bore0 - 0.01)), bore[0], false);
    chain(tris, bore, false);
    tris.push(...annulus(outer[outer.length - 1], bore[bore.length - 1], true));
    return ladder.finalize(tris);
}

function lowerMesh(spec) {
    const g = spec.geom;
    const pole = q(-g.R);
    const sphere = [];
    for (const z of zs(pole + 1.5, g.seamZ, 2.4)) sphere.push(ring(z, () => sphereR(g.R, z)));
    const plug = [ring(g.seamZ, () => plugRadius(g, g.seamZ + 0.05))];
    for (const z of zs(g.seamZ, g.z0, 1.6).slice(1)) plug.push(ring(z, () => plugRadius(g, z)));
    // The rocker is built upside down and flipped in z for printing. A flip is a
    // mirror, and a mirrored helix is the opposite hand, so the thread is cut
    // mirrored here (theta -> -theta) to come out right-hand once flipped. Up to
    // this fix the flip was missing a counter-mirror: the printed rocker was a
    // LEFT-hand thread and could not enter the right-hand sleeve.
    const zTopRing = q(g.zTop);
    for (const z of zs(g.z0, g.zTop, PITCH / 8).slice(1)) {
        const chamfer = z >= zTopRing - 0.001 ? BED_CHAMFER : 0;
        plug.push(ring(z, (theta) => maleRadius(g, z, -theta) - chamfer));
    }
    const tris = [];
    connect(tris, dot(pole), sphere[0], true);
    chain(tris, sphere, true);
    tris.push(...annulus(sphere[sphere.length - 1], plug[0], true));
    chain(tris, plug, true);
    connect(tris, plug[plug.length - 1], dot(q(g.zTop)), true);
    const flipped = tris.map((t) => t.map((p) => ({ x: p.x, y: p.y, z: q(g.zTop - p.z) })));
    return ladder.finalize(flipped);
}

function sizeOf(stats) {
    return stats.size.x + ' × ' + stats.size.y + ' × ' + stats.size.z + ' mm';
}

let cache = new Map();

function build(input) {
    const spec = normalize(input);
    const key = [spec.ball, spec.bar, spec.stick, spec.geom.zMouth].join('|');
    let parts = cache.get(key);
    if (!parts) {
        const sleeve = upperMesh(spec);
        const rocker = lowerMesh(spec);
        const sleeveStats = ladder.meshStats(sleeve);
        const rockerStats = ladder.meshStats(rocker);
        if (!sleeveStats.watertight) throw fail('The sleeve mesh did not close');
        if (!rockerStats.watertight) throw fail('The rocker mesh did not close');
        parts = [
            { name: 'sleeve.stl', count: 1, role: 'sleeve', size: sizeOf(sleeveStats), stl: ladder.writeStl(sleeve, 'octopus landmine sleeve'), stats: sleeveStats },
            { name: 'rocker.stl', count: 1, role: 'rocker', size: sizeOf(rockerStats), stl: ladder.writeStl(rocker, 'octopus landmine rocker'), stats: rockerStats },
        ];
        cache.set(key, parts);
    }
    return { spec, parts };
}

function readme(spec) {
    const fit = spec.fits
        ? 'Both pieces fit the selected bed (' + spec.bed + ' mm).'
        : 'A piece is larger than the selected bed. It still downloads. Pick a larger bed, or a smaller ball.';
    const raised = spec.raised
        ? 'The ball was raised to ' + spec.ball + ' mm so this bar and the thread fit inside it.'
        : '';
    const short = spec.shortened
        ? 'The sleeve was shortened to ' + spec.stick + ' mm of stick-out so the height fits the bed.'
        : null;
    const long = spec.lengthened
        ? 'The sleeve was extended so the bar can slide in and stop.'
        : null;
    return [
        'Octopus landmine',
        '',
        'A pivot for the end of a barbell. The sleeve is the tube. The rocker is the other half of the ball. They screw together. The bar slides into the sleeve until it stops.',
        '',
        'This file is for a ' + spec.bar + ' mm bar. The hole is ' + spec.bore + ' mm, which is ' + BAR_CLEAR + ' mm larger than the bar so it slides in. The ball is ' + spec.ball + ' mm across.',
        raised || null,
        short,
        long,
        fit,
        '',
        'The thread is coarse on purpose: ' + PITCH + ' mm per turn and ' + DEPTH + ' mm deep, with a wide crest. A fine thread wears away. This one still turns after some wear. About ' + TURNS + ' turns hold the halves together. Both halves are the same right-hand thread. The rocker is made ' + MALE_RELIEF + ' mm slimmer than the hole so a printed pair turns freely. If you printed an earlier rocker that would not screw in, it was a left-hand thread: reprint only the rocker. The sleeve is unchanged, so your existing sleeve fits the new rocker.',
        '',
        'Print in PETG. 0.2 mm layers, 6 walls, about 50% infill. No supports. Print the sleeve with the flat seam on the bed and the tube pointing up. Print the rocker with the thread on the bed and the dome pointing up. The rocker has a small chamfer on the thread end for the first layer. Scrub any burr off the thread with a file if it binds.',
        '',
        'Assembly',
        '1. Let both pieces cool.',
        '2. Screw the rocker into the sleeve until the seam closes. It is a right-hand thread: turn it clockwise as you look at the thread end. Stop when it seats. Do not force a cross-thread.',
        '3. Slide the bar into the sleeve until it stops.',
        '4. To use a different bar, generate the parts again with that bar diameter. The hole is not a clamp.',
        '',
        'Look at the thread and the seam before you load the bar. If the plastic cracks, retire the print. This page does not rate a working load.',
        '',
        'The ball is smooth so it rolls and so it prints without supports.',
    ].filter((line) => line !== null).join('\n');
}

function describe(spec) {
    const hole = 'Hole is ' + spec.bore + ' mm for a ' + spec.bar + ' mm bar.';
    const ball = 'Ball is ' + spec.ball + ' mm across.';
    const fit = spec.fits
        ? 'Sleeve half is ' + spec.upperH + ' mm tall. It fits the ' + spec.printerName + ' (' + spec.bed + ' mm bed).'
        : 'This is larger than the ' + spec.printerName + ' bed (' + spec.bed + ' mm). The file still builds.';
    const notes = [];
    if (spec.raised) notes.push('Raised the ball to ' + spec.ball + ' mm so the bar and the thread fit.');
    if (spec.shortened) notes.push('Shortened the sleeve stick-out to ' + spec.stick + ' mm so the height fits the bed.');
    if (spec.lengthened) notes.push('Extended the sleeve so the bar can slide in and stop.');
    return {
        ok: true,
        bar: spec.bar,
        bore: spec.bore,
        ball: spec.ball,
        stick: spec.stick,
        pitch: PITCH,
        depth: DEPTH,
        fits: spec.fits,
        printerName: spec.printerName,
        bed: spec.bed,
        holeLine: hole,
        ballLine: ball,
        fitLine: fit,
        threadLine: 'Thread is ' + PITCH + ' mm per turn and ' + DEPTH + ' mm deep.',
        notes,
        lines: readme(spec).split('\n'),
    };
}

function plan(input) {
    const spec = normalize(input);
    const view = describe(spec);
    view.parts = [
        { name: 'sleeve.stl', count: 1, role: 'sleeve', size: spec.upperH + ' mm tall' },
        { name: 'rocker.stl', count: 1, role: 'rocker', size: spec.ball + ' mm ball' },
    ];
    return view;
}

function kitZip(input) {
    const built = build(input);
    const note = Buffer.from(readme(built.spec), 'utf8');
    return ladder.zipStore(built.parts.map((p) => ({ name: p.name, data: p.stl })).concat([
        { name: 'read-me.txt', data: note },
    ]));
}

function preview(input) {
    const built = build(input);
    return {
        ok: true,
        parts: built.parts.map((p) => ({
            name: p.name,
            count: p.count,
            role: p.role,
            size: p.size,
            stl: p.stl.toString('base64'),
        })),
    };
}

module.exports = {
    PITCH,
    DEPTH,
    BAR_CLEAR,
    BARS,
    PRINTERS,
    normalize,
    minGap,
    plan,
    kitZip,
    preview,
    build,
};
