import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const DT = 1 / 30;
const roles = (n) => Array.from({ length: n }, () => 'hauler');
const make = (opts = {}) => {
  const grid = loadLevel(JSON.parse(raw));
  grid.damageEdge(12, 5, 'W', 9999);
  return createWorld({ grid, roles: roles(10), ...opts });
};
const run = (world, seconds, until) => {
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    world.tick(DT);
    if (until?.()) return true;
  }
  return false;
};
const delivered = (w) => () => w.items.get('ceodesk').state === 'delivered';

test('10 crew whistle the weight-8 desk out to the truck', () => {
  const w = make();
  const log = [];
  w.events.on('whistle', (e) => log.push(['whistle', e.n]));
  w.events.on('pickup', () => log.push(['pickup']));
  w.events.on('deliver', () => log.push(['deliver']));
  const r = w.commands.whistle('ceodesk');
  assert.equal(r.ok, true);
  assert.equal(r.crewIds.length, 10);
  assert.ok(run(w, 120, delivered(w)));
  assert.deepEqual(log, [['whistle', 10], ['pickup'], ['deliver']]);
  assert.equal(w.job.delivered, 2000);
  assert.ok(w.crew.every((c) => c.state === 'idle'));
  assert.deepEqual(w.snapshot().whistles, []);
});

test('7 idle crew are not enough', () => {
  const w = make({ roles: roles(7) });
  assert.deepEqual(w.commands.whistle('ceodesk'), { ok: false, reason: 'not-enough-idle', needed: 8 });
  assert.ok(w.crew.every((c) => c.state === 'idle'));
});

test('unknown / placed checks', () => {
  const w = make();
  assert.equal(w.commands.whistle('nope').reason, 'not-placed');
  assert.equal(w.commands.whistle('ceodesk').ok, true);
  assert.equal(w.commands.whistle('ceodesk').reason, 'not-placed');
});

test('door still locked -> unreachable', () => {
  const w = createWorld({ grid: loadLevel(JSON.parse(raw)), roles: roles(10) });
  assert.equal(w.commands.whistle('ceodesk').reason, 'unreachable');
});

test('extra crew carry faster than exactly weight', () => {
  const time = (n) => {
    const w = make({ roles: roles(n) });
    assert.equal(w.commands.whistle('ceodesk').ok, true);
    let carryStart = null;
    for (let i = 0; i < 3600 && !delivered(w)(); i++) {
      w.tick(DT);
      if (carryStart === null && w.snapshot().whistles[0]?.phase === 'carry') carryStart = w.time;
    }
    assert.ok(delivered(w)());
    return w.time - carryStart;
  };
  assert.ok(time(12) < time(8));
});

test('phases converge -> heave -> carry, progress rises monotonically', () => {
  const w = make();
  w.commands.whistle('ceodesk');
  const phases = [];
  const prog = [];
  for (let i = 0; i < 3600 && !delivered(w)(); i++) {
    w.tick(DT);
    const s = w.snapshot().whistles[0];
    if (!s) break;
    assert.equal(s.needed, 8);
    assert.equal(s.n, 10);
    if (phases.at(-1) !== s.phase) phases.push(s.phase);
    if (s.phase === 'heave') {
      prog.push(s.progress);
      assert.ok(w.snapshot().crew.some((c) => c.pose === 'lift'));
    } else assert.equal(s.progress, 0);
  }
  assert.deepEqual(phases, ['converge', 'heave', 'carry']);
  assert.ok(prog.length > 5);
  assert.ok(prog.every((p, i) => i === 0 || p >= prog[i - 1]));
  assert.ok(prog.every((p) => p >= 0 && p <= 1));
});

test('blocking the route mid-carry drops the item', () => {
  const w = make();
  const blocked = [];
  w.events.on('blocked', (e) => blocked.push(e));
  w.commands.whistle('ceodesk');
  assert.ok(run(w, 120, () => w.snapshot().whistles[0]?.phase === 'carry'));
  for (const [x, y] of [[3, 9], [2, 9], [3, 8], [4, 9]]) {
    for (const s of ['W', 'N']) w.grid.setEdge(x, y, s, { type: 'wall', material: 'brick', hp: 400 });
  }
  w.grid.setEdge(4, 9, 'W', { type: 'wall', material: 'brick', hp: 400 });
  assert.doesNotThrow(() => run(w, 3));
  assert.equal(blocked.length, 1);
  assert.equal(w.items.get('ceodesk').state, 'placed');
  assert.ok(w.crew.every((c) => c.state === 'idle'));
  assert.deepEqual(w.snapshot().whistles, []);
});

test('whistleCancel releases crew and item', () => {
  const w = make();
  w.commands.whistle('ceodesk');
  run(w, 1);
  assert.equal(w.commands.whistleCancel('ceodesk'), true);
  assert.equal(w.commands.whistleCancel('ceodesk'), false);
  assert.equal(w.items.get('ceodesk').state, 'placed');
  assert.ok(w.crew.every((c) => c.state === 'idle'));
  assert.deepEqual(w.snapshot().whistles, []);
  assert.equal(w.commands.whistle('ceodesk').ok, true);
});

test('any role is recruited', () => {
  const r = ['breacher', 'breacher', 'rigger', 'decoy', 'hauler', 'hauler', 'hauler', 'hauler', 'hauler'];
  const w = make({ roles: r });
  const res = w.commands.whistle('ceodesk');
  assert.equal(res.ok, true);
  assert.equal(res.crewIds.length, 9);
  assert.ok(run(w, 120, delivered(w)));
});

test('deterministic', () => {
  const go = () => {
    const w = make();
    w.commands.whistle('ceodesk');
    run(w, 20);
    return JSON.stringify(w.snapshot());
  };
  assert.equal(go(), go());
});
