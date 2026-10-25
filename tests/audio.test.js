import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio, createVoiceLimiter, musicPattern, tierForValue, tierPitch, midiToHz, scheduleSteps } from '../src/platform/audio.js';
import { createShake } from '../src/render/fx.js';

const node = () => ({ connect() {}, start() {}, stop() {}, gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, getChannelData: () => new Float32Array(8) });
const fakeCtx = () => ({ currentTime: 0, sampleRate: 100, state: 'suspended', destination: {}, resumed: 0, resume() { this.resumed++; }, createGain: node, createOscillator: node, createBufferSource: node, createBiquadFilter: node, createBuffer: node });

test('tiers and pitch', () => {
  assert.equal(tierForValue(10), 0);
  assert.ok(tierForValue(600) > tierForValue(100));
  assert.ok(tierPitch(3) > tierPitch(1));
  assert.equal(midiToHz(69), 440);
});

test('voice limiter caps and rate-limits', () => {
  const l = createVoiceLimiter({ max: 2, minGap: { hit: 0.1 } });
  assert.ok(l.request('a', 0, 1));
  assert.ok(l.request('b', 0, 1));
  assert.ok(!l.request('c', 0.1, 1));
  assert.ok(l.request('c', 1.1, 1));
  assert.ok(l.request('hit', 2, 0.01));
  assert.ok(!l.request('hit', 2.05, 0.01));
  assert.ok(l.request('hit', 2.2, 0.01));
});

test('music pattern is 16 bars and deterministic', () => {
  const p = musicPattern();
  assert.equal(p.length, 128);
  assert.deepEqual(p, musicPattern());
  assert.ok(p.some((s) => s.bass != null) && p.some((s) => s.arp != null));
});

test('scheduleSteps wraps and advances', () => {
  const r = scheduleSteps({ nextTime: 0, index: 6, now: 0, stepDur: 0.1, total: 8, lookahead: 0.35 });
  assert.deepEqual(r.due.map((d) => d.index), [6, 7, 0, 1]);
  assert.equal(r.index, 2);
});

test('audio lazily creates context, respects mute', () => {
  let made = 0;
  let on = false;
  const ctx = fakeCtx();
  const a = createAudio({ getEnabled: () => on, ctxFactory: () => (made++, ctx) });
  assert.equal(a.play('tap'), false);
  assert.equal(made, 0);
  on = true;
  assert.ok(a.unlock());
  assert.equal(ctx.resumed, 1);
  assert.ok(a.play('deliver', { tier: 3 }));
  on = false;
  assert.equal(a.play('break'), false);
  a.refresh();
  a.startMusic();
  a.pauseMusic();
  assert.equal(made, 1);
});

test('shake decays to zero, integer offsets, reduceMotion disables', () => {
  const s = createShake({ rand: () => 0.9 });
  s.kick(4);
  const o = s.offset();
  assert.ok(Number.isInteger(o.x) && Number.isInteger(o.y));
  for (let i = 0; i < 30; i++) s.update(1 / 30);
  assert.deepEqual(s.offset(), { x: 0, y: 0 });
  const r = createShake({ reduceMotion: () => true });
  r.kick(5);
  assert.equal(r.amplitude, 0);
});
