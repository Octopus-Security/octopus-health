'use strict';

// Two-piece jump-rope handle, built light. Per side: a hollow handle and a cap.
// The cord goes through the small hole in the cap, a double overhand knot sits
// in the chamber behind it, and the handle screws into the cap on a coarse
// thread so the cord can be changed. Both pieces are thin revolved shells: the
// plastic is walls, not infill, so the numbers below are the grams.
//
// Printed upright, open end up, no supports. The body's overhangs are 45 degree
// cones, not shelves, and the down-facing thread flank is a 50 degree ramp
// (test/print-overhangs.test.js measures both off the STL). Dimensions in mm.
//
// Pitch 5.5, depth 2, crest and root each 1.8 wide. Radial clearance is 0.8 mm
// (about 0.38 square to a flank), which is more than the 0.1-0.2 mm per side a
// printed thread loses, so the pair still turns and still turns after wear.
// Both threads are right-hand and neither piece is mirrored for printing.

const ladder = require('./ladder');

const PITCH = 5.5;
const DEPTH = 2;
const CREST = 1.8;
const ROOT = 1.8;
const CLEARANCE = 0.8;
const MALE_MAJOR = 9.5;
const TURNS = 3.5;
const TAPER_TURNS = 0.35;
const N = 64;
const HOLE_DIA = 5.5;
const CORD_DIA = 4;
const GRIP_R = 11.5;
const GRIP_LEN = 76;
const GRIP_WALL = 1.2;
const BORE_WALL = 1.6;
const CAP_WALL = 1.2;
const FLOOR = 1.6;
const CHAMBER_R = 7.25;
const CHAMBER_LEN = 7;
const RELIEF = 2.5;
const FOOT = 1.2;
const PETG_G_CM3 = 1.27;

const MALE_MINOR = MALE_MAJOR - DEPTH;
const FEMALE_VALLEY = MALE_MAJOR + CLEARANCE;
const FEMALE_CREST = FEMALE_VALLEY - DEPTH;
const THREAD_LEN = PITCH * TURNS;
const HOLE_R = HOLE_DIA / 2;
const BORE_R = MALE_MINOR - BORE_WALL;
const SHOULDER = GRIP_R - MALE_MINOR;
// Where the handle's 45 degree shoulder meets the cap's mouth, measured from
// the start of the handle's thread. That much of the thread is outside the cap.
const SEAT_DEPTH = SHOULDER - (GRIP_R - FEMALE_VALLEY);

function q(n) {
    return Math.round(n * 100) / 100;
}

function smooth(u) {
    const t = Math.min(1, Math.max(0, u));
    return t * t * (3 - 2 * t);
}

// 0 on the root, 1 on the crest. The crest sits half a turn from the root,
// so the female groove (half a turn out of phase) clears the male crest.
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

// The flank that faces DOWN as each piece prints (both print thread-up) is a
// straight 50 degree ramp instead of the S-curve, which peaks near 72 degrees
// and sags. The ramp is used only where it lies inside the S-curve (delta
// shifts it so it never lies outside), so it only ever removes plastic from
// that piece: the clearance can only grow, never bind.
const DOWN_FLANK_DEG = 50;
const FLANK_W = (1 - CREST / PITCH - ROOT / PITCH) / 2;
const RAMP = (() => {
    const k = Math.tan(DOWN_FLANK_DEG * Math.PI / 180) * FLANK_W * PITCH / DEPTH;
    let delta = 0;
    for (let i = 0; i <= 1000; i++) delta = Math.max(delta, i / 1000 - smooth(i / 1000) / k);
    return { k, delta };
})();

// Rising side (a..b) ramped: on the handle it is the underside of each crest,
// in the cap it is the underside of each inward ridge.
function risingRamped(phase) {
    const p = phase - Math.floor(phase);
    const old = threadHeight(p);
    const a = ROOT / PITCH / 2;
    if (p < a || old === 0) return old;
    const u = (p - a) / FLANK_W;
    return Math.min(old, Math.min(1, Math.max(0, (u - RAMP.delta) * RAMP.k)));
}

function taper(z, length) {
    const lead = TAPER_TURNS * PITCH;
    if (z <= 0 || z >= length) return 0;
    if (z < lead) return z / lead;
    if (z > length - lead) return (length - z) / lead;
    return 1;
}

function maleRadius(z, theta) {
    const h = risingRamped(z / PITCH - theta / (Math.PI * 2)) * taper(z, THREAD_LEN);
    return MALE_MINOR + DEPTH * h;
}

function femaleRadius(z, theta) {
    const h = risingRamped(z / PITCH - theta / (Math.PI * 2) + 0.5) * taper(z, THREAD_LEN);
    return FEMALE_VALLEY - DEPTH * h;
}

function minGap() {
    let gap = Infinity;
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
        const z = (i / steps) * THREAD_LEN;
        for (let k = 0; k < N; k++) {
            const theta = (k / N) * Math.PI * 2;
            const g = femaleRadius(z, theta) - maleRadius(z, theta);
            if (g < gap) gap = g;
        }
    }
    return gap;
}

function circle(z, radiusAt) {
    const pts = [];
    for (let i = 0; i < N; i++) {
        const theta = (i / N) * Math.PI * 2;
        const r = radiusAt(theta);
        pts.push({ x: Math.cos(theta) * r, y: Math.sin(theta) * r, z: z });
    }
    return pts;
}

function connect(tris, A, B, outward) {
    const n = Math.max(A.length, B.length);
    if (A.length === 1) {
        for (let k = 0; k < B.length; k++) {
            const k2 = (k + 1) % B.length;
            // The bottom face points out through -z, opposite a CCW fan.
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

function steps(z0, z1, step) {
    const zs = [q(z0)];
    for (let z = z0 + step; z < z1 - step * 0.25; z += step) zs.push(q(z));
    const end = q(z1);
    if (zs[zs.length - 1] !== end) zs.push(end);
    return zs;
}


// A closed profile, walked outside-up then inside-down, becomes one shell.
// Each entry is [z, radius] or [z, fn(theta)]; an entry with radius null is a
// point on the axis.
function shell(profile, closed) {
    const rings = profile.map(([z, r]) => (r === null ? [{ x: 0, y: 0, z: z }] : circle(z, typeof r === 'function' ? r : () => r)));
    const tris = [];
    for (let i = 0; i < rings.length - 1; i++) connect(tris, rings[i], rings[i + 1], true);
    if (closed) tris.push(...annulus(rings[0], rings[rings.length - 1], false));
    return ladder.finalize(tris);
}

function threadSteps(z0, z1) {
    return steps(z0, z1, PITCH / 20).slice(1);
}

function handleMesh() {
    const threadStart = GRIP_LEN + SHOULDER;
    const threadEnd = threadStart + THREAD_LEN;
    const innerGrip = GRIP_R - GRIP_WALL;
    const coneTop = GRIP_LEN + (innerGrip - BORE_R);
    const profile = [[0, null], [0, GRIP_R - FOOT], [FOOT, GRIP_R], [GRIP_LEN, GRIP_R], [threadStart, MALE_MINOR]];
    for (const z of threadSteps(threadStart, threadEnd)) profile.push([z, (theta) => maleRadius(z - threadStart, theta)]);
    profile.push([threadEnd, BORE_R], [coneTop, BORE_R], [GRIP_LEN, innerGrip], [FOOT + FLOOR, innerGrip], [FOOT + FLOOR, null]);
    return shell(profile, false);
}

function capGeometry() {
    const flareEnd = FLOOR + (CHAMBER_R - HOLE_R);
    const chamberEnd = flareEnd + CHAMBER_LEN;
    const rampEnd = chamberEnd + (FEMALE_VALLEY - CHAMBER_R);
    const threadStart = rampEnd + RELIEF;
    const top = threadStart + THREAD_LEN;
    const outerC = CHAMBER_R + CAP_WALL;
    const outerT = FEMALE_VALLEY + CAP_WALL;
    return { flareEnd, chamberEnd, rampEnd, threadStart, top, outerC, outerT, outerFoot: outerC - 3.6 };
}

function capMesh() {
    const c = capGeometry();
    const profile = [
        [0, c.outerFoot], [3.6, c.outerC], [c.chamberEnd, c.outerC],
        [c.chamberEnd + (c.outerT - c.outerC), c.outerT], [c.top, c.outerT],
    ];
    const inside = threadSteps(c.threadStart, c.top).reverse();
    profile.push([c.top, (theta) => femaleRadius(c.top - c.threadStart, theta)]);
    for (const z of inside.slice(1)) profile.push([z, (theta) => femaleRadius(z - c.threadStart, theta)]);
    profile.push([c.threadStart, FEMALE_VALLEY], [c.rampEnd, FEMALE_VALLEY], [c.chamberEnd, CHAMBER_R], [c.flareEnd, CHAMBER_R], [FLOOR, HOLE_R], [0, HOLE_R]);
    return shell(profile, true);
}

function sizeOf(stats) {
    return stats.size.x + ' × ' + stats.size.y + ' × ' + stats.size.z + ' mm';
}

function fits(stats) {
    const bed = 165;
    return stats.size.x <= bed && stats.size.y <= bed && stats.size.z <= bed;
}

function grams(stats) {
    return stats.volume / 1000 * PETG_G_CM3;
}

let built = null;
function build() {
    if (built) return built;
    const handle = handleMesh();
    const cap = capMesh();
    const handleStats = ladder.meshStats(handle);
    const capStats = ladder.meshStats(cap);
    if (!handleStats.watertight) throw new Error('The handle mesh did not close');
    if (!capStats.watertight) throw new Error('The cap mesh did not close');
    if (!fits(handleStats) || !fits(capStats)) throw new Error('A jump-rope part is larger than the bed');
    const handleStl = ladder.writeStl(handle, 'octopus rope handle');
    const capStl = ladder.writeStl(cap, 'octopus rope cap');
    const parts = [
        { name: 'cap.stl', count: 2, role: 'cap', size: sizeOf(capStats), grams: q(grams(capStats)), stl: capStl, stats: capStats },
        { name: 'handle.stl', count: 2, role: 'handle', size: sizeOf(handleStats), grams: q(grams(handleStats)), stl: handleStl, stats: handleStats },
    ];
    const totalGrams = q(parts.reduce((sum, p) => sum + p.grams * p.count, 0));
    built = { handle: handle, cap: cap, parts: parts, totalGrams };
    return built;
}

function readme() {
    const model = build();
    const cap = model.parts[0];
    const handle = model.parts[1];
    return [
        'Octopus jump-rope handles',
        '',
        'Two printed pieces per side, and a length of paracord. Both are thin hollow shells, about ' + Math.round(model.totalGrams) + ' g of plastic for the whole rope (2 caps ' + cap.grams + ' g each, 2 handles ' + handle.grams + ' g each, PETG). The cap has a ' + HOLE_DIA + ' mm hole. 550 paracord is about ' + CORD_DIA + ' mm, so it passes. A double knot does not. The handle screws into the cap, so you can change the rope without cutting the handle.',
        '',
        'The thread is coarse on purpose: 5.5 mm per turn, 2 mm deep, with a wide crest, right-hand on both pieces. A fine thread wears away. This one still turns after some wear. About four turns hold the cap on, and it unscrews by hand.',
        '',
        'Print two caps and two handles. Stand each one up with the open end toward the top. No supports. 0.2 mm layers, 3 walls, 10% infill (the walls are most of the part, so infill hardly matters). PETG lasts longer than PLA. Both pieces fit a 180 mm bed.',
        '',
        'Assembly',
        '1. Cut the cord. A starting length is your height plus about 90 cm (about 2.6 m if you are 170 cm tall).',
        '2. Pass one end through the small hole in a cap, from the outside.',
        '3. Tie a double knot: one overhand knot, then a second overhand knot on top of it. Pull it tight.',
        '4. Pull the cord until the knot sits in the chamber inside the cap. The hole will not let the knot back out.',
        '5. Screw the handle into the cap until the shoulder meets the cap. Turn it clockwise. It should stay put while you jump.',
        '6. Do the same at the other end.',
        '',
        'To change the rope, unscrew the handle, pull the knot out through the open end of the cap, untie it, and feed a new cord through the same hole.',
        '',
        'The cord is the rope. Nothing else is required.',
    ].join('\n');
}

function plan() {
    const model = build();
    return {
        ok: true,
        holeDia: HOLE_DIA,
        pitch: PITCH,
        depth: DEPTH,
        clearance: CLEARANCE,
        turns: TURNS,
        maleMajor: MALE_MAJOR * 2,
        femaleValley: q(FEMALE_VALLEY * 2),
        engagement: q(MALE_MAJOR - FEMALE_CREST),
        gap: q(minGap()),
        grams: model.totalGrams,
        lines: readme().split('\n'),
        parts: model.parts.map((p) => ({ name: p.name, count: p.count, role: p.role, size: p.size, grams: p.grams })),
    };
}

function kitZip() {
    const model = build();
    const note = Buffer.from(readme(), 'utf8');
    return ladder.zipStore(model.parts.map((p) => ({ name: p.name, data: p.stl })).concat([
        { name: 'read-me.txt', data: note },
    ]));
}

function preview() {
    const model = build();
    return {
        ok: true,
        parts: model.parts.map((p) => ({
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
    CLEARANCE,
    HOLE_DIA,
    CORD_DIA,
    MALE_MAJOR,
    MALE_MINOR,
    FEMALE_VALLEY,
    FEMALE_CREST,
    THREAD_LEN,
    GRIP_R,
    GRIP_LEN,
    BORE_R,
    CHAMBER_R,
    RELIEF,
    SEAT_DEPTH,
    SHOULDER,
    capGeometry,
    maleRadius,
    femaleRadius,
    minGap,
    plan,
    kitZip,
    preview,
    build,
};
