(function (global) {
  'use strict';

  var SELF_PAL = { near: '#d4cfc8', far: '#3c3c52', ctr: '#888090', hl: '#e74c3c' };

  function easeValue(t, type) {
    switch (type) {
      case 'ease-in':     return t * t;
      case 'ease-out':    return 1 - (1 - t) * (1 - t);
      case 'ease-in-out': return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      default:            return t;
    }
  }

  function lerpJoints(a, b, t) {
    var r = {};
    for (var k in a) {
      r[k] = { x: a[k].x + (b[k].x - a[k].x) * t, y: a[k].y + (b[k].y - a[k].y) * t };
    }
    return r;
  }

  function ang(p, c) { return Math.atan2(c.y - p.y, c.x - p.x) * 180 / Math.PI; }

  function figureHTML(jt, pal, hlArr, faceRight) {
    var hlSet = {};
    (hlArr || []).forEach(function (k) { hlSet[k] = true; });

    var ns = faceRight ? 'L' : 'R';
    var fs = faceRight ? 'R' : 'L';

    function nc(ps) {
      return ps.some(function (p) { return hlSet[p + ns]; }) ? pal.hl : pal.near;
    }
    function fc(ps) {
      return ps.some(function (p) { return hlSet[p + fs]; }) ? pal.hl : pal.far;
    }

    var nP = {
      shoulder: jt['shoulder' + ns], elbow: jt['elbow' + ns], hand: jt['hand' + ns],
      hip: jt['hip' + ns], knee: jt['knee' + ns], foot: jt['foot' + ns],
    };
    var fP = {
      shoulder: jt['shoulder' + fs], elbow: jt['elbow' + fs], hand: jt['hand' + fs],
      hip: jt['hip' + fs], knee: jt['knee' + fs], foot: jt['foot' + fs],
    };

    // Safety check — all joints must exist
    var required = ['head', 'neck', 'spine', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR',
      'handL', 'handR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'footL', 'footR'];
    for (var ri = 0; ri < required.length; ri++) {
      if (!jt[required[ri]]) return '';
    }

    var eyeX  = jt.head.x + (faceRight ?  3 : -3);
    var noseX = jt.head.x + (faceRight ?  7 : -7);

    var nHandA = ang(nP.elbow, nP.hand);
    var fHandA = ang(fP.elbow, fP.hand);

    var nShinA = Math.atan2(nP.foot.y - nP.knee.y, nP.foot.x - nP.knee.x);
    var fShinA = Math.atan2(fP.foot.y - fP.knee.y, fP.foot.x - fP.knee.x);
    var fDir   = faceRight ? 0 : 180;
    var nFootA = Math.abs(Math.sin(nShinA)) > 0.6 ? fDir : ang(nP.knee, nP.foot);
    var fFootA = Math.abs(Math.sin(fShinA)) > 0.6 ? fDir : ang(fP.knee, fP.foot);

    function f(n) { return n.toFixed(1); }
    function L(x1, y1, x2, y2, s, sw, op) {
      return '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) +
        '" stroke="' + s + '" stroke-width="' + sw + '" stroke-linecap="round"' +
        (op !== undefined ? ' opacity="' + op + '"' : '') + '/>';
    }
    function C(x, y, r, fill, op) {
      return '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + r + '" fill="' + fill + '"' +
        (op !== undefined ? ' opacity="' + op + '"' : '') + '/>';
    }
    function R(tx, ty, rot, x, y, w, h, rx, fill, op) {
      return '<g transform="translate(' + f(tx) + ',' + f(ty) + ') rotate(' + f(rot) + ')"' +
        (op !== undefined ? ' opacity="' + op + '"' : '') + '><rect x="' + x + '" y="' + y +
        '" width="' + w + '" height="' + h + '" rx="' + rx + '" fill="' + fill + '"/></g>';
    }

    return (
      '<polygon points="' + f(jt.shoulderL.x) + ',' + f(jt.shoulderL.y) + ' ' +
        f(jt.shoulderR.x) + ',' + f(jt.shoulderR.y) + ' ' +
        f(jt.hipR.x) + ',' + f(jt.hipR.y) + ' ' +
        f(jt.hipL.x) + ',' + f(jt.hipL.y) +
        '" fill="' + pal.ctr + '" fill-opacity="0.22" stroke="none"/>' +
      // Far-side limbs (behind)
      L(fP.shoulder.x, fP.shoulder.y, fP.elbow.x, fP.elbow.y, fc(['shoulder', 'elbow', 'hand']), 5) +
      L(fP.elbow.x, fP.elbow.y, fP.hand.x, fP.hand.y, fc(['elbow', 'hand']), 4) +
      L(fP.hip.x, fP.hip.y, fP.knee.x, fP.knee.y, fc(['hip', 'knee', 'foot']), 6.5) +
      L(fP.knee.x, fP.knee.y, fP.foot.x, fP.foot.y, fc(['knee', 'foot']), 5.5) +
      C(fP.elbow.x, fP.elbow.y, 3, fc(['elbow'])) +
      C(fP.knee.x, fP.knee.y, 4, fc(['knee'])) +
      R(fP.hand.x, fP.hand.y, fHandA, 1, -2, 5, 4, 1.8, fc(['hand']), 0.85) +
      R(fP.foot.x, fP.foot.y, fFootA, -3, -2.5, 9, 5, 2, fc(['foot', 'knee']), 0.85) +
      // Torso / spine
      L(jt.shoulderL.x, jt.shoulderL.y, jt.shoulderR.x, jt.shoulderR.y, pal.ctr, 5, 0.85) +
      L(jt.neck.x, jt.neck.y, jt.spine.x, jt.spine.y, pal.ctr, 9) +
      L(jt.hipL.x, jt.hipL.y, jt.hipR.x, jt.hipR.y, pal.ctr, 5, 0.85) +
      // Near-side limbs (front)
      L(nP.shoulder.x, nP.shoulder.y, nP.elbow.x, nP.elbow.y, nc(['shoulder', 'elbow', 'hand']), 7) +
      L(nP.elbow.x, nP.elbow.y, nP.hand.x, nP.hand.y, nc(['elbow', 'hand']), 6) +
      L(nP.hip.x, nP.hip.y, nP.knee.x, nP.knee.y, nc(['hip', 'knee', 'foot']), 8.5) +
      L(nP.knee.x, nP.knee.y, nP.foot.x, nP.foot.y, nc(['knee', 'foot']), 7) +
      C(nP.elbow.x, nP.elbow.y, 4, nc(['elbow'])) +
      C(nP.knee.x, nP.knee.y, 5, nc(['knee'])) +
      R(nP.hand.x, nP.hand.y, nHandA, 1, -2.8, 6, 5.5, 2.2, nc(['hand'])) +
      R(nP.foot.x, nP.foot.y, nFootA, -3, -3, 11, 6, 2.5, nc(['foot', 'knee'])) +
      // Neck / head
      L(jt.neck.x, jt.neck.y, jt.head.x, jt.head.y, pal.ctr, 6) +
      '<circle cx="' + f(jt.head.x) + '" cy="' + f(jt.head.y) + '" r="9" fill="' + pal.ctr +
        '" fill-opacity="0.2" stroke="' + pal.ctr + '" stroke-width="2.5"/>' +
      C(eyeX, jt.head.y - 1.5, 1.4, pal.ctr) +
      C(noseX, jt.head.y + 1.5, 1.6, pal.ctr, 0.85)
    );
  }

  function StickFigurePlayer(container, poseData, opts) {
    opts = opts || {};
    this.container = container;
    this.frames    = poseData.frames;
    this.loop      = poseData.loop !== false;
    this.pal       = opts.palette || SELF_PAL;
    this.faceRight = opts.faceRight !== false;

    this._fi      = 0;
    this._elapsed = 0;
    this._last    = null;
    this._raf     = null;
    this._playing = false;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 -10 100 124');
    svg.style.cssText = 'width:100%;height:100%;display:block;';
    this.svg = svg;
    container.innerHTML = '';
    container.appendChild(svg);

    this._render(this.frames[0].joints, this.frames[0].highlight || []);
    if (opts.autoplay !== false) this.play();
  }

  StickFigurePlayer.prototype._render = function (joints, hl) {
    this.svg.innerHTML = figureHTML(joints, this.pal, hl, this.faceRight);
  };

  StickFigurePlayer.prototype.play = function () {
    if (this._playing) return;
    this._playing = true;
    var self = this;
    function tick(ts) {
      if (!self._playing) return;
      if (self._last !== null) {
        self._elapsed += ts - self._last;
        var frames = self.frames;
        var cur    = frames[self._fi];
        var nextI  = (self._fi + 1) % frames.length;
        var next   = frames[nextI];
        var t      = self._elapsed / cur.duration;
        if (t >= 1) {
          self._elapsed -= cur.duration;
          if (nextI === 0 && !self.loop) { self._playing = false; return; }
          self._fi = nextI;
          t = 0;
        }
        var et = easeValue(t, cur.ease || 'linear');
        var j  = lerpJoints(cur.joints, next.joints, et);
        var hl = t < 0.5 ? (cur.highlight || []) : (next.highlight || []);
        self._render(j, hl);
      }
      self._last = ts;
      self._raf = requestAnimationFrame(tick);
    }
    this._last = null;
    this._raf = requestAnimationFrame(tick);
  };

  StickFigurePlayer.prototype.pause = function () {
    this._playing = false;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  };

  StickFigurePlayer.prototype.destroy = function () {
    this.pause();
    this.container.innerHTML = '';
  };

  // Load pose data from /poses/<key>.json then init player in container
  StickFigurePlayer.load = function (container, poseKey, opts, cb) {
    fetch('/poses/' + poseKey + '.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var player = new StickFigurePlayer(container, data, opts);
        if (cb) cb(null, player);
      })
      .catch(function (err) {
        if (cb) cb(err);
      });
  };

  global.StickFigurePlayer = StickFigurePlayer;
}(window));
