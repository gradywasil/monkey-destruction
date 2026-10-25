import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';
import { makePolicy } from '../scripts/auto-sim.mjs';

const DT = 1 / 30;
const level = (f) => loadLevel(JSON.parse(readFileSync(new URL(`../src/data/levels/${f}.json`, import.meta.url), 'utf8')));

/** policy(world) -> fn run every 0.5 s */
const run = (file, mk, { seed = 1, minutes = 40 } = {}) => {
  const world = createWorld({ grid: level(file), auto: true, seed });
  const policy = mk(world);
  let cleared = null;
  const bailouts = [];
  world.events.on('cleared', (e) => { cleared = e; });
  world.events.on('bailout', (e) => bailouts.push(e));
  for (let i = 0, n = Math.round(minutes * 60 / DT); i < n && !cleared; i++) {
    if (i % 15 === 0) policy();
    world.tick(DT);
  }
  return { world, cleared, bailouts };
};

const greedy = (world) => () => {
  const s = world.snapshot();
  let h = s.hire.roles.hauler.count;
  if (h < 8) while (h < 8 && world.commands.hire('hauler').ok) h++;
  if (h >= 4) world.commands.hire('breacher');
};

const levels = ['dunmore-pike', 'fairfax-credit-union', 'gilded-trust-tower'];

for (const f of levels) {
  test(`greedy hauler-heavy policy clears ${f} with <=3 advances`, () => {
    const { world, cleared, bailouts } = run(f, greedy);
    assert.ok(cleared, `not cleared, stripped ${world.snapshot().economy.stripped}`);
    assert.ok(bailouts.length <= 3);
    const e = world.snapshot().economy;
    assert.equal(e.advances, bailouts.length);
    assert.equal(cleared.profit, Math.max(0, e.cash - e.advanced));
  });
}

test('sensible policy never needs an advance', () => {
  for (const f of levels) {
    const { cleared, bailouts } = run(f, (w) => makePolicy(w));
    assert.ok(cleared);
    assert.equal(bailouts.length, 0, f);
  }
});

test('hire-nothing policy does not crash and advances stay capped and labelled', () => {
  const { world, bailouts } = run('dunmore-pike', () => () => {}, { minutes: 15 });
  assert.ok(bailouts.length <= 3);
  for (const b of bailouts) assert.ok(b.amount > 0 && b.reason);
  assert.ok(world.snapshot().economy.advanced >= 0);
});

test('no advance in the first 30 s', () => {
  const { bailouts } = run('dunmore-pike', () => () => {}, { minutes: 0.5 });
  assert.equal(bailouts.length, 0);
});

test('deterministic with a seed', () => {
  const a = run('dunmore-pike', greedy, { seed: 7 });
  const b = run('dunmore-pike', greedy, { seed: 7 });
  assert.deepEqual(a.bailouts, b.bailouts);
  assert.equal(a.cleared?.elapsed, b.cleared?.elapsed);
});

test('classic mode never emits bailout', () => {
  const world = createWorld({ grid: level('dunmore-pike'), seed: 1 });
  let n = 0;
  world.events.on('bailout', () => n++);
  for (let i = 0; i < 30 * 60 * 3; i++) world.tick(DT);
  assert.equal(n, 0);
  assert.equal(world.snapshot().auto, false);
});
