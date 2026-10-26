/*
 * Stick-figure exercise animations — format v2, a rigid skeleton.
 *
 * Why angles and not points: v1 stored an x/y for every joint in every frame and
 * interpolated each point on its own, so nothing tied a hand to its elbow. A
 * bone's length drifted between keyframes and a typo detached a limb outright
 * (Cat-Cow drew its arms floating beside the body). In v2 a frame stores the
 * ANGLE of each body segment and every joint is computed from its parent with a
 * fixed bone length (forward kinematics). Interpolating angles keeps every bone
 * the same length at every instant, so a disconnected or stretched limb cannot
 * be expressed at all — the connection rule is structural, not a convention.
 *
 * Angles: degrees, absolute (not relative to the parent segment).
 *   direction = (sin a, cos a) in SVG space (y grows downward), so
 *   0 = straight down, 90 = forward (the way the figure faces), 180 = straight
 *   up, -90 = backward. Values past ±180 are fine (torso 200 = leaning back);
 *   every move takes the shortest way round, so write each step at most 180° (190 → 170,
 *   never 190 → -170: the validator rejects it). The loop back from the last frame to
 *   the first takes the short way round too, so an arm circle can run 0 → 90 → 180 →
 *   270 → 360 and loop cleanly.
 *   Playback is real time (requestAnimationFrame): each key is held `hold` ms, then
 *   eased to the next over `duration` ms. "static": true is one held pose that never moves.
 *   In view "front" the figure faces the viewer and +90 is screen-right, which is
 *   the figure's LEFT side (L limbs hang on screen-right).
 *
 * Standing, side view, facing right:
 *   { torso:180, head:180, upperArmL:0, forearmL:0, upperArmR:0, forearmR:0,
 *     thighL:0, shinL:0, footL:90, thighR:0, shinR:0, footR:90 }
 *
 * Where the body is — either:
 *   "root": {x,y}            the pelvis, or
 *   "anchor": {joint,x,y}    a joint that stays planted there (ankleL, toeL,
 *                            handL, kneeL, hip, neck, head …); the pelvis is
 *                            derived. Use an anchor whenever something touches
 *                            the floor or a bar — it keeps that contact during
 *                            the move, not only at the keyframes.
 * An animation-level "anchor" applies to every frame that has neither.
 *
 * A second contact — "pins": ["handL","handR"] (also ankleL/ankleR), on the
 * animation or a frame — holds that hand or ankle on a straight line between its
 * keyframe positions and bends the elbow/knee to reach it. Anchor the feet and
 * pin the hands for a push-up; anchor the front foot and pin the back ankle for
 * a lunge. Without a pin, a second contact slides between keyframes.
 *
 * Optional "arch" (−45…45, default 0) curves the drawn spine without moving any
 * joint: positive rounds the back (cat, hollow body), negative arches it (cow,
 * cobra, bridge). Side view only.
 *
 * Frame 0 must carry every angle; later frames inherit what they omit. validate()
 * is the rule book; test/stick-figure.test.js runs it over every pose file.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.StickFigure = api; window.StickFigurePlayer = api.Player; }
}(this, function () {
  'use strict';

  var LEN = { torso: 30, head: 10, upperArm: 15, forearm: 14, thigh: 20, shin: 20, foot: 7 };
  var HEAD_R = 7;
  var HOLD_MAX = 180;          // default pause on a key pose, ms (capped; a quarter of a short move or less)
  var BOB = 0.7;               // static poses: breathing bob, in viewBox units
  var BOB_MS = 4200;
  var FLOOR_Y = 92;            // standing ankles sit at y=90
  var SHOULDER_HALF = 8;       // front view only
  var HIP_HALF = 5;            // front view only
  var VIEWBOX = '0 -20 100 116';   // headroom for arms overhead and a pull-up bar

  var ANGLES = ['torso', 'head', 'upperArmL', 'forearmL', 'upperArmR', 'forearmR',
    'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
  var JOINTS = ['hip', 'neck', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'handL', 'handR',
    'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR', 'toeL', 'toeR'];

  var PAL = { near: '#d4cfc8', far: '#4a4a62', ctr: '#8a8296', hl: '#e74c3c', prop: '#5f5f75', floor: '#34343f', headFill: '#1e1e28' };

  // ── maths ────────────────────────────────────────────────────────────────
  function rad(a) { return a * Math.PI / 180; }
  function step(p, a, len) { return { x: p.x + Math.sin(rad(a)) * len, y: p.y + Math.cos(rad(a)) * len }; }
  function norm(a) { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // Shortest signed turn from a to b. Equal to b - a whenever that is already
  // within a half turn, so angles written continuously play exactly as written.
  function turn(a, b) { var d = b - a; return d > 180 || d < -180 ? norm(d) : d; }

  function easeValue(t, type) {
    switch (type) {
      case 'linear':   return t;
      case 'ease-in':  return t * t;
      case 'ease-out': return 1 - (1 - t) * (1 - t);
      default:         return t * t * (3 - 2 * t);   // ease-in-out (smoothstep): zero speed at both ends
    }
  }

  // Forward kinematics, always facing right (mirroring happens when drawing).
  // The only place a joint position is produced, so every bone is exactly LEN.
  function solve(pose, view) {
    var hip = { x: pose.root.x, y: pose.root.y };
    var neck = step(hip, pose.torso, LEN.torso);
    var j = { hip: hip, neck: neck, head: step(neck, pose.head, LEN.head) };
    var sL = neck, sR = neck, hL = hip, hR = hip;
    if (view === 'front') {
      var px = Math.cos(rad(pose.torso)), py = -Math.sin(rad(pose.torso));   // torso's perpendicular
      sL = { x: neck.x - px * SHOULDER_HALF, y: neck.y - py * SHOULDER_HALF };
      sR = { x: neck.x + px * SHOULDER_HALF, y: neck.y + py * SHOULDER_HALF };
      hL = { x: hip.x - px * HIP_HALF, y: hip.y - py * HIP_HALF };
      hR = { x: hip.x + px * HIP_HALF, y: hip.y + py * HIP_HALF };
    }
    ['L', 'R'].forEach(function (s) {
      var sh = s === 'L' ? sL : sR, hp = s === 'L' ? hL : hR;
      j['shoulder' + s] = sh;
      j['elbow' + s] = step(sh, pose['upperArm' + s], LEN.upperArm);
      j['hand' + s] = step(j['elbow' + s], pose['forearm' + s], LEN.forearm);
      j['hip' + s] = hp;
      j['knee' + s] = step(hp, pose['thigh' + s], LEN.thigh);
      j['ankle' + s] = step(j['knee' + s], pose['shin' + s], LEN.shin);
      j['toe' + s] = step(j['ankle' + s], pose['foot' + s], LEN.foot);
    });
    return j;
  }

  // The pelvis position that puts anchor.joint at (anchor.x, anchor.y).
  function rootFor(pose, anchor, view) {
    var probe = {}; for (var k in pose) probe[k] = pose[k];
    probe.root = { x: 0, y: 0 };
    var at = solve(probe, view)[anchor.joint];
    return { x: anchor.x - at.x, y: anchor.y - at.y };
  }

  // Every frame with a complete pose and a concrete root.
  function resolveFrames(data) {
    var view = data.view || 'side', out = [], prev = null;
    (data.frames || []).forEach(function (fr) {
      var p = {}, src = fr.pose || {};
      if (prev) for (var k in prev.pose) p[k] = prev.pose[k];
      for (var j in src) p[j] = src[j];
      if (typeof p.arch !== 'number') p.arch = 0;
      var anchor = fr.anchor || (src.root ? null : (prev ? prev.anchor : data.anchor || null));
      if (src.root) anchor = null;
      p.root = anchor ? rootFor(p, anchor, view) : { x: p.root.x, y: p.root.y };
      var pins = fr.pins || (prev ? prev.pins : data.pins) || [];
      var dur = fr.duration || 1000;
      var r = { duration: dur, hold: typeof fr.hold === 'number' ? fr.hold : Math.min(HOLD_MAX, dur * 0.2), ease: fr.ease, label: fr.label, air: !!fr.air, anchor: anchor, pins: pins,
        highlight: fr.highlight || (prev ? prev.highlight : data.highlight) || [], pose: p };
      out.push(r); prev = r;
    });
    return out;
  }

  // Pose at fraction t (already eased) of the way from frame a to frame b.
  // With anchors, the root is re-derived at every instant so the planted joint
  // stays planted mid-move; blending the two anchors' answers keeps it smooth
  // when the planted joint changes (a burpee: feet, then hands).
  //
  // Pins are the second contact. A pinned hand or ankle follows a straight line
  // between where it is at the two keyframes (so it stays put when those are the
  // same) and the elbow or knee is solved to reach it, always bending the
  // anatomical way (sigma in the last column: forearm-upperArm > 0 for an elbow,
  // shin-thigh < 0 for a knee). It used to copy the sign from the first keyframe,
  // and a straight limb there (difference 0) read as +1, the ARM sign, so a
  // straight pinned leg that then bent was solved with its knee inside out. A push-up anchors the toes and pins both hands.
  var PIN_LIMB = {
    handL:  ['shoulderL', 'upperArmL', 'forearmL', LEN.upperArm, LEN.forearm, 1],
    handR:  ['shoulderR', 'upperArmR', 'forearmR', LEN.upperArm, LEN.forearm, 1],
    ankleL: ['hipL', 'thighL', 'shinL', LEN.thigh, LEN.shin, -1],
    ankleR: ['hipR', 'thighR', 'shinR', LEN.thigh, LEN.shin, -1],
  };
  function between(a, b, t, view) {
    var r = {};
    ANGLES.forEach(function (k) { r[k] = a.pose[k] + turn(a.pose[k], b.pose[k]) * t; });   // shortest way round
    r.arch = lerp(a.pose.arch, b.pose.arch, t);
    var plain = { x: lerp(a.pose.root.x, b.pose.root.x, t), y: lerp(a.pose.root.y, b.pose.root.y, t) };
    var ra = a.anchor ? rootFor(r, a.anchor, view) : plain;
    var rb = b.anchor ? rootFor(r, b.anchor, view) : plain;
    r.root = { x: lerp(ra.x, rb.x, t), y: lerp(ra.y, rb.y, t) };
    if (a.pins.length && t > 0 && t < 1) {
      var ja = solve(a.pose, view), jb = solve(b.pose, view), jr = solve(r, view);
      a.pins.forEach(function (end) {
        var L = PIN_LIMB[end]; if (!L) return;
        var base = jr[L[0]], target = { x: lerp(ja[end].x, jb[end].x, t), y: lerp(ja[end].y, jb[end].y, t) };
        var la = L[3], lb = L[4], dx = target.x - base.x, dy = target.y - base.y;
        var d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(la - lb) + 0.01), la + lb - 0.01);
        var alpha = Math.acos((la * la + d * d - lb * lb) / (2 * la * d)) * 180 / Math.PI;
        var dirA = Math.atan2(dx, dy) * 180 / Math.PI;
        var sigma = L[5];   // anatomical bend direction (see PIN_LIMB), never inferred from the keyframe
        var parent = dirA - sigma * alpha;
        var elbow = step(base, parent, la);
        var child = Math.atan2(target.x - elbow.x, target.y - elbow.y) * 180 / Math.PI;
        // keep the numbers near the interpolated ones so nothing spins
        r[L[1]] = r[L[1]] + norm(parent - r[L[1]]);
        r[L[2]] = r[L[2]] + norm(child - r[L[2]]);
      });
    }
    return r;
  }

  // The frame after i. Looping back to frame 0, each angle is shifted by whole
  // turns to sit nearest the last frame's, so a full circle does not unwind.
  function nextOf(frames, i) {
    var ni = (i + 1) % frames.length;
    if (ni !== 0) return frames[ni];
    var last = frames[i].pose, f0 = frames[0], p = {};
    for (var k in f0.pose) p[k] = f0.pose[k];
    ANGLES.forEach(function (k) { p[k] = last[k] + norm(f0.pose[k] - last[k]); });
    var w = {}; for (var j in f0) w[j] = f0[j];
    w.pose = p;
    return w;
  }

  // ── timeline ─────────────────────────────────────────────────────────────
  // Real time, not stepped frames: each key pose is held for frame.hold ms, then
  // the figure moves to the next over frame.duration ms. A key with hold 0 is a
  // pass-through (a circle, a stride): the two moves either side of it do not slow
  // to a stop there, so continuous motion stays continuous. The move from the
  // last frame back to the first is just another move, taking the short way round.
  function segEase(frames, i, loop) {
    var fr = frames[i];
    if (fr.ease) return fr.ease;
    var n = frames.length, prev = frames[(i + n - 1) % n], next = frames[(i + 1) % n];
    var stopStart = (i === 0 && !loop) || prev.hold > 0, stopEnd = next.hold > 0;
    return stopStart && stopEnd ? 'ease-in-out' : stopStart ? 'ease-in' : stopEnd ? 'ease-out' : 'linear';
  }
  function timeline(frames, loop) {
    var t = 0, segs = frames.map(function (fr, i) {
      var last = !loop && i === frames.length - 1;
      var s = { start: t, hold: fr.hold, dur: last ? 0 : fr.duration, ease: last ? null : segEase(frames, i, loop) };
      t += s.hold + s.dur;
      return s;
    });
    return { segs: segs, total: t };
  }
  // The pose at ms into the cycle (wrapped when looping). Returns {pose, index, t, done}.
  function sampleAt(frames, tl, ms, view, loop) {
    var end = tl.total;
    if (loop !== false) { ms = end > 0 ? ((ms % end) + end) % end : 0; }
    else if (ms >= end) return { pose: frames[frames.length - 1].pose, index: frames.length - 1, t: 0, done: true };
    var i = 0;
    while (i < tl.segs.length - 1 && ms >= tl.segs[i + 1].start) i++;
    var sg = tl.segs[i], local = ms - sg.start;
    if (local < sg.hold || sg.dur <= 0) return { pose: frames[i].pose, index: i, t: 0, done: false };
    var t = easeValue((local - sg.hold) / sg.dur, sg.ease);
    return { pose: between(frames[i], nextOf(frames, i), t, view), index: i, t: t, done: false };
  }

  // ── rules ────────────────────────────────────────────────────────────────
  var SURFACE = FLOOR_Y + 1.5;          // where the floor line is drawn
  // how far each joint's drawing extends below the joint (half a stroke, or the head)
  var RADIUS = { hip: 5, neck: 5, head: HEAD_R, shoulderL: 3, shoulderR: 3, elbowL: 3, elbowR: 3, handL: 2.7, handR: 2.7,
    hipL: 4, hipR: 4, kneeL: 4, kneeR: 4, ankleL: 3.2, ankleR: 3.2, toeL: 2.3, toeR: 2.3 };
  function note(worst, at, joint, what, score, detail, pct) {
    var k = at + joint + what;
    if (!worst[k] || score > worst[k].score) {
      worst[k] = { score: score, msg: 'frame ' + at + ': ' + joint + ' ' + what + ' (' + detail + (at.indexOf('→') >= 0 ? ', worst at ' + pct + '%' : '') + ')' };
    }
  }
  // THE HINGE RULE. A knee flexes only so the shin goes BEHIND the thigh, an
  // elbow only so the forearm goes FORWARD of the upper arm, relative to the way
  // the figure faces. Angles are in the figure's own frame (+90 = the way it faces)
  // and mirroring happens only when drawing, so facing and mirroring are already
  // accounted for: knee = thigh - shin and elbow = forearm - upperArm are positive
  // when bent the right way. At most HYPER degrees past straight the wrong way.
  // It is checked at every keyframe AND on the in-betweens, because IK (pins) and
  // the angle blend can bend a joint backwards between two legal keyframes.
  // Front view cannot show a sagittal bend (the knee bends into the screen), so it
  // is exempt; there the limbs are only checked for the bone-length rules.
  var HYPER = 5, FLEX_MAX = 165;
  function hingeErrors(p, sd) {
    var out = [];
    var knee = norm(p['thigh' + sd] - p['shin' + sd]);
    if (knee < -HYPER) out.push(['knee' + sd, 'bends backwards', knee, 'thigh−shin is ' + knee.toFixed(0) + '°; the shin must go behind the thigh, at most ' + HYPER + '° past straight']);
    else if (knee > FLEX_MAX) out.push(['knee' + sd, 'bends too far', knee, 'thigh−shin is ' + knee.toFixed(0) + '°, max ' + FLEX_MAX]);
    var elbow = norm(p['forearm' + sd] - p['upperArm' + sd]);
    if (elbow < -HYPER) out.push(['elbow' + sd, 'bends backwards', elbow, 'forearm−upperArm is ' + elbow.toFixed(0) + '°; the forearm must go forward, at most ' + HYPER + '° past straight']);
    else if (elbow > FLEX_MAX) out.push(['elbow' + sd, 'bends too far', elbow, 'forearm−upperArm is ' + elbow.toFixed(0) + '°, max ' + FLEX_MAX]);
    return out;
  }

  // Every problem with an animation; empty means valid.
  function validate(data) {
    var errs = [];
    if (!data || data.version !== 2) return ['version must be 2'];
    var view = data.view || 'side';
    if (view !== 'side' && view !== 'front') errs.push('view must be "side" or "front"');
    if (!data.title) errs.push('title missing');
    var isStatic = data.static === true;
    if (data.static !== undefined && typeof data.static !== 'boolean') errs.push('static must be true or false');
    if (!Array.isArray(data.frames)) return errs.concat('needs frames');
    if (isStatic && data.frames.length !== 1) return errs.concat('a static pose is exactly one frame (it holds still; it does not move)');
    if (!isStatic && data.frames.length < 2) return errs.concat('needs at least 2 frames (or "static": true with one)');
    var f0 = data.frames[0], p0 = f0.pose || {};
    if (!p0.root && !f0.anchor && !data.anchor) errs.push('frame 0: needs pose.root or an anchor');
    ANGLES.forEach(function (k) { if (typeof p0[k] !== 'number' || !isFinite(p0[k])) errs.push('frame 0: ' + k + ' missing'); });
    data.frames.forEach(function (fr, i) {
      Object.keys(fr.pose || {}).forEach(function (k) {
        if (k === 'arch') { if (!(Math.abs(fr.pose.arch) <= 45)) errs.push('frame ' + i + ': arch must be −45…45'); }
        else if (k !== 'root' && ANGLES.indexOf(k) < 0) errs.push('frame ' + i + ': unknown pose key "' + k + '"');
        else if (k !== 'root' && (typeof fr.pose[k] !== 'number' || !isFinite(fr.pose[k]))) errs.push('frame ' + i + ': ' + k + ' is not a number');
      });
      var an = fr.anchor || (i === 0 ? data.anchor : null);
      if (an && JOINTS.indexOf(an.joint) < 0) errs.push('frame ' + i + ': anchor joint "' + an.joint + '" unknown (one of ' + JOINTS.join(', ') + ')');
      (fr.pins || (i === 0 ? data.pins : null) || []).forEach(function (pn) {
        if (!PIN_LIMB[pn]) errs.push('frame ' + i + ': pin "' + pn + '" unknown (handL, handR, ankleL, ankleR)');
      });
      if (fr.hold !== undefined && !(fr.hold >= 0 && fr.hold <= 5000)) errs.push('frame ' + i + ': hold must be 0–5000 ms');
      if (!isStatic && !(fr.duration >= 150 && fr.duration <= 10000)) errs.push('frame ' + i + ': duration must be 150–10000 ms');
    });
    if (data.anchor && JOINTS.indexOf(data.anchor.joint) < 0) errs.push('anchor joint "' + data.anchor.joint + '" unknown');
    if (errs.length) return errs;

    var frames = resolveFrames(data);
    var grounded = data.grounded !== false;
    var moved = 0;
    frames.forEach(function (fr, i) {
      var ni = (i + 1) % frames.length;
      if (ni === 0 && data.loop === false) {   // final key of a non-looping animation still gets the hinge rule
        if (view === 'side') ['L', 'R'].forEach(function (sd) { hingeErrors(fr.pose, sd).forEach(function (h) { errs.push('frame ' + i + ': ' + h[0] + ' ' + h[1] + ' (' + h[3] + ')'); }); });
        return;
      }
      var nx = nextOf(frames, i), p = fr.pose;
      ANGLES.forEach(function (k) {
        var d = Math.abs(nx.pose[k] - p[k]);
        // Players take the shortest way round, so a written jump over a half turn would play as the OTHER way.
        if (d > 180) errs.push('frame ' + i + '→' + ni + ': ' + k + ' swings ' + d.toFixed(0) + '° — write angles continuously (190, not -170); a move is always played the short way round');
        moved = Math.max(moved, d);
      });
      moved = Math.max(moved, Math.hypot(nx.pose.root.x - p.root.x, nx.pose.root.y - p.root.y) * 4);

      // Check the in-betweens as well as the keyframes: a pose can be legal at
      // both ends and still pass through the floor on the way. Floor checks use
      // the DRAWN edge (joint + its drawn radius), so a torso lying on the floor
      // touches it and a hand resting there does not count as sunk. One message
      // per joint per transition, at its worst point.
      var worst = {};
      for (var s = 0; s <= 6; s++) {
        var q = between(fr, nx, s / 6, view), jt = solve(q, view);
        var lowest = -Infinity, at = s ? (i + '→' + ni) : String(i), pct = Math.round(s / 6 * 100);
        JOINTS.forEach(function (n) {
          var pt = jt[n], edge = pt.y + RADIUS[n];
          if (pt.x - (n === 'head' ? HEAD_R : 0) < 1 || pt.x + (n === 'head' ? HEAD_R : 0) > 99) note(worst, at, n, 'leaves the frame sideways', Math.abs(pt.x - 50), 'x=' + pt.x.toFixed(1), pct);
          if (pt.y - (n === 'head' ? HEAD_R : 0) < -19.5) note(worst, at, n, 'leaves the top of the frame', -pt.y, 'y=' + pt.y.toFixed(1), pct);
          if (edge > SURFACE + 1.5) note(worst, at, n, 'goes through the floor', edge, 'bottom edge ' + edge.toFixed(1) + ', floor surface ' + SURFACE, pct);
          lowest = Math.max(lowest, edge);
        });
        if (view === 'side') {
          ['L', 'R'].forEach(function (sd) {
            hingeErrors(q, sd).forEach(function (h) { note(worst, at, h[0], h[1], Math.abs(h[2]), h[3], pct); });
          });
        }
        if (s === 0 && grounded && !fr.air && lowest < SURFACE - 3) {
          errs.push('frame ' + i + ': floating — lowest edge ' + lowest.toFixed(1) + ', floor surface ' + SURFACE + ' (anchor something to the floor, mark the frame "air": true, or set "grounded": false for a bar/bench)');
        }
      }
      Object.keys(worst).forEach(function (k) { errs.push(worst[k].msg); });

      if (view === 'side') {
        ['L', 'R'].forEach(function (sd) {
          var ankle = norm(p['foot' + sd] - p['shin' + sd]);
          if (ankle < 15 || ankle > 140) errs.push('frame ' + i + ': ankle' + sd + ' out of range (' + ankle.toFixed(0) + '°; foot−shin must be 15…140, 90 neutral)');
          var hipF = norm(180 - p.torso + p['thigh' + sd]);
          if (hipF < -60 || hipF > 178) errs.push('frame ' + i + ': hip' + sd + ' out of range (' + hipF.toFixed(0) + '°; 180−torso+thigh must be −60…178)');
        });
      }
      var neck = norm(p.head - p.torso);
      if (neck < -70 || neck > 70) errs.push('frame ' + i + ': neck out of range (' + neck.toFixed(0) + '°; head−torso must be ±70)');
    });
    if (!isStatic && moved < 10) errs.push('does not move — biggest change between frames is ' + moved.toFixed(1) + '° (needs ≥ 10°)');
    return errs.filter(function (e, i) { return errs.indexOf(e) === i; });
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  function f(n) { return n.toFixed(1); }
  function line(a, b, col, w) {
    return '<line x1="' + f(a.x) + '" y1="' + f(a.y) + '" x2="' + f(b.x) + '" y2="' + f(b.y) +
      '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  }
  function circ(c, r, fill, extra) {
    return '<circle cx="' + f(c.x) + '" cy="' + f(c.y) + '" r="' + r + '" fill="' + fill + '"' + (extra || '') + '/>';
  }

  function propHTML(p, pal) {
    var c = pal.prop;
    switch (p.type) {
      case 'bar':    return '<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round"/>';
      case 'box':    return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="1.5" fill="' + c + '" opacity="0.55"/>';
      case 'ball':   return '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + p.r + '" fill="' + c + '" opacity="0.7"/>';
      case 'roller': return '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + p.r + '" fill="none" stroke="' + c + '" stroke-width="2"/>';
      case 'wall':   return '<line x1="' + p.x + '" y1="-10" x2="' + p.x + '" y2="' + (FLOOR_Y + 1.5) + '" stroke="' + c + '" stroke-width="2.5"/>';
      default:       return '';
    }
  }

  // Equipment in the hands is drawn from the hand positions, so it travels with them.
  function holdHTML(hold, jt, pal, view) {
    var c = pal.prop, mid = { x: (jt.handL.x + jt.handR.x) / 2, y: (jt.handL.y + jt.handR.y) / 2 };
    switch (hold) {
      case 'dumbbell':
        return ['L', 'R'].map(function (s) {
          var h = jt['hand' + s];
          return view === 'front'
            ? '<rect x="' + f(h.x - 5) + '" y="' + f(h.y - 1.5) + '" width="10" height="3" rx="1" fill="' + c + '"/>'
            : circ(h, 3.4, c, ' opacity="0.9"');
        }).join('');
      case 'barbell':
        return view === 'front'
          ? '<line x1="' + f(mid.x - 30) + '" y1="' + f(mid.y) + '" x2="' + f(mid.x + 30) + '" y2="' + f(mid.y) + '" stroke="' + c + '" stroke-width="2"/>' +
            '<rect x="' + f(mid.x - 30) + '" y="' + f(mid.y - 7) + '" width="4" height="14" rx="1" fill="' + c + '"/>' +
            '<rect x="' + f(mid.x + 26) + '" y="' + f(mid.y - 7) + '" width="4" height="14" rx="1" fill="' + c + '"/>'
          : circ(mid, 8, 'none', ' stroke="' + c + '" stroke-width="3"') + circ(mid, 1.6, c);
      case 'kettlebell': return circ({ x: mid.x, y: mid.y + 4 }, 4.2, c) + circ(mid, 2, 'none', ' stroke="' + c + '" stroke-width="1.5"');
      case 'ball':       return circ(mid, 6, c, ' opacity="0.9"');
      default:           return '';
    }
  }

  function figureHTML(pose, opts, hlArr) {
    var view = opts.view, pal = opts.palette || PAL;
    var jt = solve(pose, view);
    var hl = {};
    (hlArr || []).forEach(function (k) { hl[k] = true; });
    var near = view === 'front' ? null : 'L';     // side view: L is the near side
    function col(s, parts) {
      if (parts.some(function (p) { return hl[p + s] || hl[p]; })) return pal.hl;
      return near === null || s === near ? pal.near : pal.far;
    }
    function arm(s, w) {
      return line(jt['shoulder' + s], jt['elbow' + s], col(s, ['shoulder', 'elbow']), 6 * w) +
        line(jt['elbow' + s], jt['hand' + s], col(s, ['elbow', 'hand', 'wrist']), 5 * w) +
        circ(jt['hand' + s], 2.7 * w, col(s, ['hand', 'wrist']));
    }
    function leg(s, w) {
      return line(jt['hip' + s], jt['knee' + s], col(s, ['hip', 'knee']), 8 * w) +
        line(jt['knee' + s], jt['ankle' + s], col(s, ['knee', 'ankle']), 6.5 * w) +
        line(jt['ankle' + s], jt['toe' + s], col(s, ['ankle', 'foot']), 4.5 * w);
    }
    var torsoCol = hl.spine || hl.core || hl.torso ? pal.hl : pal.ctr;
    var headCol = hl.neck || hl.head ? pal.hl : pal.ctr;

    var out = '';
    if (opts.floor !== false) out += '<line x1="0" y1="' + (FLOOR_Y + 1.5) + '" x2="100" y2="' + (FLOOR_Y + 1.5) + '" stroke="' + pal.floor + '" stroke-width="1.5"/>';
    (opts.props || []).forEach(function (p) { out += propHTML(p, pal); });
    out += '<g class="sf-bob">';     // the figure only: a static pose's breathing bob moves this, not the floor or props

    var headHTML = line(jt.neck, jt.head, headCol, 4.5) + circ(jt.head, HEAD_R, pal.headFill, ' stroke="' + headCol + '" stroke-width="2.5"');
    if (view === 'front') {
      out += '<polygon points="' + [jt.shoulderL, jt.shoulderR, jt.hipR, jt.hipL].map(function (p) { return f(p.x) + ',' + f(p.y); }).join(' ') +
          '" fill="' + torsoCol + '" fill-opacity="0.3" stroke="' + torsoCol + '" stroke-width="3" stroke-linejoin="round"/>' +
        leg('L', 1) + leg('R', 1) + arm('L', 1) + arm('R', 1) + headHTML +
        circ({ x: jt.head.x - 2.4, y: jt.head.y - 1 }, 1.1, headCol) + circ({ x: jt.head.x + 2.4, y: jt.head.y - 1 }, 1.1, headCol);
    } else {
      var fa = pose.head - 90;    // the face looks 90° forward of the head segment
      // the spine bows toward the back for a positive arch; the back is 90° behind the torso
      var bow = step({ x: (jt.hip.x + jt.neck.x) / 2, y: (jt.hip.y + jt.neck.y) / 2 }, pose.torso + 90, (pose.arch || 0) / 45 * 16);
      var spine = '<path d="M' + f(jt.hip.x) + ' ' + f(jt.hip.y) + ' Q' + f(bow.x) + ' ' + f(bow.y) + ' ' + f(jt.neck.x) + ' ' + f(jt.neck.y) +
        '" fill="none" stroke="' + torsoCol + '" stroke-width="10" stroke-linecap="round"/>';
      out += leg('R', 0.85) + arm('R', 0.85) + spine + leg('L', 1) + headHTML +
        circ(step(jt.head, fa, 3.6), 1.4, headCol) + arm('L', 1);
    }
    out += holdHTML(opts.hold, jt, pal, view) + '</g>';
    return opts.faceRight === false ? '<g transform="translate(100 0) scale(-1 1)">' + out + '</g>' : out;
  }

  function drawOpts(data, over) {
    over = over || {};
    return { view: data.view || 'side', props: data.props, hold: data.hold, floor: data.floor,
      palette: over.palette || PAL, faceRight: over.faceRight !== false };
  }

  // ── player ───────────────────────────────────────────────────────────────
  // One animation loop for every figure on the page, skipping figures that are
  // off screen: the library renders ~300 cards, and each used to run its own
  // requestAnimationFrame.
  var live = [], rafId = null, observer = null;
  function loop(ts) {
    live.forEach(function (p) { if (p._playing && p._visible) p._tick(ts); });
    rafId = live.length ? requestAnimationFrame(loop) : null;
  }
  function track(p) {
    if (live.indexOf(p) < 0) {
      live.push(p);
      if (typeof IntersectionObserver !== 'undefined') {
        observer = observer || new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            live.forEach(function (q) { if (q.container === e.target) { q._visible = e.isIntersecting; q._last = null; } });
          });
        });
        observer.observe(p.container);
      }
    }
    if (!rafId) rafId = requestAnimationFrame(loop);
  }
  function untrack(p) {
    var i = live.indexOf(p);
    if (i >= 0) live.splice(i, 1);
    if (observer) observer.unobserve(p.container);
  }

  function Player(container, data, opts) {
    opts = opts || {};
    this.container = container;
    this.view = data.view || 'side';
    this.frames = resolveFrames(data);
    this.loop = data.loop !== false;
    this.static = data.static === true;
    this.tl = timeline(this.frames, this.loop);
    this.opts = drawOpts(data, opts);
    this._clock = 0; this._last = null; this._playing = false; this._visible = true;
    this._still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', VIEWBOX);
    svg.setAttribute('role', 'img');
    if (data.title) svg.setAttribute('aria-label', data.title);
    svg.style.cssText = 'width:100%;height:100%;display:block;';
    this.svg = svg;
    container.innerHTML = '';
    container.appendChild(svg);
    this._render(this.frames[0].pose, this.frames[0].highlight);
    if (this.static) this._bob = svg.querySelector('.sf-bob');
    if (opts.autoplay !== false && !(this.static && this._still)) this.play();
  }
  Player.prototype._render = function (pose, hl) { this.svg.innerHTML = figureHTML(pose, this.opts, hl); };
  Player.prototype._tick = function (ts) {
    if (this._last !== null) {
      var dt = Math.min(ts - this._last, 100);
      if (this.static) {
        // One pose, drawn once. Only the whole figure's transform changes, at ~20 fps: no re-render, no limb moves.
        if (dt < 48) return;
        this._clock += dt;
        if (this._bob) {
          var y = (Math.sin(this._clock / BOB_MS * 2 * Math.PI) * 0.5 + 0.5) * BOB;
          this._bob.setAttribute('transform', 'translate(0 ' + y.toFixed(2) + ')');
        }
        this._last = ts;
        return;
      }
      this._clock += dt;
      var smp = sampleAt(this.frames, this.tl, this._clock, this.view, this.loop);
      var fr = this.frames[smp.index], nx = this.frames[(smp.index + 1) % this.frames.length];
      this._render(smp.pose, smp.t < 0.5 ? fr.highlight : nx.highlight);
      if (smp.done) { this.pause(); return; }
    }
    this._last = ts;
  };
  Player.prototype.play = function () { this._playing = true; this._last = null; track(this); };
  Player.prototype.pause = function () { this._playing = false; };
  Player.prototype.destroy = function () { this.pause(); untrack(this); this.container.innerHTML = ''; };

  var cache = {};
  Player.load = function (container, key, opts, cb) {
    cache[key] = cache[key] || fetch('/poses/' + encodeURIComponent(key) + '.json').then(function (r) {
      if (!r.ok) throw new Error('pose ' + key + ': HTTP ' + r.status);
      return r.json();
    });
    cache[key].then(function (data) {
      var p = new Player(container, data, opts);
      if (cb) cb(null, p);
    }).catch(function (err) { delete cache[key]; if (cb) cb(err); });
  };

  // A static SVG of one moment — the contact sheet uses it. t is the fraction
  // of the way from frameIndex to the next frame.
  function svgFor(data, frameIndex, t) {
    var frames = resolveFrames(data), a = frames[frameIndex || 0], b = nextOf(frames, frameIndex || 0);
    var pose = t ? between(a, b, t, data.view || 'side') : a.pose;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + VIEWBOX + '">' + figureHTML(pose, drawOpts(data), a.highlight) + '</svg>';
  }

  // A static SVG at an exact moment of the real playback (ms into the cycle), hold and easing included.
  function svgAt(data, ms) {
    var frames = resolveFrames(data), view = data.view || 'side', loop = data.loop !== false;
    var smp = sampleAt(frames, timeline(frames, loop), ms, view, loop);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + VIEWBOX + '">' + figureHTML(smp.pose, drawOpts(data), frames[smp.index].highlight) + '</svg>';
  }
  function duration(data) { var f = resolveFrames(data); return timeline(f, data.loop !== false).total; }

  return { Player: Player, validate: validate, svgAt: svgAt, duration: duration, timeline: timeline, sampleAt: sampleAt, solve: solve, resolveFrames: resolveFrames, between: between,
    nextOf: nextOf, svgFor: svgFor, LEN: LEN, ANGLES: ANGLES, JOINTS: JOINTS, FLOOR_Y: FLOOR_Y };
}));
