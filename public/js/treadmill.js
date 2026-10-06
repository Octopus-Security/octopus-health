/**
 * treadmill.js — timing, speeds, distance and tone rendering for the treadmill
 * tests. A classic script that also works under Node (module.exports), so the
 * page and test/treadmill.test.js run the SAME code. No DOM, no audio device,
 * no clock: everything is a function of elapsed seconds.
 *
 * ── The progressive test ─────────────────────────────────────────────────────
 * Stages of STAGE_SECONDS (60 s). Stage n runs at
 *
 *      speed(n) = start + (n - 1) * step
 *
 * in km/h (default start 8.0, step 0.5) or in mph (default start 5.0, step 0.3
 * mph, about 0.48 km/h, so the two scales climb at nearly the same rate). The
 * test ends when the runner can no longer keep up and presses Stop; the result
 * is the last COMPLETED stage, with the distance covered.
 *
 * Source of the shape: the one-minute-stage, +0.5 km/h-per-stage ramp is the
 * multistage convention of the 20 m shuttle run (L. Leger & J. Lambert, "A
 * maximal multistage 20-m shuttle run test to predict VO2 max", Eur J Appl
 * Physiol 1982;49:1-12; Leger et al., J Sports Sci 1988;6:93-101), here done on
 * a treadmill where the belt, not a beep, sets the pace. We apply the
 * increments only; this is NOT the validated shuttle protocol and it does not
 * estimate VO2max. Compare yourself with yourself, same start/step/incline.
 *
 * Optional constant incline (percent). A 1 % grade is the usual way to make
 * treadmill running resemble outdoor effort (Jones & Doust, J Sports Sci
 * 1996;14:321-327). Default 0; the announcements mention it only when set.
 *
 * ── The 12-minute test ───────────────────────────────────────────────────────
 * Cooper's 12-minute run (K. H. Cooper, JAMA 1968;203:201-204): cover as much
 * distance as possible in 12 minutes; the person reads the distance off the
 * treadmill. We give minute marks and a finish tone.
 *
 * ── Our own cues ─────────────────────────────────────────────────────────────
 * Every tone and every spoken line here was written for this app. It does not
 * copy or imitate any published fitness-test recording or script.
 *
 * Event times are seconds from the START of the test: negative during the
 * get-ready count-in.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Treadmill = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STAGE_SECONDS = 60;
  var COUNTIN_SECONDS = 10;
  var COOPER_SECONDS = 12 * 60;
  var KMH_PER_MPH = 1.609344;
  var DEFAULTS = {
    kmh: { start: 8.0, step: 0.5, min: 3, max: 20 },
    mph: { start: 5.0, step: 0.3, min: 2, max: 12 },
  };

  function opts(o) {
    o = o || {};
    var unit = o.unit === 'mph' ? 'mph' : 'kmh';
    var d = DEFAULTS[unit];
    return {
      unit: unit,
      start: num(o.start, d.start),
      step: num(o.step, d.step),
      incline: Math.max(0, Math.min(15, num(o.incline, 0))),
      stageSeconds: num(o.stageSeconds, STAGE_SECONDS),
    };
  }
  function num(v, fb) { v = Number(v); return isFinite(v) && v >= 0 ? v : fb; }
  function round1(x) { return Math.round(x * 10) / 10; }

  /** Speed of 1-based stage n, in the protocol's own unit, rounded to 0.1. */
  function stageSpeed(n, o) {
    o = opts(o);
    return round1(o.start + (n - 1) * o.step);
  }
  function toKmh(speed, unit) { return unit === 'mph' ? speed * KMH_PER_MPH : speed; }

  /** The full table the page prints, so the schedule is visible, not only spoken. */
  function schedule(n, o) {
    o = opts(o);
    var out = [];
    for (var i = 1; i <= n; i++) {
      var s = stageSpeed(i, o);
      out.push({ stage: i, startSec: (i - 1) * o.stageSeconds, speed: s, unit: o.unit, kmh: round1(toKmh(s, o.unit)), incline: o.incline });
    }
    return out;
  }

  /**
   * Distance in metres covered after `sec` seconds of the test (sec >= 0),
   * stage by stage - each stage at its own speed.
   */
  function distanceAt(sec, o) {
    o = opts(o);
    var m = 0, left = Math.max(0, sec), n = 1;
    while (left > 0) {
      var t = Math.min(left, o.stageSeconds);
      m += toKmh(stageSpeed(n, o), o.unit) * 1000 / 3600 * t;
      left -= t; n++;
    }
    return Math.round(m);
  }

  /** What the screen shows at `elapsed` seconds since Start was pressed. */
  function stateAt(elapsed, o) {
    o = opts(o);
    var t = elapsed - COUNTIN_SECONDS;
    if (t < 0) return { phase: 'countin', countdown: Math.ceil(-t), stage: 0, completedStages: 0, speed: null, unit: o.unit, incline: o.incline, distanceM: 0, stageRemaining: null };
    var stage = Math.floor(t / o.stageSeconds) + 1;
    var into = t - (stage - 1) * o.stageSeconds;
    return {
      phase: 'running', countdown: 0, stage: stage, completedStages: stage - 1,
      speed: stageSpeed(stage, o), unit: o.unit, incline: o.incline,
      stageElapsed: into, stageRemaining: Math.ceil(o.stageSeconds - into),
      nextSpeed: stageSpeed(stage + 1, o), distanceM: distanceAt(t, o), testSeconds: t,
    };
  }

  function unitWords(unit) { return unit === 'mph' ? 'miles per hour' : 'kilometres per hour'; }

  /** The sentence spoken at the start of a stage. Incline is mentioned only when used and when it first applies. */
  function stageSpeech(n, o) {
    o = opts(o);
    var s = 'Stage ' + n + '. Speed ' + stageSpeed(n, o).toFixed(1) + ' ' + unitWords(o.unit) + '.';
    if (n === 1 && o.incline > 0) s += ' Incline ' + o.incline + ' percent.';
    return s;
  }

  /**
   * Cue events for the progressive test, from t=-COUNTIN to the end of
   * `stages` stages. kind: 'ready' (speech only), 'tick' (short tone in the last
   * 3 s before a stage), 'stage' (triple tone + speech).
   */
  function progressiveEvents(stages, o) {
    o = opts(o);
    var ev = [{ t: -COUNTIN_SECONDS, kind: 'ready', say: 'Get on the belt. The test starts in ten seconds.' }];
    for (var n = 1; n <= stages; n++) {
      var at = (n - 1) * o.stageSeconds;
      ev.push({ t: at - 3, kind: 'tick' }, { t: at - 2, kind: 'tick' }, { t: at - 1, kind: 'tick' });
      ev.push({ t: at, kind: 'stage', stage: n, say: stageSpeech(n, o) });
    }
    ev.push({ t: stages * o.stageSeconds, kind: 'end', say: 'Test complete.' });
    return ev;
  }

  /** Events with a < t <= b (half-open, so a polling loop never plays one twice). */
  function eventsBetween(events, a, b) {
    return events.filter(function (e) { return e.t > a && e.t <= b; });
  }

  // Cooper 12-minute cues. Mark every minute; speak the useful ones.
  function cooperEvents() {
    var ev = [{ t: -COUNTIN_SECONDS, kind: 'ready', say: 'Get on the belt. The twelve minute test starts in ten seconds.' }];
    ev.push({ t: -3, kind: 'tick' }, { t: -2, kind: 'tick' }, { t: -1, kind: 'tick' });
    ev.push({ t: 0, kind: 'stage', say: 'Go. Cover as much distance as you can.' });
    for (var m = 1; m < 12; m++) {
      var e = { t: m * 60, kind: 'minute', minute: m };
      if (m === 6) e.say = 'Halfway. Six minutes left.';
      else if (m === 9) e.say = 'Three minutes left.';
      else if (m === 11) e.say = 'One minute left. Finish strong.';
      ev.push(e);
    }
    ev.push({ t: COOPER_SECONDS - 3, kind: 'tick' }, { t: COOPER_SECONDS - 2, kind: 'tick' }, { t: COOPER_SECONDS - 1, kind: 'tick' });
    ev.push({ t: COOPER_SECONDS, kind: 'end', say: 'Time. Stop, and note the distance on the display.' });
    return ev;
  }

  // ── Tones ──────────────────────────────────────────────────────────────────
  // One definition of what each cue SOUNDS like, used by the page's oscillators
  // and by the WAV renderer, so the file and the live test cannot drift.
  var TONES = {
    tick:   [{ at: 0, dur: 0.08, hz: 880 }],
    minute: [{ at: 0, dur: 0.15, hz: 700 }],
    stage:  [{ at: 0, dur: 0.15, hz: 1200 }, { at: 0.25, dur: 0.15, hz: 1200 }, { at: 0.5, dur: 0.15, hz: 1200 }],
    end:    [{ at: 0, dur: 0.9, hz: 600 }],
    ready:  [],
  };

  /**
   * Render events to an unsigned 8-bit mono PCM WAV (Uint8Array).
   * 8 kHz / 8-bit keeps a 20-minute file near 9.6 MB; these are plain tones.
   * Speech cannot be put in a file by this code, so the file carries the tones
   * only: a triple tone marks every stage (speed table on the page).
   * Events with t < 0 are shifted so the file starts at the first event.
   */
  function renderWav(events, opt) {
    opt = opt || {};
    var rate = opt.rate || 8000;
    var tail = opt.tailSeconds == null ? 1 : opt.tailSeconds;
    var t0 = Math.min.apply(null, events.map(function (e) { return e.t; }));
    var last = Math.max.apply(null, events.map(function (e) { return e.t; }));
    var seconds = (last - t0) + 1.2 + tail;
    var n = Math.ceil(seconds * rate);
    var pcm = new Uint8Array(n);
    pcm.fill(128);
    events.forEach(function (e) {
      (TONES[e.kind] || []).forEach(function (tn) {
        var s0 = Math.round((e.t - t0 + tn.at) * rate), len = Math.round(tn.dur * rate), fade = Math.round(0.005 * rate);
        for (var i = 0; i < len && s0 + i < n; i++) {
          var env = Math.min(1, i / fade, (len - i) / fade);
          pcm[s0 + i] = 128 + Math.round(90 * env * Math.sin(2 * Math.PI * tn.hz * i / rate));
        }
      });
    });
    var out = new Uint8Array(44 + n), v = new DataView(out.buffer);
    function str(o, s) { for (var i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); }
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
    str(36, 'data'); v.setUint32(40, n, true);
    out.set(pcm, 44);
    return out;
  }

  return {
    STAGE_SECONDS: STAGE_SECONDS, COUNTIN_SECONDS: COUNTIN_SECONDS, COOPER_SECONDS: COOPER_SECONDS,
    KMH_PER_MPH: KMH_PER_MPH, DEFAULTS: DEFAULTS, TONES: TONES,
    opts: opts, stageSpeed: stageSpeed, toKmh: toKmh, schedule: schedule, distanceAt: distanceAt,
    stateAt: stateAt, stageSpeech: stageSpeech, progressiveEvents: progressiveEvents,
    cooperEvents: cooperEvents, eventsBetween: eventsBetween, renderWav: renderWav,
  };
});
