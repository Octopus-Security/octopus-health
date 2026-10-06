/* treadmill-page.js — the page around public/js/treadmill.js.
 * All the timing is a function of ELAPSED SECONDS taken from performance.now(),
 * so a faked clock (Playwright page.clock) drives it exactly like a real one.
 * Audio: tones are scheduled on the Web Audio clock a fraction ahead of time
 * from the same TONES table the WAV file uses; speech is speechSynthesis.
 * Nothing here copies or imitates any published test recording. */
(function () {
  'use strict';
  var TM = window.Treadmill;
  var $ = function (id) { return document.getElementById(id); };
  var LOOKAHEAD = 0.3;

  var mode = (document.querySelector('input[name=mode]:checked') || {}).value || 'progressive';
  var running = false, paused = false, finished = false;
  var t0 = 0, pausedAt = 0, elapsed = 0, scheduledTo = -Infinity;
  var ctx = null, events = [], timer = null, last = null, wake = null;

  function opts() {
    return { unit: $('unit').value, start: $('start').value, step: $('step').value, incline: $('incline').value };
  }
  function fmtClock(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function now() { return performance.now() / 1000; }

  function renderSchedule() {
    var tb = $('sched').querySelector('tbody'); tb.textContent = '';
    var o = opts();
    TM.schedule(15, o).forEach(function (r) {
      var tr = document.createElement('tr');
      [r.stage, fmtClock(r.startSec), r.speed.toFixed(1) + (o.unit === 'mph' ? ' mph' : ' km/h')].forEach(function (v) {
        var td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    var q = new URLSearchParams({ mode: mode, unit: o.unit, start: o.start, step: o.step, incline: o.incline, stages: 15 });
    $('wav').href = '/tests/treadmill/audio.wav?' + q.toString();
  }

  function setMode(m) {
    mode = m;
    $('prog-setup').hidden = m !== 'progressive';
    $('l-main').textContent = m === 'cooper' ? 'Minute' : 'Stage';
    if (m === 'cooper') $('wav').href = '/tests/treadmill/audio.wav?mode=cooper'; else renderSchedule();
    show(null);
  }

  function tone(kind, atCtx) {
    if (!ctx || !$('snd').checked) return;
    (TM.TONES[kind] || []).forEach(function (t) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = t.hz; o.connect(g); g.connect(ctx.destination);
      var s = atCtx + t.at;
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.5, s + 0.005);
      g.gain.setValueAtTime(0.5, s + t.dur - 0.005); g.gain.linearRampToValueAtTime(0, s + t.dur);
      o.start(s); o.stop(s + t.dur + 0.01);
    });
  }
  function say(text) {
    if (!text || !$('voice').checked || !('speechSynthesis' in window)) return;
    try { var u = new SpeechSynthesisUtterance(text); u.rate = 1; window.speechSynthesis.speak(u); } catch (e) { /* no voice available */ }
  }

  function show(st) {
    if (!st) { $('stage').textContent = '-'; $('speed').textContent = '-'; $('remain').textContent = '-'; $('clock').textContent = '0:00'; $('dist').textContent = '0 m'; $('inc').textContent = $('incline').value + ' %'; return; }
    var o = opts();
    if (st.phase === 'countin') {
      $('banner').textContent = 'Starting in ' + st.countdown;
      $('stage').textContent = '-'; $('speed').textContent = '-'; $('remain').textContent = st.countdown + ' s';
      $('clock').textContent = '0:00'; $('dist').textContent = '0 m';
      return;
    }
    if (mode === 'cooper') {
      var left = Math.max(0, TM.COOPER_SECONDS - st.testSeconds);
      $('stage').textContent = String(Math.min(12, Math.floor(st.testSeconds / 60) + 1));
      $('speed').textContent = 'your pace'; $('remain').textContent = fmtClock(Math.ceil(left));
      $('l-main').textContent = 'Minute'; $('banner').textContent = left > 0 ? 'Running' : 'Time';
      $('clock').textContent = fmtClock(st.testSeconds); $('dist').textContent = '-'; $('inc').textContent = '-';
      return;
    }
    $('stage').textContent = st.stage;
    $('speed').textContent = st.speed.toFixed(1) + (o.unit === 'mph' ? ' mph' : ' km/h');
    $('remain').textContent = st.stageRemaining + ' s';
    $('clock').textContent = fmtClock(st.testSeconds);
    $('dist').textContent = st.distanceM + ' m';
    $('inc').textContent = o.incline + ' %';
    $('banner').textContent = 'Stage ' + st.stage + ' - ' + st.speed.toFixed(1) + (o.unit === 'mph' ? ' mph' : ' km/h');
  }

  function tick() {
    if (!running || paused) return;
    elapsed = now() - t0;
    var testTime = elapsed - TM.COUNTIN_SECONDS;
    var horizon = testTime + LOOKAHEAD;
    TM.eventsBetween(events, scheduledTo, horizon).forEach(function (e) {
      var delay = Math.max(0, e.t - testTime);
      if (ctx) tone(e.kind, ctx.currentTime + delay);
      if (e.say) say(e.say);
    });
    scheduledTo = horizon;
    var st = TM.stateAt(elapsed, opts());
    last = st; show(st);
    if (mode === 'cooper' && testTime >= TM.COOPER_SECONDS) return finish();
    if (mode !== 'cooper' && st.phase === 'running' && st.stage > 30) return finish();
  }

  async function start() {
    if (running) return;
    var o = opts();
    events = mode === 'cooper' ? TM.cooperEvents() : TM.progressiveEvents(30, o);
    try { var AC = window.AudioContext || window.webkitAudioContext; ctx = ctx || (AC ? new AC() : null); if (ctx && ctx.state === 'suspended') await ctx.resume(); } catch (e) { ctx = null; }
    try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { wake = null; }
    running = true; paused = false; finished = false; scheduledTo = -TM.COUNTIN_SECONDS - 1; t0 = now(); elapsed = 0; last = null;
    ['unit', 'start', 'step', 'incline'].forEach(function (id) { $(id).disabled = true; });
    document.querySelectorAll('input[name=mode]').forEach(function (r) { r.disabled = true; });
    $('btn-start').disabled = true; $('btn-pause').disabled = false; $('btn-stop').disabled = false; $('result').hidden = true;
    timer = setInterval(tick, 100); tick();
  }
  function pause() {
    if (!running) return;
    if (!paused) { paused = true; pausedAt = now(); $('btn-pause').textContent = 'Resume'; $('banner').textContent = 'Paused'; try { window.speechSynthesis.cancel(); } catch (e) {} }
    else { t0 += now() - pausedAt; paused = false; scheduledTo = (now() - t0) - TM.COUNTIN_SECONDS; $('btn-pause').textContent = 'Pause'; }
  }
  function finish() {
    if (finished) return; finished = true;
    clearInterval(timer); running = false;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    if (wake) { try { wake.release(); } catch (e) {} wake = null; }
    $('btn-start').disabled = false; $('btn-pause').disabled = true; $('btn-stop').disabled = true; $('btn-pause').textContent = 'Pause';
    ['unit', 'start', 'step', 'incline'].forEach(function (id) { $(id).disabled = false; });
    document.querySelectorAll('input[name=mode]').forEach(function (r) { r.disabled = false; });
    var o = opts(), st = last || TM.stateAt(elapsed, o), txt;
    $('cooper-entry').hidden = mode !== 'cooper';
    if (mode === 'cooper') {
      txt = '12-minute test: enter the distance shown on the treadmill.';
    } else if (st.phase === 'countin' || st.completedStages < 1) {
      txt = 'You stopped before finishing stage 1, so there is nothing to record.';
      st.completedStages = 0;
    } else {
      txt = 'Last completed stage: ' + st.completedStages + ' (' + TM.stageSpeed(st.completedStages, o).toFixed(1) + (o.unit === 'mph' ? ' mph' : ' km/h') + '). Distance about ' + TM.distanceAt(st.completedStages * TM.opts(o).stageSeconds, o) + ' m through that stage, ' + st.distanceM + ' m in total.';
    }
    $('result-text').textContent = txt;
    $('result').hidden = false;
    $('btn-record').disabled = mode !== 'cooper' && st.completedStages < 1;
    $('btn-record').dataset.completed = String(st.completedStages || 0);
    $('btn-record').dataset.partial = String(Math.floor(st.stageElapsed || 0));
    $('btn-record').dataset.dist = String(st.distanceM || 0);
  }

  async function record() {
    var o = opts(), b = $('btn-record'), body;
    if (mode === 'cooper') {
      var d = Number($('cdist').value);
      if (!(d > 0)) { $('rec-msg').textContent = 'Enter the distance first.'; return; }
      var m = $('cunit').value === 'km' ? d * 1000 : $('cunit').value === 'mi' ? d * 1609.344 : d;
      body = { item: 'cooper_12min_m', value: Math.round(m), detail: { enteredAs: d + ' ' + $('cunit').value } };
    } else {
      var n = Number(b.dataset.completed);
      var po = TM.opts(o);
      body = { item: 'treadmill_stage', value: n, detail: { unit: po.unit, start: po.start, step: po.step, incline: po.incline, stageSeconds: po.stageSeconds, lastSpeed: TM.stageSpeed(n, o), partialSeconds: Number(b.dataset.partial), distanceM: Number(b.dataset.dist) } };
    }
    try {
      var r = await window.fxSend('/tests/api/results', 'POST', body);
      $('rec-msg').textContent = 'Saved.' + (r.trend && r.trend.vsPrevious ? ' Change vs previous: ' + (r.trend.vsPrevious.delta > 0 ? '+' : '') + r.trend.vsPrevious.delta : '');
      b.disabled = true;
    } catch (e) { $('rec-msg').textContent = e.message; }
  }

  document.querySelectorAll('input[name=mode]').forEach(function (r) { r.addEventListener('change', function () { setMode(r.value); }); });
  ['unit', 'start', 'step', 'incline'].forEach(function (id) { $(id).addEventListener('change', function () {
    if (id === 'unit') { var d = TM.DEFAULTS[$('unit').value]; $('start').value = d.start; $('step').value = d.step; $('start').min = d.min; $('start').max = d.max; }
    renderSchedule(); show(null);
  }); });
  $('btn-start').addEventListener('click', start);
  $('btn-pause').addEventListener('click', pause);
  $('btn-stop').addEventListener('click', finish);
  $('btn-record').addEventListener('click', record);
  setMode(mode);
})();
