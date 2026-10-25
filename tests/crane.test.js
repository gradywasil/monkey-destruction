import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';
import { computeModifiers } from '../src/sim/modifiers.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const DT = 1 / 30;
const make = (ids = ['crane-helicopter']) => createWorld({ grid: loadLevel(JSON.parse(raw)), modifiers: computeModifiers(ids) });
const run = (w, seconds, until) => {
  for (let i = 0; i < Math.round(seconds * 30); i++) {
    w.tick(DT);
    if (until?.()) return true;
  }
  return false;
};
const done = (w, id) => () => w.items.get(id).state === 'delivered';

test('crane reasons: locked, too-light, unknown, busy, cooldown', () => {
  assert.equal(make([]).commands.crane('safe1').reason, 'locked');
  assert.equal(make([]).snapshot().crane.unlocked, false);
  const w = make();
  assert.equal(w.snapshot().crane.state, 'idle');
  assert.equal(w.snapshot().crane.x, null);
  assert.equal(w.commands.crane('mgrchair').reason, 'too-light');
  assert.equal(w.commands.crane('nope').reason, 'unknown-item');
  assert.deepEqual(w.commands.crane('safe1'), { ok: true });
  const other = w.items.list().find((it) => it.weight >= 3 && it.id !== 'safe1');
  assert.equal(w.commands.crane(other.id).reason, 'busy');
  assert.ok(run(w, 60, done(w, 'safe1')));
  assert.equal(w.commands.crane(other.id).reason, 'busy');
  assert.ok(run(w, 30, () => w.snapshot().crane.state === 'idle'));
  assert.equal(w.commands.crane(other.id).reason, 'cooldown');
});

test('airlifts the safe from the locked CEO suite without touching the door', () => {
  const w = make();
  const door = { ...w.grid.edge(12, 5, 'W') };
  const ev = [];
  for (const t of ['crane', 'craneLift', 'deliver']) w.events.on(t, (e) => ev.push([t, e]));
  const safe = w.items.get('safe1');
  assert.equal(w.grid.isWalkable(14, 4), false);
  assert.equal(w.commands.crane('safe1').ok, true);
  const s0 = w.snapshot().crane;
  assert.equal(s0.state, 'inbound');
  assert.equal(s0.itemId, 'safe1');
  assert.ok(Math.abs(s0.x - (safe.x + safe.w / 2 - 14)) < 1e-9 && s0.z === 4);
  assert.equal(w.commands.haul('safe1').ok, false);
  assert.equal(w.commands.whistle('safe1').ok, false);
  const v0 = w.grid.version;
  const states = [];
  let lastProg = -1;
  let saw = false;
  assert.ok(run(w, 60, () => {
    const c = w.snapshot().crane;
    if (states.at(-1) !== c.state) states.push(c.state);
    if (c.state === 'lift') {
      assert.ok(c.progress >= lastProg);
      lastProg = c.progress;
    }
    if (c.state === 'outbound' && !saw) {
      saw = true;
      assert.ok(w.grid.version > v0);
      assert.equal(w.grid.isWalkable(14, 4), true);
      const car = w.snapshot().carried.find((x) => x.id === 'safe1');
      assert.ok(car && Math.abs(car.z - 2.4) < 1e-9 && car.x === c.x);
    }
    return c.state === 'idle';
  }));
  assert.deepEqual(states, ['inbound', 'lift', 'outbound', 'exit', 'idle']);
  assert.equal(safe.state, 'delivered');
  assert.equal(w.job.delivered, 1500);
  assert.deepEqual(ev.map((e) => e[0]), ['crane', 'craneLift', 'deliver']);
  assert.deepEqual(ev[2][1].value, 1500);
  assert.deepEqual(w.grid.edge(12, 5, 'W'), door);
  assert.ok(w.snapshot().crane.cooldown > 0);
});

test('value uses the shredder multiplier', () => {
  const w = make(['crane-helicopter', 'shredder-truck']);
  let e;
  w.events.on('deliver', (x) => { e = x; });
  w.commands.crane('safe1');
  assert.ok(run(w, 60, done(w, 'safe1')));
  assert.equal(e.base, 1500);
  assert.equal(e.value, Math.round(1500 * 1.25));
  assert.equal(w.job.delivered, e.value);
});

test('cooldown counts down and a second airlift is accepted', () => {
  const w = make();
  const heavy = w.items.list().filter((it) => it.weight >= 3).map((it) => it.id);
  w.commands.crane(heavy[0]);
  assert.ok(run(w, 60, done(w, heavy[0])));
  const c1 = w.snapshot().crane.cooldown;
  run(w, 5);
  const c2 = w.snapshot().crane.cooldown;
  assert.ok(c2 < c1 && Math.abs(c1 - c2 - 5) < 0.01);
  assert.ok(run(w, 60, () => w.snapshot().crane.cooldown === 0));
  assert.deepEqual(w.commands.crane(heavy[1]), { ok: true });
});

test('freezes when the job ends; deterministic', () => {
  const trace = () => {
    const w = createWorld({ grid: loadLevel(JSON.parse(raw)), duration: 2, modifiers: computeModifiers(['crane-helicopter']) });
    w.commands.crane('safe1');
    run(w, 1.9);
    const a = JSON.stringify(w.snapshot().crane);
    run(w, 3);
    const b = w.snapshot().crane;
    assert.equal(w.commands.crane('safe1').reason, 'ended');
    return [a, JSON.stringify(b)];
  };
  const [a, b] = trace();
  assert.notEqual(a, b);
  const [a2, b2] = trace();
  assert.equal(a, a2);
  assert.equal(b, b2);
  const w = make();
  w.commands.crane('safe1');
  run(w, 2);
  const x = w.snapshot().crane.x;
  w.job.state = 'ended';
  run(w, 2);
  assert.equal(w.snapshot().crane.x, x);
});
