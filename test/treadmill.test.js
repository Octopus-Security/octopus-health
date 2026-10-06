'use strict';

/**
 * treadmill.js: the timing and the sound, as functions of elapsed seconds.
 *
 * "Test the lap times" for the treadmill version means the stage table: speeds
 * climb by exactly the step, distance is the sum of speed x time per stage, and
 * every cue lands at the second the schedule says. The WAV is checked as a file
 * (header fields, length, silence between cues, a tone where a cue is), because
 * a renderer that is off by a byte plays as noise on a speaker.
 *
 * Run: node --test test/treadmill.test.js
 */

const { test } = require('node:test');
const assert   = require('node:assert');
const TM = require('../public/js/treadmill.js');

test('km/h: 8.0 start, +0.5 per one-minute stage', () => {
  assert.deepStrictEqual([1, 2, 3, 4, 11].map(n => TM.stageSpeed(n)), [8, 8.5, 9, 9.5, 13]);
  const t = TM.schedule(3);
  assert.deepStrictEqual(t.map(r => r.startSec), [0, 60, 120]);
  assert.deepStrictEqual(t.map(r => r.kmh), [8, 8.5, 9]);
});

test('mph: 5.0 start, +0.3 per stage, also reported in km/h', () => {
  assert.deepStrictEqual([1, 2, 3, 4].map(n => TM.stageSpeed(n, { unit: 'mph' })), [5, 5.3, 5.6, 5.9]);
  const r = TM.schedule(1, { unit: 'mph' })[0];
  assert.strictEqual(r.kmh, 8); // 5 mph = 8.05 km/h
  assert.strictEqual(TM.stageSpeed(3, { unit: 'kmh', start: 6, step: 0.7 }), 7.4);
});

test('distance: each stage at its own speed', () => {
  // stage 1: 8 km/h for 60 s = 133.3 m; stage 2: 8.5 km/h for 60 s = 141.7 m
  assert.strictEqual(TM.distanceAt(0), 0);
  assert.strictEqual(TM.distanceAt(60), 133);
  assert.strictEqual(TM.distanceAt(120), 275);
  assert.strictEqual(TM.distanceAt(90), Math.round(8 * 1000 / 3600 * 60 + 8.5 * 1000 / 3600 * 30));
});

test('state: 10 s count-in, then stage 1; stage 2 begins exactly 60 s later', () => {
  assert.deepStrictEqual([TM.stateAt(0).phase, TM.stateAt(0).countdown], ['countin', 10]);
  assert.strictEqual(TM.stateAt(9.5).countdown, 1);
  const s1 = TM.stateAt(10);
  assert.deepStrictEqual([s1.phase, s1.stage, s1.speed, s1.completedStages], ['running', 1, 8, 0]);
  assert.strictEqual(TM.stateAt(69.9).stage, 1);
  const s2 = TM.stateAt(70);
  assert.deepStrictEqual([s2.stage, s2.speed, s2.completedStages, s2.stageRemaining], [2, 8.5, 1, 60]);
  assert.strictEqual(TM.stateAt(10 + 60 * 9).stage, 10);
});

test('cues: a triple tone and a spoken line at each stage, ticks in the 3 s before it', () => {
  const ev = TM.progressiveEvents(3);
  const at = (t, kind) => ev.filter(e => e.t === t && e.kind === kind);
  assert.strictEqual(at(0, 'stage').length, 1);
  assert.strictEqual(at(60, 'stage')[0].say, 'Stage 2. Speed 8.5 kilometres per hour.');
  assert.deepStrictEqual(ev.filter(e => e.kind === 'tick' && e.t > 40 && e.t < 60).map(e => e.t), [57, 58, 59]);
  assert.strictEqual(ev[0].t, -TM.COUNTIN_SECONDS);
  assert.strictEqual(ev[ev.length - 1].kind, 'end');
  assert.strictEqual(ev[ev.length - 1].t, 180);
});

test('mph and incline are spoken only where they apply', () => {
  assert.strictEqual(TM.stageSpeech(2, { unit: 'mph' }), 'Stage 2. Speed 5.3 miles per hour.');
  assert.match(TM.stageSpeech(1, { incline: 1 }), /Incline 1 percent\.$/);
  assert.doesNotMatch(TM.stageSpeech(2, { incline: 1 }), /Incline/);
  assert.doesNotMatch(TM.stageSpeech(1), /Incline/);
});

test('a polling loop never plays an event twice or skips one (half-open windows)', () => {
  const ev = TM.progressiveEvents(3);
  let from = -20, got = [];
  for (let t = -19.9; t < 185; t += 0.1) { got = got.concat(TM.eventsBetween(ev, from, t)); from = t; }
  assert.strictEqual(got.length, ev.length);
});

test('12-minute cues: minute marks, halfway, last minute, a finish tone at 720 s', () => {
  const ev = TM.cooperEvents();
  assert.strictEqual(ev.filter(e => e.kind === 'minute').length, 11);
  assert.match(ev.find(e => e.t === 360).say, /Halfway/);
  const end = ev[ev.length - 1];
  assert.deepStrictEqual([end.kind, end.t], ['end', 720]);
});

test('WAV: valid RIFF/PCM header, exact length, tone at a cue and silence between', () => {
  const ev = TM.progressiveEvents(2);
  const wav = TM.renderWav(ev, { rate: 8000 });
  const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const str = (o, n) => String.fromCharCode(...wav.slice(o, o + n));
  assert.strictEqual(str(0, 4), 'RIFF'); assert.strictEqual(str(8, 4), 'WAVE'); assert.strictEqual(str(36, 4), 'data');
  assert.strictEqual(dv.getUint16(20, true), 1);          // PCM
  assert.strictEqual(dv.getUint16(22, true), 1);          // mono
  assert.strictEqual(dv.getUint32(24, true), 8000);
  assert.strictEqual(dv.getUint16(34, true), 8);          // 8-bit
  assert.strictEqual(dv.getUint32(40, true), wav.length - 44);
  assert.strictEqual(dv.getUint32(4, true), wav.length - 8);
  const sample = sec => wav.slice(44 + Math.round(sec * 8000), 44 + Math.round(sec * 8000) + 800);
  const loud = a => Math.max(...a.map(x => Math.abs(x - 128)));
  // stage 1 cue is at t=0, which is 10 s into the file (the count-in precedes it)
  assert.ok(loud(sample(10.02)) > 60, 'tone at the stage cue');
  assert.ok(loud(sample(10.7)) < 3, 'silence after the triple tone');
  assert.ok(loud(sample(40)) < 3, 'silence in the middle of a stage');
  assert.ok(loud(sample(70.02)) > 60, 'tone at the stage-2 cue');
  assert.ok(wav.length < 2e6);
});

test('our own cues: nothing here names or quotes a published test recording', () => {
  const all = JSON.stringify([TM.progressiveEvents(5), TM.cooperEvents()]).toLowerCase();
  for (const banned of ['fitnessgram', 'pacer', 'cooper institute', 'beep test', 'lap']) {
    assert.ok(!all.includes(banned), `cue text must not contain "${banned}"`);
  }
});
