'use strict';

// Two-piece jump-rope handle. The cap holds a paracord knot. The handle screws
// into the cap on a coarse thread so the knot can be changed, and so wear does
// not shave the crests off the way a fine machine thread does.
//
// Pitch 5.5 mm, depth 2 mm, crest and root each 1.8 mm wide. Radial clearance
// is 0.55 mm, so the parts still turn after a little wear and about four turns
// keep the cap on. A double overhand knot does not fit the 5.5 mm cord hole.

const ladder = require('./ladder');

const PITCH = 5.5;
const DEPTH = 2;
const CREST = 1.8;
const ROOT = 1.8;
const CLEARANCE = 0.55;
const MALE_MAJOR = 13;
const TURNS = 4;
const TAPER_TURNS = 0.45;
const N = 64;
const HOLE_DIA = 5.5;
const GRIP_R = 17;
const CAP_R = 22;
const GRIP_LEN = 100;
const SHOULDER = 5;
const WALL = 4;
const FLARE = 2;
const CHAMBER = 12;
const TRANSITION = 3;

const MALE_MINOR = MALE_MAJOR - DEPTH;
const FEMALE_VALLEY = MALE_MAJOR + CLEARANCE;
const FEMALE_CREST = FEMALE_VALLEY - DEPTH;
const THREAD_LEN = PITCH * TURNS;
const HOLE_R = HOLE_DIA / 2;

function q(n) {
    return Math.round(n * 100) / 100;
}

function hexR(cornerR, theta) {
    const sector = Math.PI / 3;
    let a = theta % sector;
    if (a < 0) a += sector;
    a = Math.abs(a - sector / 2);
    return (cornerR * Math.cos(sector / 2)) / Math.cos(a);
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

function taper(z, length) {
    const lead = TAPER_TURNS * PITCH;
    if (z <= 0 || z >= length) return 0;
    if (z < lead) return z / lead;
    if (z > length - lead) return (length - z) / lead;
    return 1;
}

function maleRadius(z, theta) {
    const h = threadHeight(z / PITCH - theta / (Math.PI * 2)) * taper(z, THREAD_LEN);
    return MALE_MINOR + DEPTH * h;
}

function femaleRadius(z, theta) {
    const h = threadHeight(z / PITCH - theta / (Math.PI * 2) + 0.5) * taper(z, THREAD_LEN);
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

function handleMesh() {
    const threadStart = GRIP_LEN + SHOULDER;
    const threadEnd = threadStart + THREAD_LEN;
    const zs = [0].concat(steps(4, GRIP_LEN, 8)).concat(steps(GRIP_LEN + SHOULDER / 2, threadStart, SHOULDER / 2));
    const threadZs = steps(threadStart, threadEnd, PITCH / 36).filter((z) => z > threadStart + 0.02);
    const rings = [[{ x: 0, y: 0, z: 0 }]];
    function radiusAt(z) {
        return function (theta) {
            if (z <= GRIP_LEN) return hexR(GRIP_R, theta);
            if (z <= threadStart) {
                const u = (z - GRIP_LEN) / SHOULDER;
                return hexR(GRIP_R, theta) * (1 - u) + MALE_MINOR * u;
            }
            return maleRadius(z - threadStart, theta);
        };
    }
    for (const z of zs.concat(threadZs)) rings.push(circle(z, radiusAt(z)));
    rings.push([{ x: 0, y: 0, z: threadEnd }]);
    const tris = [];
    for (let i = 0; i < rings.length - 1; i++) connect(tris, rings[i], rings[i + 1], true);
    return ladder.finalize(tris);
}

function capInner(z, theta) {
    const chamberStart = WALL + FLARE;
    const chamberEnd = chamberStart + CHAMBER;
    const threadStart = chamberEnd + TRANSITION;
    if (z <= WALL) return HOLE_R;
    if (z <= chamberStart) return HOLE_R + (8.5 - HOLE_R) * ((z - WALL) / FLARE);
    if (z <= chamberEnd) return 8.5;
    if (z <= threadStart) {
        const u = (z - chamberEnd) / TRANSITION;
        return 8.5 + (FEMALE_VALLEY - 8.5) * u;
    }
    return femaleRadius(z - threadStart, theta);
}

function capOuter(z, theta) {
    return hexR(CAP_R, theta);
}

function capMesh() {
    const threadStart = WALL + FLARE + CHAMBER + TRANSITION;
    const top = threadStart + THREAD_LEN;
    const zs = steps(0, WALL, WALL)
        .concat(steps(WALL + FLARE, WALL + FLARE + CHAMBER, 4).filter((z) => z > WALL))
        .concat(steps(threadStart - TRANSITION, threadStart, TRANSITION).filter((z) => z > WALL + FLARE + CHAMBER))
        .concat(steps(threadStart, top, PITCH / 36).filter((z) => z > threadStart));
    const uniq = [];
    for (const z of [0].concat(zs, [top])) {
        if (!uniq.length || Math.abs(uniq[uniq.length - 1] - z) > 0.03) uniq.push(z);
    }
    const outers = uniq.map((z) => circle(z, (theta) => capOuter(z, theta)));
    const inners = uniq.map((z) => circle(z, (theta) => capInner(z, theta)));
    const tris = [];
    tris.push(...annulus(outers[0], inners[0], false));
    for (let i = 0; i < uniq.length - 1; i++) {
        connect(tris, outers[i], outers[i + 1], true);
        connect(tris, inners[i], inners[i + 1], false);
    }
    tris.push(...annulus(outers[outers.length - 1], inners[inners.length - 1], true));
    return ladder.finalize(tris);
}

function sizeOf(stats) {
    return stats.size.x + ' × ' + stats.size.y + ' × ' + stats.size.z + ' mm';
}

function fits(stats) {
    const bed = 165;
    return stats.size.x <= bed && stats.size.y <= bed && stats.size.z <= bed;
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
        { name: 'cap.stl', count: 2, role: 'cap', size: sizeOf(capStats), stl: capStl, stats: capStats },
        { name: 'handle.stl', count: 2, role: 'handle', size: sizeOf(handleStats), stl: handleStl, stats: handleStats },
    ];
    built = { handle: handle, cap: cap, parts: parts };
    return built;
}

function readme() {
    return [
        'Octopus jump-rope handles',
        '',
        'Two printed pieces, and a length of paracord. The cap has a 5.5 mm hole. The cord passes through. A double knot does not. The handle screws into the cap, so you can change the rope without cutting the handle.',
        '',
        'The thread is coarse on purpose: 5.5 mm per turn, 2 mm deep, with a wide crest. A fine thread wears away. This one still turns after some wear. About four turns hold the cap on, and it unscrews by hand.',
        '',
        'Print two caps and two handles. Stand each one up with the thread toward the top. No supports. 0.2 mm layers, 4 walls, about 30% infill. PETG lasts longer than PLA. Both pieces fit a 180 mm bed.',
        '',
        'Assembly',
        '1. Cut the cord. A starting length is your height plus about 90 cm (about 2.6 m if you are 170 cm tall).',
        '2. Pass one end through the small hole in a cap, from the outside.',
        '3. Tie a double knot: one overhand knot, then a second overhand knot on top of it. Pull it tight.',
        '4. Pull the cord until the knot sits in the chamber inside the cap. The hole will not let the knot back out.',
        '5. Screw the handle into the cap until it stops. It should stay put while you jump.',
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
        lines: readme().split('\n'),
        parts: model.parts.map((p) => ({ name: p.name, count: p.count, role: p.role, size: p.size })),
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
    MALE_MAJOR,
    MALE_MINOR,
    FEMALE_VALLEY,
    FEMALE_CREST,
    THREAD_LEN,
    maleRadius,
    femaleRadius,
    minGap,
    plan,
    kitZip,
    preview,
    build,
};
