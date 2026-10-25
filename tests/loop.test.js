import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoop } from '../src/loop.js';

function harness(opts = {}) {
  let t = 0;
  let cb = null;
  const calls = { update: 0, render: 0 };
  const alphas = [];
  const loop = createLoop({
    update: () => { calls.update++; },
    render: (a) => { calls.render++; alphas.push(a); },
    raf: { request: (f) => { cb = f; return 1; }, cancel: () => { cb = null; } },
    now: () => t,
    ...opts,
  });
  const frame = (ms) => {
    t += ms;
    const f = cb;
    cb = null;
    if (f) f();
  };
  return { loop, calls, alphas, frame, hasCb: () => cb !== null };
}

test('100ms frames at 30hz give 3 updates each', () => {
  const h = harness();
  h.loop.start();
  h.frame(100);
  assert.equal(h.calls.update, 3);
  h.frame(100);
  h.frame(100);
  assert.equal(h.calls.update, 9);
});

test('alpha is within [0,1)', () => {
  const h = harness();
  h.loop.start();
  for (const ms of [16, 33, 100, 7, 250]) h.frame(ms);
  assert.ok(h.alphas.length === 5);
  for (const a of h.alphas) assert.ok(a >= 0 && a < 1);
});

test('5s stall is clamped to maxSteps', () => {
  const h = harness();
  h.loop.start();
  h.frame(5000);
  assert.ok(h.calls.update <= 5);
  assert.equal(h.loop.stats.steps, h.calls.update);
});

test('stop halts callbacks', () => {
  const h = harness();
  h.loop.start();
  h.frame(100);
  h.loop.stop();
  const u = h.calls.update;
  const r = h.calls.render;
  h.frame(100);
  assert.equal(h.calls.update, u);
  assert.equal(h.calls.render, r);
  assert.equal(h.loop.isRunning(), false);
  assert.equal(h.hasCb(), false);
});

test('stats.steps reflects the last frame', () => {
  const h = harness();
  h.loop.start();
  h.frame(100);
  assert.equal(h.loop.stats.steps, 3);
  h.frame(10);
  assert.equal(h.loop.stats.steps, 0);
  assert.equal(h.loop.stats.frame, 2);
});
