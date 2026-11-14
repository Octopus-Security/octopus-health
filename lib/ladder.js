'use strict';

// Collapsible agility ladder: paracord or bars, connectors that fit a small bed.
// A turn sits between rungs, so every bar stays on the 45° socket grid.
// Meshes are one watertight shell. Overlapping boxes double-extrude in Bambu Studio.

const PRINTERS = {
    'a1-mini': { id: 'a1-mini', name: 'Bambu A1 mini', bed: 180 },
    a1: { id: 'a1', name: 'Bambu A1', bed: 256 },
};
const MARGIN = 15;
const CLEARANCE = 0.35;
const LIP = 2.4;
const WALL_T = 2.4;
const MID_WALL = 3;
const FLOOR_MIN = 2.4;
const WELL_DEPTH = 5;
const CORD_CLEAR = 1.1;
const POCKET_GAP = 1.5;
const PIN_SHAFT_R = 2;
const PIN_HOLE_R = 2.1;
const PIN_HEAD_H = 1.5;
const CIRCLE_N = 36;
const HOLE_N = 18;

function q(n) {
    return Math.round(n * 100) / 100;
}

function round1(n) {
    return Math.round(n * 10) / 10;
}

function fail(message) {
    const err = new Error(message);
    err.status = 400;
    return err;
}

function clamp(n, lo, hi, fallback) {
    n = Number(n);
    if (!Number.isFinite(n)) n = fallback;
    return Math.min(hi, Math.max(lo, n));
}

function defaults() {
    return {
        printer: 'a1-mini',
        bed: 180,
        rails: 'cord',
        rungs: 'stick',
        width: 450,
        spacing: 400,
        grip: 32,
        cord: 4,
        stickW: 12,
        stickH: 6,
        dowel: 16,
        ports: 'auto',
        runs: [{ squares: 4, turn: 0 }],
    };
}

function polyArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const r = poly[(i + 1) % poly.length];
        a += p[0] * r[1] - r[0] * p[1];
    }
    return a / 2;
}

function reversePoly(poly) {
    return poly.map((p) => [p[0], p[1]]).reverse();
}

function ensureCCW(poly) {
    return polyArea(poly) < 0 ? reversePoly(poly) : poly.map((p) => [p[0], p[1]]);
}

function dedupe(poly) {
    const out = [];
    for (const p of poly) {
        const last = out[out.length - 1];
        if (last && Math.abs(last[0] - p[0]) < 0.02 && Math.abs(last[1] - p[1]) < 0.02) continue;
        out.push(p);
    }
    if (out.length > 1) {
        const a = out[0];
        const b = out[out.length - 1];
        if (Math.abs(a[0] - b[0]) < 0.02 && Math.abs(a[1] - b[1]) < 0.02) out.pop();
    }
    return out;
}

function cross(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const yi = poly[i][1];
        const yj = poly[j][1];
        if ((yi > p[1]) === (yj > p[1])) continue;
        const x = (poly[j][0] - poly[i][0]) * (p[1] - yi) / (yj - yi) + poly[i][0];
        if (p[0] < x) inside = !inside;
    }
    return inside;
}

function properHit(a, b, c, d) {
    const c1 = cross(a, b, c);
    const c2 = cross(a, b, d);
    const c3 = cross(c, d, a);
    const c4 = cross(c, d, b);
    return c1 * c2 < 0 && c3 * c4 < 0;
}

function edgesHit(a, b, poly, skip) {
    for (let i = 0; i < poly.length; i++) {
        const c = poly[i];
        const d = poly[(i + 1) % poly.length];
        if (skip && (c === skip || d === skip)) continue;
        if (properHit(a, b, c, d)) return true;
    }
    return false;
}

function polysOverlap(a, b) {
    for (let i = 0; i < a.length; i++) {
        const a0 = a[i];
        const a1 = a[(i + 1) % a.length];
        for (let j = 0; j < b.length; j++) {
            if (properHit(a0, a1, b[j], b[(j + 1) % b.length])) return true;
        }
    }
    if (pointInPoly(a[0], b) || pointInPoly(b[0], a)) return true;
    return false;
}

function circle(cx, cy, r, n) {
    const pts = [];
    const seg = n || CIRCLE_N;
    for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        pts.push([q(cx + Math.cos(a) * r), q(cy + Math.sin(a) * r)]);
    }
    return dedupe(pts);
}

function slotPoly(ang, r0, r1, width) {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const px = -dy;
    const py = dx;
    const hw = width / 2;
    return ensureCCW([
        [q(dx * r0 + px * hw), q(dy * r0 + py * hw)],
        [q(dx * r1 + px * hw), q(dy * r1 + py * hw)],
        [q(dx * r1 - px * hw), q(dy * r1 - py * hw)],
        [q(dx * r0 - px * hw), q(dy * r0 - py * hw)],
    ]);
}

function arcBand(a0, a1, rIn, rOut, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const a = a0 + (a1 - a0) * (i / steps);
        pts.push([q(Math.cos(a) * rOut), q(Math.sin(a) * rOut)]);
    }
    for (let i = steps; i >= 0; i--) {
        const a = a0 + (a1 - a0) * (i / steps);
        pts.push([q(Math.cos(a) * rIn), q(Math.sin(a) * rIn)]);
    }
    return ensureCCW(dedupe(pts));
}

function pointInTri(p, a, b, c) {
    const c1 = cross(a, b, p);
    const c2 = cross(b, c, p);
    const c3 = cross(c, a, p);
    return c1 > 1e-8 && c2 > 1e-8 && c3 > 1e-8;
}

function bridgeHole(outer, hole) {
    let mi = 0;
    for (let i = 1; i < hole.length; i++) if (hole[i][0] > hole[mi][0]) mi = i;
    const M = hole[mi];
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < outer.length; i++) {
        const V = outer[i];
        const dx = V[0] - M[0];
        const dy = V[1] - M[1];
        const dist = Math.hypot(dx, dy);
        if (dist < 0.05) continue;
        const mid = [(M[0] + V[0]) / 2, (M[1] + V[1]) / 2];
        if (!pointInPoly(mid, outer)) continue;
        if (pointInPoly(mid, hole)) continue;
        if (edgesHit(M, V, outer)) continue;
        if (edgesHit(M, V, hole)) continue;
        const score = dist + (dx < -0.05 ? 10000 : 0);
        if (score < bestScore) {
            bestScore = score;
            best = i;
        }
    }
    if (best < 0) throw fail('Could not open a pocket in the connector');
    const next = [];
    for (let i = 0; i <= best; i++) next.push(outer[i]);
    for (let k = 0; k <= hole.length; k++) next.push(hole[(mi + k) % hole.length]);
    next.push(outer[best]);
    for (let i = best + 1; i < outer.length; i++) next.push(outer[i]);
    return next;
}

function earClip(poly) {
    let verts = dedupe(poly);
    const tris = [];
    let guard = verts.length * verts.length + 10;
    while (verts.length > 3 && guard-- > 0) {
        let clipped = false;
        for (let i = 0; i < verts.length; i++) {
            const i0 = (i + verts.length - 1) % verts.length;
            const i2 = (i + 1) % verts.length;
            const a = verts[i0];
            const b = verts[i];
            const c = verts[i2];
            const cr = cross(a, b, c);
            // Leave a point that sits on the edge between its neighbours. Deleting it
            // would join the two short sides into one edge and open a seam in the shell.
            if (cr <= 1e-8) continue;
            let blocked = false;
            for (let j = 0; j < verts.length; j++) {
                if (j === i0 || j === i || j === i2) continue;
                if (pointInTri(verts[j], a, b, c)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;
            if (cr / 2 > 1e-6) tris.push([a, b, c]);
            verts.splice(i, 1);
            clipped = true;
            break;
        }
        if (!clipped) throw fail('Could not build a printable face');
    }
    if (guard <= 0) throw fail('Could not build a printable face');
    if (verts.length === 3) {
        const cr = cross(verts[0], verts[1], verts[2]);
        if (cr > 1e-6) tris.push([verts[0], verts[1], verts[2]]);
    }
    return tris;
}

function triangulate(outer, holesCW) {
    let poly = outer.map((p) => [p[0], p[1]]);
    const holes = holesCW.map((h) => h.map((p) => [p[0], p[1]]));
    holes.sort((a, b) => {
        const ax = Math.max(...a.map((p) => p[0]));
        const bx = Math.max(...b.map((p) => p[0]));
        return bx - ax;
    });
    for (const hole of holes) poly = bridgeHole(poly, hole);
    const tris = earClip(poly);
    let got = 0;
    for (const t of tris) got += cross(t[0], t[1], t[2]) / 2;
    const expect = Math.abs(polyArea(outer)) - holesCW.reduce((s, h) => s + Math.abs(polyArea(h)), 0);
    if (Math.abs(got - expect) > Math.max(0.5, Math.abs(expect) * 0.02)) {
        throw fail('A connector face did not close');
    }
    return tris;
}

function triArea3(a, b, c) {
    const ux = b.x - a.x;
    const uy = b.y - a.y;
    const uz = b.z - a.z;
    const vx = c.x - a.x;
    const vy = c.y - a.y;
    const vz = c.z - a.z;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    return 0.5 * Math.hypot(cx, cy, cz);
}

function signedVolume(tris) {
    let v = 0;
    for (const [a, b, c] of tris) {
        v += a.x * (b.y * c.z - b.z * c.y)
            - a.y * (b.x * c.z - b.z * c.x)
            + a.z * (b.x * c.y - b.y * c.x);
    }
    return v / 6;
}

function edgeKey(p, r) {
    const a = p.x + ',' + p.y + ',' + p.z;
    const b = r.x + ',' + r.y + ',' + r.z;
    return a < b ? a + '|' + b : b + '|' + a;
}

function finalize(tris) {
    const clean = [];
    for (const t of tris) {
        const a = { x: q(t[0].x), y: q(t[0].y), z: q(t[0].z) };
        const b = { x: q(t[1].x), y: q(t[1].y), z: q(t[1].z) };
        const c = { x: q(t[2].x), y: q(t[2].y), z: q(t[2].z) };
        if (triArea3(a, b, c) < 1e-6) continue;
        clean.push([a, b, c]);
    }
    if (signedVolume(clean) < 0) {
        for (const t of clean) {
            const swap = t[1];
            t[1] = t[2];
            t[2] = swap;
        }
    }
    return clean;
}

function meshStats(tris) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    const edges = new Map();
    let area = 0;
    for (const [a, b, c] of tris) {
        for (const p of [a, b, c]) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.z < minZ) minZ = p.z;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
            if (p.z > maxZ) maxZ = p.z;
        }
        area += triArea3(a, b, c);
        for (const pair of [[a, b], [b, c], [c, a]]) {
            const k = edgeKey(pair[0], pair[1]);
            edges.set(k, (edges.get(k) || 0) + 1);
        }
    }
    let bad = 0;
    for (const n of edges.values()) if (n !== 2) bad++;
    return {
        triangles: tris.length,
        volume: signedVolume(tris),
        area,
        watertight: bad === 0 && tris.length > 0,
        badEdges: bad,
        bbox: { minX, minY, minZ, maxX, maxY, maxZ },
        size: { x: round1(maxX - minX), y: round1(maxY - minY), z: round1(maxZ - minZ) },
    };
}

// poly is CCW from above. Normals point to the right of each edge, out of the solid.
function wall(poly, z0, z1) {
    const tris = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i];
        const r = poly[(i + 1) % poly.length];
        const a = { x: p[0], y: p[1], z: z0 };
        const b = { x: r[0], y: r[1], z: z0 };
        const c = { x: r[0], y: r[1], z: z1 };
        const d = { x: p[0], y: p[1], z: z1 };
        tris.push([a, b, c], [a, c, d]);
    }
    return tris;
}

function cap(outerCCW, holesCCW, z, up) {
    const holesCW = holesCCW.map((h) => (polyArea(h) > 0 ? reversePoly(h) : h));
    const tris2 = triangulate(outerCCW, holesCW);
    return tris2.map((t) => {
        const A = { x: t[0][0], y: t[0][1], z };
        const B = { x: t[1][0], y: t[1][1], z };
        const C = { x: t[2][0], y: t[2][1], z };
        return up ? [A, B, C] : [A, C, B];
    });
}

function solidWithPockets({ outer, throughHoles, pockets, z0, z1 }) {
    const shell = ensureCCW(outer);
    const holes = (throughHoles || []).map((h) => ensureCCW(h));
    const pots = (pockets || []).map((p) => ({
        poly: ensureCCW(p.poly),
        floorZ: p.floorZ,
        holes: (p.holes || []).map((h) => ensureCCW(h)),
    }));
    for (const p of pots) {
        if (p.floorZ <= z0 + 0.2 || p.floorZ >= z1 - 0.2) {
            throw fail('A pocket in the connector has no floor to print on');
        }
    }
    const tris = [];
    const bottomHoles = holes.concat(pots.flatMap((p) => p.holes));
    tris.push(...cap(shell, bottomHoles, z0, false));
    const topHoles = pots.map((p) => p.poly);
    for (const h of holes) {
        const c = centroid(h);
        if (!pots.some((p) => pointInPoly(c, p.poly))) topHoles.push(h);
    }
    tris.push(...cap(shell, topHoles, z1, true));
    tris.push(...wall(shell, z0, z1));
    for (const p of pots) {
        tris.push(...cap(p.poly, p.holes, p.floorZ, true));
        tris.push(...wall(reversePoly(p.poly), p.floorZ, z1));
        for (const h of p.holes) tris.push(...wall(reversePoly(h), z0, p.floorZ));
    }
    for (const h of holes) {
        const c = centroid(h);
        if (pots.some((p) => pointInPoly(c, p.poly))) continue;
        tris.push(...wall(reversePoly(h), z0, z1));
    }
    return finalize(tris);
}

function centroid(poly) {
    let x = 0;
    let y = 0;
    for (const p of poly) {
        x += p[0];
        y += p[1];
    }
    return [x / poly.length, y / poly.length];
}

function writeStl(tris) {
    const buf = Buffer.alloc(84 + tris.length * 50);
    buf.write('octopus ladder', 0, 'ascii');
    buf.writeUInt32LE(tris.length, 80);
    let o = 84;
    for (const [a, b, c] of tris) {
        const ux = b.x - a.x;
        const uy = b.y - a.y;
        const uz = b.z - a.z;
        const vx = c.x - a.x;
        const vy = c.y - a.y;
        const vz = c.z - a.z;
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz) || 1;
        buf.writeFloatLE(nx / len, o); o += 4;
        buf.writeFloatLE(ny / len, o); o += 4;
        buf.writeFloatLE(nz / len, o); o += 4;
        for (const p of [a, b, c]) {
            buf.writeFloatLE(p.x, o); o += 4;
            buf.writeFloatLE(p.y, o); o += 4;
            buf.writeFloatLE(p.z, o); o += 4;
        }
        buf.writeUInt16LE(0, o); o += 2;
    }
    return buf;
}

function revolve(levels, n) {
    function ring(r, z) {
        if (r <= 0.001) return [{ x: 0, y: 0, z: q(z) }];
        const pts = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            pts.push({ x: q(Math.cos(a) * r), y: q(Math.sin(a) * r), z: q(z) });
        }
        return pts;
    }
    const rings = levels.map(([r, z]) => ring(r, z));
    const tris = [];
    function connect(A, B) {
        if (A.length === 1) {
            for (let k = 0; k < B.length; k++) tris.push([A[0], B[k], B[(k + 1) % B.length]]);
        } else if (B.length === 1) {
            for (let k = 0; k < A.length; k++) tris.push([B[0], A[(k + 1) % A.length], A[k]]);
        } else {
            for (let k = 0; k < A.length; k++) {
                const k2 = (k + 1) % A.length;
                tris.push([A[k], A[k2], B[k2]], [A[k], B[k2], B[k]]);
            }
        }
    }
    for (let i = 0; i < rings.length - 1; i++) connect(rings[i], rings[i + 1]);
    return finalize(tris);
}

function pinMesh(spec) {
    const headR = spec.headR;
    const shaft = spec.shaftLen;
    return revolve([
        [0, 0],
        [headR, 0],
        [headR, PIN_HEAD_H],
        [PIN_SHAFT_R, PIN_HEAD_H],
        [PIN_SHAFT_R, PIN_HEAD_H + shaft],
        [0, PIN_HEAD_H + shaft],
    ], 20);
}

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
    const parts = [];
    const centrals = [];
    let offset = 0;
    for (const f of files) {
        const name = Buffer.from(f.name, 'utf8');
        const crc = crc32(f.data);
        const local = Buffer.alloc(30 + name.length);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 8);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(f.data.length, 18);
        local.writeUInt32LE(f.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        name.copy(local, 30);
        parts.push(local, f.data);
        const central = Buffer.alloc(46 + name.length);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(f.data.length, 20);
        central.writeUInt32LE(f.data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        name.copy(central, 46);
        centrals.push(central);
        offset += local.length + f.data.length;
    }
    const centralBuf = Buffer.concat(centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat(parts.concat([centralBuf, end]));
}

function portIndex(dx, dy, ports) {
    let deg = Math.atan2(dy, dx) * 180 / Math.PI;
    if (deg < 0) deg += 360;
    const step = 360 / ports;
    let k = Math.round(deg / step);
    if (k === ports) k = 0;
    if (k < 0) k += ports;
    let err = Math.abs(deg - k * step);
    if (err > 180) err = 360 - err;
    if (err > step * 0.25 + 1e-6) throw fail('That angle is not on the socket grid');
    return k % ports;
}

function materialOk(kind) {
    return kind === 'cord' || kind === 'stick' || kind === 'dowel';
}

function normalize(input) {
    const src = input && typeof input === 'object' ? input : {};
    const messages = [];
    const printerId = src.printer === 'a1' || src.printer === 'custom' ? src.printer : 'a1-mini';
    let bed = PRINTERS[printerId] ? PRINTERS[printerId].bed : clamp(src.bed, 120, 350, 180);
    if (printerId === 'custom') bed = clamp(src.bed, 120, 350, 180);
    const printerName = PRINTERS[printerId] ? PRINTERS[printerId].name : 'Custom printer';
    const maxPart = round1(bed - MARGIN);
    const rails = materialOk(src.rails) ? src.rails : 'cord';
    const rungs = materialOk(src.rungs) ? src.rungs : 'stick';
    const width = clamp(src.width, 120, 800, 450);
    const spacing = clamp(src.spacing, 150, 800, 400);
    let grip = clamp(src.grip, 16, 60, 32);
    const cord = clamp(src.cord, 2, 8, 4);
    const stickW = clamp(src.stickW, 8, 25, 12);
    const stickH = clamp(src.stickH, 4, 15, 6);
    const dowel = clamp(src.dowel, 8, 30, 16);
    let runs = Array.isArray(src.runs) ? src.runs.slice(0, 8) : null;
    if (!runs || !runs.length) runs = [{ squares: 4, turn: 0 }];
    runs = runs.map((run) => {
        const turn = Number(run && run.turn) || 0;
        if (![0, 45, -45, 90, -90].includes(turn)) throw fail('Turns are 45 or 90 degrees');
        return { squares: clamp(run && run.squares, 1, 20, 1), turn };
    });
    runs[runs.length - 1].turn = 0;
    const needs8 = runs.some((run) => Math.abs(run.turn) === 45);
    let ports = src.ports === 4 || src.ports === 8 || src.ports === '4' || src.ports === '8' ? Number(src.ports) : (needs8 ? 8 : 4);
    let portsNote = '';
    if (needs8 && ports === 4) {
        ports = 8;
        portsNote = 'A 45° turn needs 8 sockets, so the connectors use 8.';
        messages.push(portsNote);
    } else if (needs8) {
        portsNote = '8 sockets, so the ladder can turn 45°.';
    } else if (ports === 8) {
        portsNote = '8 sockets. A straight ladder can use 4, which are smaller.';
    } else {
        portsNote = '4 sockets. Enough for straight runs and 90° turns.';
    }

    const barKinds = [rails, rungs].filter((k) => k === 'stick' || k === 'dowel');
    let pocketHalf = 0;
    for (const kind of barKinds) {
        const w = kind === 'stick' ? stickW + 2 * CLEARANCE : dowel + 0.8;
        pocketHalf = Math.max(pocketHalf, w / 2);
    }
    const step = Math.PI * 2 / ports;
    let hubR = 14;
    if (pocketHalf > 0) {
        hubR = Math.max(14, (pocketHalf + POCKET_GAP) / Math.sin(step / 2));
    }
    hubR = Math.ceil(hubR * 10) / 10;
    for (let widen = 0; widen < 8 && pocketHalf > 0; widen++) {
        const sample = [];
        for (let i = 0; i < ports; i++) {
            sample.push(slotPoly(i * step, hubR, hubR + grip, pocketHalf * 2));
        }
        let hit = false;
        for (let i = 0; i < sample.length && !hit; i++) {
            if (polysOverlap(sample[i], sample[(i + 1) % sample.length])) hit = true;
        }
        if (!hit) break;
        hubR = round1(hubR + 2);
    }

    let lip = LIP;
    let gripUsed = grip;
    let gripClamped = false;
    for (let iter = 0; iter < 12; iter++) {
        lip = LIP;
        if (pocketHalf > 0) {
            while (Math.hypot(hubR + gripUsed, pocketHalf) > hubR + gripUsed + lip - 0.8 && lip < 12) {
                lip = round1(lip + 0.2);
            }
        }
        const outer = hubR + gripUsed + lip;
        const dia = outer * 2;
        const joinerLen = rails === 'stick' || rungs === 'stick' ? 2 * gripUsed + MID_WALL : 0;
        if (dia <= maxPart + 0.05 && joinerLen <= maxPart + 0.05) break;
        const byDia = maxPart / 2 - hubR - lip;
        const byJoiner = joinerLen ? (maxPart - MID_WALL) / 2 : gripUsed;
        const next = Math.floor(Math.min(gripUsed - 0.1, byDia, byJoiner) * 10) / 10;
        if (!(next >= 16)) {
            throw fail('The connector cannot fit this bed. Use a wider bed or a thinner bar.');
        }
        if (!gripClamped) {
            gripClamped = true;
        }
        gripUsed = next;
    }
    if (gripClamped) {
        messages.push('Shortened the grip to ' + gripUsed + ' mm so the connector fits the bed.');
    }
    lip = round1(lip);
    const outerR = round1(hubR + gripUsed + lip);
    const diameter = round1(outerR * 2);
    if (diameter > maxPart + 0.05) throw fail('The connector cannot fit this bed. Use a wider bed or a thinner bar.');

    const holeRad = round1((cord + CORD_CLEAR) / 2 * 10) / 10;
    let wellR = round1(Math.min(cord * 1.6, 12));
    let cordRH = round1(outerR - 1.2 - wellR);
    if (cordRH - wellR < hubR + 4) {
        wellR = round1(Math.max(holeRad + 1.5, (outerR - 1.2 - hubR - 4) / 2));
        cordRH = round1(outerR - 1.2 - wellR);
    }
    const barH = Math.max(rails === 'stick' ? stickH : 0, rungs === 'stick' ? stickH : 0, rails === 'dowel' ? dowel : 0, rungs === 'dowel' ? dowel : 0);
    const H = round1(Math.max(barH + FLOOR_MIN, WELL_DEPTH + FLOOR_MIN, 10));
    const grooveDepth = Math.min(Math.max(cord + 1.5, 4), H - FLOOR_MIN);
    const headR = round1(Math.min(4, (stickW - 2.2) / 2));
    const shaftLen = round1(H - PIN_HEAD_H);
    const gripRequested = grip;

    const spec = {
        printer: printerId,
        printerName,
        bed,
        maxPart,
        rails,
        rungs,
        width,
        spacing,
        gripRequested,
        gripUsed,
        gripClamped,
        cord,
        stickW,
        stickH,
        dowel,
        ports,
        portsNote,
        runs,
        hubR,
        lip,
        outerR,
        diameter,
        H,
        holeRad,
        wellR,
        cordRH,
        grooveDepth,
        headR,
        cbR: round1(headR + 0.3),
        shaftLen,
        messages,
        warnings: [],
    };
    spec.messages.unshift(
        'Connector is ' + diameter + ' mm across. The ' + printerName + ' bed is ' + bed + ' mm, so the connector fits.',
        'Each bar ends ' + gripUsed + ' mm inside the connector.'
    );
    return spec;
}

function cornerLead(spec, turnDeg) {
    const theta = Math.abs(turnDeg) * Math.PI / 180;
    const d = (spec.width / 2) * Math.tan(theta / 2);
    const minDist = 2 * spec.hubR + 2 * spec.gripUsed + 8;
    return Math.min(700, Math.max(180, d + minDist));
}

function layout(spec) {
    const stations = [];
    let x = 0;
    let y = 0;
    let ang = 0;
    spec.runs.forEach((run, ri) => {
        for (let k = 0; k <= run.squares; k++) {
            stations.push({ x, y, ang, kind: 'rung' });
            if (k < run.squares) {
                x += Math.cos(ang) * spec.spacing;
                y += Math.sin(ang) * spec.spacing;
            }
        }
        if (ri === spec.runs.length - 1 || !run.turn) return;
        const lead = cornerLead(spec, run.turn);
        x += Math.cos(ang) * lead;
        y += Math.sin(ang) * lead;
        stations.push({ x, y, ang, kind: 'bend', turn: run.turn });
        ang += run.turn * Math.PI / 180;
        x += Math.cos(ang) * lead;
        y += Math.sin(ang) * lead;
    });

    function railPoint(st, side) {
        if (st.kind === 'rung') {
            const nx = -Math.sin(st.ang);
            const ny = Math.cos(st.ang);
            return { x: st.x + side * nx * spec.width / 2, y: st.y + side * ny * spec.width / 2 };
        }
        const angIn = st.ang;
        const angOut = st.ang + st.turn * Math.PI / 180;
        const nIn = { x: -Math.sin(angIn), y: Math.cos(angIn) };
        const nOut = { x: -Math.sin(angOut), y: Math.cos(angOut) };
        const pIn = { x: st.x + side * nIn.x * spec.width / 2, y: st.y + side * nIn.y * spec.width / 2 };
        const pOut = { x: st.x + side * nOut.x * spec.width / 2, y: st.y + side * nOut.y * spec.width / 2 };
        const dIn = { x: Math.cos(angIn), y: Math.sin(angIn) };
        const dOut = { x: Math.cos(angOut), y: Math.sin(angOut) };
        const det = dIn.x * dOut.y - dIn.y * dOut.x;
        if (Math.abs(det) < 1e-9) return pIn;
        const dx = pOut.x - pIn.x;
        const dy = pOut.y - pIn.y;
        const t = (dx * dOut.y - dy * dOut.x) / det;
        return { x: pIn.x + dIn.x * t, y: pIn.y + dIn.y * t };
    }

    const couplers = [];
    for (let i = 0; i < stations.length; i++) {
        for (const side of [1, -1]) {
            const pt = railPoint(stations[i], side);
            couplers.push({
                station: i,
                side,
                x: pt.x,
                y: pt.y,
                kind: stations[i].kind,
                ports: [],
            });
        }
    }
    function at(station, side) {
        return couplers[station * 2 + (side === 1 ? 0 : 1)];
    }
    function addPort(coupler, other, kind, end) {
        const idx = portIndex(other.x - coupler.x, other.y - coupler.y, spec.ports);
        if (coupler.ports.some((p) => p.index === idx)) {
            throw fail('Two bars landed on the same socket. Widen the ladder or use a gentler turn.');
        }
        coupler.ports.push({ index: idx, kind, end: !!end });
    }
    for (const side of [1, -1]) {
        const row = [];
        for (let i = 0; i < stations.length; i++) row.push(at(i, side));
        for (let i = 0; i < row.length - 1; i++) {
            addPort(row[i], row[i + 1], spec.rails, false);
            addPort(row[i + 1], row[i], spec.rails, false);
        }
        for (const c of row) {
            const rails = c.ports.filter((p) => p.kind === spec.rails);
            if (spec.rails === 'cord' && rails.length === 1) rails[0].end = true;
        }
    }
    for (let i = 0; i < stations.length; i++) {
        if (stations[i].kind !== 'rung') continue;
        const left = at(i, 1);
        const right = at(i, -1);
        addPort(left, right, spec.rungs, false);
        addPort(right, left, spec.rungs, false);
    }

    const spans = [];
    function pushSpan(a, b, kind, role) {
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const length = round1(dist - 2 * spec.hubR);
        spans.push({ role, kind, length, dist: round1(dist) });
    }
    for (const side of [1, -1]) {
        for (let i = 0; i < stations.length - 1; i++) {
            pushSpan(at(i, side), at(i + 1, side), spec.rails, 'rail');
        }
    }
    for (let i = 0; i < stations.length; i++) {
        if (stations[i].kind !== 'rung') continue;
        pushSpan(at(i, 1), at(i, -1), spec.rungs, 'rung');
    }
    return { stations, couplers, spans };
}

function splitSpan(length, grip, maxPart) {
    if (!(length >= 2 * grip - 0.05)) return { ok: false, length };
    if (length <= maxPart + 0.05) return { ok: true, n: 1, seg: round1(length), joiners: 0 };
    for (let n = 2; n <= 12; n++) {
        const raw = (length - (n - 1) * MID_WALL) / n;
        const seg = Math.floor(raw * 10) / 10;
        if (seg <= maxPart + 0.001 && seg + 0.05 >= 2 * grip) {
            return { ok: true, n, seg, joiners: n - 1 };
        }
    }
    return { ok: false, length };
}

function orientPorts(ports, portCount) {
    let best = null;
    for (let rot = 0; rot < portCount; rot++) {
        const rotated = ports.map((p) => ({
            index: (p.index - rot + portCount * 4) % portCount,
            kind: p.kind,
            end: !!p.end,
        })).sort((a, b) => a.index - b.index || (a.end === b.end ? a.kind.localeCompare(b.kind) : (a.end ? 1 : -1)));
        const key = rotated.map((p) => p.index + ':' + p.kind + (p.end ? ':end' : '')).join('|');
        if (!best || key < best.key) best = { key, ports: rotated };
    }
    return best;
}

function avoidSweep(a0, a1, blocked) {
    const tau = Math.PI * 2;
    function hits(start, sweep) {
        return blocked.some((a) => {
            const t = (a - start + tau * 4) % tau;
            return t > 0.08 && t < sweep - 0.08;
        });
    }
    const s1 = (a1 - a0 + tau) % tau;
    const s2 = (a0 - a1 + tau) % tau;
    if (!hits(a0, s1)) return [a0, a0 + s1];
    return [a1, a1 + s2];
}

function sampleInside(poly, cx, cy, r) {
    if (!pointInPoly([cx, cy], poly)) return false;
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        if (!pointInPoly([cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92], poly)) return false;
    }
    return true;
}

function couplerMesh(spec, ports) {
    const step = Math.PI * 2 / spec.ports;
    const outer = circle(0, 0, spec.outerR, 40);
    const pockets = [];
    const through = [];
    const cordPorts = ports.filter((p) => p.kind === 'cord');
    const barPorts = ports.filter((p) => p.kind !== 'cord');
    for (const p of barPorts) {
        const ang = p.index * step;
        if (p.kind === 'stick') {
            const width = spec.stickW + 2 * CLEARANCE;
            const poly = slotPoly(ang, spec.hubR, spec.hubR + spec.gripUsed, width);
            const hr = spec.hubR + 0.55 * spec.gripUsed;
            const hole = circle(Math.cos(ang) * hr, Math.sin(ang) * hr, PIN_HOLE_R, HOLE_N);
            if (!sampleInside(poly, Math.cos(ang) * hr, Math.sin(ang) * hr, PIN_HOLE_R)) {
                throw fail('The pin hole does not fit the bar slot');
            }
            pockets.push({ poly, floorZ: q(spec.H - spec.stickH), holes: [hole] });
        } else {
            const width = spec.dowel + 0.8;
            const poly = slotPoly(ang, spec.hubR, spec.hubR + spec.gripUsed, width);
            pockets.push({ poly, floorZ: q(spec.H - spec.dowel), holes: [] });
            const midR = spec.hubR + spec.gripUsed * 0.45;
            const off = width / 2 + PIN_HOLE_R + 1.3;
            for (const s of [-1, 1]) {
                const cx = Math.cos(ang) * midR + Math.cos(ang + Math.PI / 2) * off * s;
                const cy = Math.sin(ang) * midR + Math.sin(ang + Math.PI / 2) * off * s;
                if (Math.hypot(cx, cy) + PIN_HOLE_R > spec.outerR - 0.8) {
                    throw fail('The zip-tie hole does not fit the connector');
                }
                through.push(circle(cx, cy, PIN_HOLE_R, HOLE_N));
            }
        }
    }
    if (cordPorts.length === 1) {
        const ang = cordPorts[0].index * step;
        const cx = Math.cos(ang) * spec.cordRH;
        const cy = Math.sin(ang) * spec.cordRH;
        const poly = circle(cx, cy, spec.wellR, 24);
        const hole = circle(cx, cy, spec.holeRad, HOLE_N);
        if (!sampleInside(poly, cx, cy, spec.holeRad) || !sampleInside(outer, cx, cy, spec.wellR)) {
            throw fail('The knot cup does not fit the connector');
        }
        pockets.push({ poly, floorZ: q(spec.H - Math.min(WELL_DEPTH, spec.H - FLOOR_MIN)), holes: [hole] });
    } else if (cordPorts.length >= 2) {
        const angles = cordPorts.map((p) => p.index * step);
        const blocked = barPorts.map((p) => p.index * step);
        const sweep = avoidSweep(angles[0], angles[1], blocked);
        const pad = Math.asin(Math.min(0.95, (spec.holeRad + 0.9) / spec.cordRH));
        const a0 = sweep[0] - pad;
        const a1 = sweep[1] + pad;
        const rOut = Math.min(spec.outerR - 1.1, spec.cordRH + spec.holeRad + 1.1);
        const rIn = Math.max(spec.hubR + 2, spec.cordRH - spec.holeRad - 1.1);
        const steps = Math.max(4, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 10)));
        const band = arcBand(a0, a1, rIn, rOut, steps);
        const holes = [];
        for (const ang of angles) {
            const cx = Math.cos(ang) * spec.cordRH;
            const cy = Math.sin(ang) * spec.cordRH;
            if (!sampleInside(band, cx, cy, spec.holeRad)) throw fail('The paracord hole does not fit the connector');
            holes.push(circle(cx, cy, spec.holeRad, HOLE_N));
        }
        for (const bar of pockets) {
            if (polysOverlap(band, bar.poly)) throw fail('The paracord path crosses a bar slot. Use a narrower bar.');
        }
        pockets.push({ poly: band, floorZ: q(spec.H - spec.grooveDepth), holes });
    }
    for (let i = 0; i < pockets.length; i++) {
        for (let j = i + 1; j < pockets.length; j++) {
            if (polysOverlap(pockets[i].poly, pockets[j].poly)) {
                throw fail('Two sockets overlap. Use a thinner bar or a gentler turn.');
            }
        }
    }
    return solidWithPockets({ outer, throughHoles: through, pockets, z0: 0, z1: spec.H });
}

function barMesh(spec, length) {
    const x0 = q(-length / 2);
    const x1 = q(length / 2);
    const y0 = q(-spec.stickW / 2);
    const y1 = q(spec.stickW / 2);
    const fromEnd = q(0.55 * spec.gripUsed);
    const depth = q(Math.min(PIN_HEAD_H + 0.2, spec.stickH - 1.6));
    const pockets = [-1, 1].map((s) => {
        const cx = s < 0 ? x0 + fromEnd : x1 - fromEnd;
        return {
            poly: circle(cx, 0, spec.cbR, HOLE_N),
            floorZ: q(spec.stickH - depth),
            holes: [circle(cx, 0, PIN_HOLE_R, HOLE_N)],
        };
    });
    return solidWithPockets({
        outer: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
        throughHoles: [],
        pockets,
        z0: 0,
        z1: spec.stickH,
    });
}

function quad(tris, a, b, c, d) {
    tris.push([a, b, c], [a, c, d]);
}

function joinerMesh(spec) {
    const grip = spec.gripUsed;
    const mid = MID_WALL;
    const Lh = grip + mid / 2;
    const channel = spec.stickW + 2 * CLEARANCE;
    const c = channel / 2;
    const Wh = c + WALL_T;
    const H = spec.H;
    const zf = q(H - spec.stickH);
    const x0 = q(-Lh);
    const x1 = q(-mid / 2);
    const x2 = q(mid / 2);
    const x3 = q(Lh);
    const y0 = q(-Wh);
    const y1 = q(-c);
    const y2 = q(c);
    const y3 = q(Wh);
    const holeAt = q(0.55 * grip);
    const holes = [
        circle(q(x1 - holeAt), 0, PIN_HOLE_R, HOLE_N),
        circle(q(x2 + holeAt), 0, PIN_HOLE_R, HOLE_N),
    ];
    const tris = [];
    // Underside and tops are split on the same x and y lines as the channel,
    // so every seam is one shared edge. The pin holes sit only in the two pockets.
    function downRect(xa, xb, ya, yb) {
        quad(tris,
            { x: xa, y: ya, z: 0 },
            { x: xa, y: yb, z: 0 },
            { x: xb, y: yb, z: 0 },
            { x: xb, y: ya, z: 0 });
    }
    for (const [xa, xb] of [[x0, x1], [x1, x2], [x2, x3]]) {
        downRect(xa, xb, y0, y1);
        downRect(xa, xb, y2, y3);
    }
    downRect(x1, x2, y1, y2);
    const leftPocket = [[x0, y1], [x1, y1], [x1, y2], [x0, y2]];
    const rightPocket = [[x2, y1], [x3, y1], [x3, y2], [x2, y2]];
    tris.push(...cap(leftPocket, [holes[0]], 0, false));
    tris.push(...cap(rightPocket, [holes[1]], 0, false));
    tris.push(...cap(leftPocket, [holes[0]], zf, true));
    tris.push(...cap(rightPocket, [holes[1]], zf, true));
    tris.push(...wall(reversePoly(holes[0]), 0, zf));
    tris.push(...wall(reversePoly(holes[1]), 0, zf));
    function upRect(xa, xb, ya, yb) {
        quad(tris,
            { x: xa, y: ya, z: H },
            { x: xb, y: ya, z: H },
            { x: xb, y: yb, z: H },
            { x: xa, y: yb, z: H });
    }
    for (const [xa, xb] of [[x0, x1], [x1, x2], [x2, x3]]) {
        upRect(xa, xb, y0, y1);
        upRect(xa, xb, y2, y3);
    }
    upRect(x1, x2, y1, y2);
    function fx(x, ya, yb, za, zb, pos) {
        const a = { x, y: ya, z: za };
        const b = { x, y: yb, z: za };
        const c = { x, y: yb, z: zb };
        const d = { x, y: ya, z: zb };
        if (pos) quad(tris, a, b, c, d);
        else quad(tris, a, d, c, b);
    }
    function fy(y, xa, xb, za, zb, pos) {
        const a = { x: xa, y, z: za };
        const b = { x: xb, y, z: za };
        const c = { x: xb, y, z: zb };
        const d = { x: xa, y, z: zb };
        if (pos) quad(tris, a, d, c, b);
        else quad(tris, a, b, c, d);
    }
    for (const [za, zb] of [[0, zf], [zf, H]]) {
        for (const [xa, xb] of [[x0, x1], [x1, x2], [x2, x3]]) {
            fy(y0, xa, xb, za, zb, false);
            fy(y3, xa, xb, za, zb, true);
        }
    }
    for (const x of [x0, x3]) {
        const pos = x === x3;
        for (const [ya, yb] of [[y0, y1], [y1, y2], [y2, y3]]) fx(x, ya, yb, 0, zf, pos);
        fx(x, y0, y1, zf, H, pos);
        fx(x, y2, y3, zf, H, pos);
    }
    fy(y1, x0, x1, zf, H, true);
    fy(y1, x2, x3, zf, H, true);
    fy(y2, x0, x1, zf, H, false);
    fy(y2, x2, x3, zf, H, false);
    fx(x1, y1, y2, zf, H, false);
    fx(x2, y1, y2, zf, H, true);
    return finalize(tris);
}

function sizeText(stats) {
    return stats.size.x + ' × ' + stats.size.y + ' × ' + stats.size.z + ' mm';
}

function fitsBed(stats, maxPart) {
    return stats.size.x <= maxPart + 0.05 && stats.size.y <= maxPart + 0.05 && stats.size.z <= maxPart + 0.05;
}

function groupSpans(spec, spans) {
    const groups = [];
    for (const span of spans) {
        if (span.kind === 'cord') continue;
        const split = span.kind === 'stick' ? splitSpan(span.length, spec.gripUsed, spec.maxPart) : { ok: span.length >= 2 * spec.gripUsed - 0.05, n: 1, seg: span.length, joiners: 0, cut: true };
        if (!split.ok) {
            spec.warnings.push('One ' + span.role + ' is ' + span.length + ' mm between connectors, too short to seat. Widen that part of the ladder.');
            continue;
        }
        const key = span.role + '|' + span.kind + '|' + (split.seg || span.length) + '|' + split.n;
        let g = groups.find((row) => row.key === key);
        if (!g) {
            g = { key, role: span.role, kind: span.kind, full: span.length, n: split.n, seg: split.seg || span.length, joiners: split.joiners || 0, count: 0 };
            groups.push(g);
        }
        g.count++;
    }
    return groups;
}

function feetText(mm) {
    const inches = mm / 25.4;
    const ft = Math.floor(inches / 12);
    const inch = Math.round(inches - ft * 12);
    if (inch === 12) return (ft + 1) + ' ft 0 in';
    return ft + ' ft ' + inch + ' in';
}

function cordLength(spec, spans) {
    let mm = 0;
    let rails = 0;
    const sides = new Set();
    for (const span of spans) {
        if (span.kind !== 'cord' || span.role !== 'rail') continue;
        mm += span.dist;
        rails++;
    }
    if (!rails) return null;
    // Two knot tails on each rail. A ladder has two rails.
    const railCount = spec.rungs === 'cord' ? 2 : 2;
    mm += railCount * 2 * 120;
    if (spec.rungs === 'cord') {
        for (const span of spans) if (span.kind === 'cord' && span.role === 'rung') mm += span.dist + 240;
    }
    mm = Math.round(mm);
    return { mm, text: feetText(mm), rails: railCount };
}

function describe(spec, lay) {
    const groups = groupSpans(spec, lay.spans);
    const lines = spec.messages.slice();
    const rungGroups = groups.filter((g) => g.role === 'rung');
    const railGroups = groups.filter((g) => g.role === 'rail');
    let rungLine = '';
    let railLine = '';
    let dowelLine = '';
    if (spec.rungs === 'cord') {
        rungLine = 'Rungs are paracord too. They run across, under the stepping lane.';
    } else if (spec.rungs === 'dowel') {
        const bits = rungGroups.map((g) => g.count + ' dowels, ' + g.full + ' mm');
        rungLine = 'Cut ' + (bits.join(', ') || 'the dowels') + '. The dowel sits in a square channel and is held with a zip tie.';
        dowelLine = rungLine;
    } else if (rungGroups.length) {
        rungLine = rungGroups.map((g) => {
            if (g.n === 1) return 'Each rung is ' + g.seg + ' mm and prints as one piece.';
            return 'Each rung is ' + g.full + ' mm, printed as ' + g.n + ' pieces of ' + g.seg + ' mm with ' + g.joiners + ' joiners.';
        }).join(' ');
    }
    if (spec.rails === 'cord') {
        railLine = 'Rails are paracord, so nothing long has to fit on the bed.';
    } else if (spec.rails === 'dowel') {
        const bits = railGroups.map((g) => g.count + ' dowels, ' + g.full + ' mm');
        railLine = 'Cut rail dowels: ' + (bits.join(', ') || 'none') + '. Each sits in a square channel and is held with a zip tie.';
    } else if (railGroups.length) {
        railLine = railGroups.map((g) => {
            if (g.n === 1) return 'Each rail bar is ' + g.seg + ' mm and prints as one piece.';
            return 'Each rail bar is ' + g.full + ' mm, printed as ' + g.n + ' pieces of ' + g.seg + ' mm with ' + g.joiners + ' joiners.';
        }).join(' ');
    }
    if (rungLine) lines.push(rungLine);
    if (railLine) lines.push(railLine);
    const cord = cordLength(spec, lay.spans);
    let cordLine = '';
    if (cord && spec.rails === 'cord') {
        cordLine = 'Paracord for both rails is about ' + cord.mm + ' mm (' + cord.text + '), including knot tails.';
        lines.push(cordLine);
    }
    if (spec.warnings.length) lines.push(spec.warnings[0]);
    const couplerCount = lay.couplers.length;
    let pinSockets = 0;
    let joinerCount = 0;
    for (const g of groups) {
        if (g.kind !== 'stick') continue;
        joinerCount += g.count * g.joiners;
        pinSockets += g.count * 2;
        pinSockets += g.count * g.joiners * 2;
    }
    return {
        ok: true,
        messages: spec.messages.slice(),
        warnings: spec.warnings.slice(),
        lines,
        printer: { id: spec.printer, name: spec.printerName, bed: spec.bed, maxPart: spec.maxPart },
        rails: spec.rails,
        rungs: spec.rungs,
        ports: spec.ports,
        portsNote: spec.portsNote,
        lockPorts: spec.runs.some((run) => Math.abs(run.turn) === 45),
        gripRequested: spec.gripRequested,
        gripUsed: spec.gripUsed,
        gripClamped: spec.gripClamped,
        hubR: spec.hubR,
        diameter: spec.diameter,
        height: spec.H,
        width: spec.width,
        spacing: spec.spacing,
        fitLine: spec.messages[0],
        gripLine: spec.messages[1],
        rungLine,
        railLine,
        cordLine,
        dowelLine,
        counts: {
            couplers: couplerCount,
            pins: pinSockets,
            joiners: joinerCount,
            rungPieces: rungGroups.filter((g) => g.kind === 'stick').reduce((s, g) => s + g.count * g.n, 0),
            railPieces: railGroups.filter((g) => g.kind === 'stick').reduce((s, g) => s + g.count * g.n, 0),
        },
        groups,
        cord,
        runs: spec.runs.map((run) => ({ squares: run.squares, turn: run.turn })),
    };
}

function svgFor(spec, lay) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of lay.couplers) {
        minX = Math.min(minX, c.x - spec.outerR);
        minY = Math.min(minY, c.y - spec.outerR);
        maxX = Math.max(maxX, c.x + spec.outerR);
        maxY = Math.max(maxY, c.y + spec.outerR);
    }
    const pad = 20;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    const stroke = Math.max(3, spec.width / 90);
    const parts = [];
    parts.push('<g transform="scale(1,-1)">');
    parts.push('<rect x="' + minX + '" y="' + minY + '" width="' + (maxX - minX) + '" height="' + (maxY - minY) + '" fill="#0e0e0e"/>');
    const byStation = new Map();
    for (const c of lay.couplers) {
        if (!byStation.has(c.station)) byStation.set(c.station, []);
        byStation.get(c.station).push(c);
    }
    const sides = { 1: [], '-1': [] };
    for (const c of lay.couplers) sides[c.side].push(c);
    for (const side of [1, -1]) {
        const row = sides[side];
        let d = '';
        for (let i = 0; i < row.length; i++) {
            d += (i ? ' L ' : 'M ') + round1(row[i].x) + ' ' + round1(row[i].y);
        }
        const dash = spec.rails === 'cord' ? ' stroke-dasharray="12 8"' : '';
        parts.push('<path d="' + d + '" fill="none" stroke="#d8d8d8" stroke-width="' + stroke + '" stroke-linecap="round" stroke-linejoin="round"' + dash + '/>');
    }
    for (const pair of byStation.values()) {
        if (pair.length < 2 || lay.stations[pair[0].station].kind !== 'rung') continue;
        const dash = spec.rungs === 'cord' ? ' stroke-dasharray="8 6"' : '';
        parts.push('<line x1="' + round1(pair[0].x) + '" y1="' + round1(pair[0].y) + '" x2="' + round1(pair[1].x) + '" y2="' + round1(pair[1].y) + '" stroke="#2ecc71" stroke-width="' + stroke + '" stroke-linecap="round"' + dash + '/>');
    }
    for (const c of lay.couplers) {
        parts.push('<circle cx="' + round1(c.x) + '" cy="' + round1(c.y) + '" r="' + spec.outerR + '" fill="#162d1e" stroke="#2ecc71" stroke-width="2"/>');
    }
    const w = maxX - minX;
    const h = maxY - minY;
    parts.push('</g>');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + minX + ' ' + (-maxY) + ' ' + w + ' ' + h + '" role="img" aria-label="Ladder layout">' + parts.join('') + '</svg>';
}

function buildFiles(spec, lay, plan) {
    const files = [];
    const meshes = [];
    const keys = new Map();
    for (const c of lay.couplers) {
        const oriented = orientPorts(c.ports, spec.ports);
        if (!keys.has(oriented.key)) keys.set(oriented.key, oriented.ports);
    }
    const sorted = [...keys.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    sorted.forEach((entry, i) => {
        const name = 'coupler-' + String.fromCharCode(97 + i) + '.stl';
        const mesh = couplerMesh(spec, entry[1]);
        const stats = meshStats(mesh);
        if (!stats.watertight) throw fail('A connector mesh did not close');
        if (!fitsBed(stats, spec.maxPart)) throw fail('A connector is larger than the bed');
        const count = lay.couplers.filter((c) => orientPorts(c.ports, spec.ports).key === entry[0]).length;
        const data = writeStl(mesh);
        files.push({ name, data });
        meshes.push({ name, mesh, stats, count, role: 'coupler' });
    });
    let joinerMeshBuilt = null;
    const partRows = meshes.map((m) => ({
        name: m.name,
        count: m.count,
        role: m.role,
        size: sizeText(m.stats),
        fits: true,
    }));
    for (const g of plan.groups) {
        if (g.kind !== 'stick') continue;
        const name = (g.role === 'rail' ? 'rail-stick-' : 'rung-stick-') + String(g.seg).replace('.', '_') + '.stl';
        const mesh = barMesh(spec, g.seg);
        const stats = meshStats(mesh);
        if (!stats.watertight) throw fail('A bar mesh did not close');
        if (!fitsBed(stats, spec.maxPart)) throw fail('A bar is longer than the bed');
        files.push({ name, data: writeStl(mesh) });
        partRows.push({ name, count: g.count * g.n, role: g.role, size: sizeText(stats), fits: true });
        if (g.joiners && !joinerMeshBuilt) {
            joinerMeshBuilt = joinerMesh(spec);
            const jStats = meshStats(joinerMeshBuilt);
            if (!jStats.watertight) throw fail('The joiner mesh did not close');
            if (!fitsBed(jStats, spec.maxPart)) throw fail('The joiner is larger than the bed');
            files.push({ name: 'joiner.stl', data: writeStl(joinerMeshBuilt) });
            partRows.push({ name: 'joiner.stl', count: plan.counts.joiners, role: 'joiner', size: sizeText(jStats), fits: true });
        }
    }
    if (plan.counts.pins > 0) {
        const mesh = pinMesh(spec);
        const stats = meshStats(mesh);
        if (!stats.watertight) throw fail('The pin mesh did not close');
        files.push({ name: 'pin.stl', data: writeStl(mesh) });
        partRows.push({ name: 'pin.stl', count: plan.counts.pins, role: 'pin', size: sizeText(stats), fits: true });
    }
    return { files, partRows, meshes };
}

function readme(spec, plan, partRows) {
    const lines = [];
    lines.push('Octopus agility ladder');
    lines.push('');
    lines.push(plan.fitLine);
    lines.push(plan.gripLine);
    if (plan.rungLine) lines.push(plan.rungLine);
    if (plan.railLine) lines.push(plan.railLine);
    if (plan.cordLine) lines.push(plan.cordLine);
    if (plan.dowelLine && plan.dowelLine !== plan.rungLine) lines.push(plan.dowelLine);
    lines.push('');
    lines.push('Print these. PETG handles kicks better than PLA. Print flat, no supports. 0.2 mm layers, 4 walls, about 30% infill on the connectors, and solid pins.');
    lines.push('');
    for (const row of partRows) {
        lines.push(row.count + ' × ' + row.name + '  (' + row.size + ')');
    }
    lines.push('');
    lines.push('The connector is ' + spec.H + ' mm tall. You step between the rungs, not on the parts. The pin head sits in the bar. Push the pin up from below to take a bar out.');
    lines.push('');
    if (spec.rails === 'cord' || spec.rungs === 'cord') {
        lines.push('Paracord: tie a knot and sit it in the cup on each end connector. The middle holes are loose so the connectors slide. The cord runs along the ground between connectors, outside the stepping lane. To pack it, leave the cord threaded and push the connectors together so the cord folds. Untie the knots to take it apart.');
        lines.push('');
    }
    if (spec.rails === 'stick' || spec.rungs === 'stick') {
        lines.push('Printed bars: pull the pins and lift the bars out of the slots. A long bar is several pieces with a joiner between them. The joiner is a channel, open on top. Drop the bar in and pin it.');
        lines.push('');
    }
    if (spec.rails === 'dowel' || spec.rungs === 'dowel') {
        lines.push('Dowels: cut them to the length above. The dowel sits in a square channel and is held with a zip tie through the two holes beside the channel.');
        lines.push('');
    }
    lines.push('Socket count: ' + spec.ports + '. ' + spec.portsNote);
    return lines.join('\n');
}

function assemble(input) {
    const spec = normalize(input);
    const lay = layout(spec);
    const plan = describe(spec, lay);
    plan.svg = svgFor(spec, lay);
    const built = buildFiles(spec, lay, plan);
    plan.parts = built.partRows;
    const svg = Buffer.from(plan.svg, 'utf8');
    const note = Buffer.from(readme(spec, plan, built.partRows), 'utf8');
    const files = built.files.concat([
        { name: 'assembly.svg', data: svg },
        { name: 'read-me.txt', data: note },
    ]);
    return { spec, plan, files, meshes: built.meshes };
}

function plan(input) {
    const built = assemble(input);
    return built.plan;
}

function kitZip(input) {
    const built = assemble(input);
    return zipStore(built.files);
}

module.exports = {
    PRINTERS,
    MARGIN,
    defaults,
    normalize,
    plan,
    kitZip,
    assemble,
    portIndex,
    splitSpan,
    meshStats,
    solidWithPockets,
    writeStl,
};
