import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { MinHeap } from '../src/sim/path.js';
import { buildScenario } from '../scripts/bench.mjs';

test('MinHeap pops ids in key order and grows past its capacity', () => {
  const h = new MinHeap(2);
  const keys = [5, 1, 9, 3, 3.5, 0, 7, 2, 8, 4, 6, 1e12, 0.25];
  keys.forEach((k, i) => h.push(k, i));
  assert.equal(h.size, keys.length);
  const out = [];
  while (h.size) out.push(keys[h.pop()]);
  assert.deepEqual(out, [...keys].sort((a, b) => a - b));
});

test('MinHeap clear() reuses the buffers', () => {
  const h = new MinHeap(4);
  h.push(2, 20);
  h.push(1, 10);
  h.clear();
  assert.equal(h.size, 0);
  h.push(3, 30);
  assert.equal(h.pop(), 30);
});

test('100 crew / 150 items: 10 simulated seconds stay well inside the tick budget', () => {
  const { world, drive } = buildScenario();
  assert.equal(world.crew.length, 100);
  assert.ok(world.items.list().length >= 150);
  for (let i = 0; i < 30; i++) world.tick(1 / 30);
  let total = 0;
  const n = 300;
  for (let i = 0; i < n; i++) {
    drive(i);
    const t0 = performance.now();
    world.tick(1 / 30);
    total += performance.now() - t0;
  }
  assert.ok(total / n < 8, `mean tick ${(total / n).toFixed(2)} ms`);
  assert.ok(world.crew.some((c) => c.state !== 'idle'), 'scenario keeps crew busy');
});
