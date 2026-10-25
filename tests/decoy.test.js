import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const DT = 1 / 30;
const ROLES = ['breacher', 'hauler', 'hauler', 'hauler', 'rigger', 'decoy'];
const make = (opts = {}) => createWorld({ grid: loadLevel(JSON.parse(raw)), roles: ROLES, ...opts });
const run = (world, seconds, until, each) => {
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    each?.();
    world.tick(DT);
    if (until?.()) return true;
  }
  return false;
};
const insp = (w) => w.inspectors[0];
const decoyOf = (w) => w.crew.find((c) => c.role === 'decoy');
const engaged = (w) => w.snapshot().decoys.some((d) => d.state === 'engaged');

test('decoy intercepts the patrolling inspector and holds him in place', () => {
  const w = make();
  const log = [];
  for (const t of ['decoy', 'stallStart', 'stallEnd']) w.events.on(t, () => log.push(t));
  run(w, 2);
  const r = w.commands.decoy(insp(w).id);
  assert.deepEqual(r, { ok: true, crewId: decoyOf(w).id });
  assert.ok(run(w, 20, () => engaged(w)));
  assert.deepEqual(log, ['decoy', 'stallStart']);
  const s = w.snapshot();
  assert.equal(s.crew.find((c) => c.id === r.crewId).pose, 'stall');
  const p = { x: insp(w).x, y: insp(w).y };
  run(w, 3);
  assert.ok(Math.hypot(insp(w).x - p.x, insp(w).y - p.y) < 0.05);
  assert.equal(insp(w).state, 'stalled');
  assert.ok(w.snapshot().decoys[0].stamina < 10);
});

test('no fine while engaged even with visible work', () => {
  const w = make();
  const fake = w.crew.find((c) => c.role === 'hauler');
  w.commands.decoy(insp(w).id);
  const fines = [];
  w.events.on('fine', (e) => fines.push(e));
  assert.ok(run(w, 20, () => engaged(w)));
  run(w, 8, null, () => {
    const i = insp(w);
    fake.state = 'carrying';
    fake.x = i.x + i.hx * 1.5;
    fake.y = i.y + i.hy * 1.5;
  });
  assert.equal(fines.length, 0);
  assert.equal(w.job.fines, 0);
  assert.equal(insp(w).meter, 0);
});

test('shooed after 10s, tired for 8s, then refills and is idle again', () => {
  const w = make();
  const done = [];
  w.events.on('decoyDone', (e) => done.push(e));
  const ends = [];
  w.events.on('stallEnd', (e) => ends.push(e));
  const id = insp(w).id;
  w.commands.decoy(id);
  assert.ok(run(w, 20, () => engaged(w)));
  assert.ok(run(w, 12, () => done.length > 0));
  assert.deepEqual(done, [{ crewId: decoyOf(w).id, inspectorId: id, reason: 'shooed' }]);
  assert.equal(ends.length, 1);
  assert.equal(w.snapshot().decoys[0].state, 'tired');
  assert.equal(w.snapshot().crew.find((c) => c.role === 'decoy').pose, 'idle');
  assert.deepEqual(w.commands.decoy(id), { ok: false, reason: 'tired' });
  assert.deepEqual(w.commands.decoy(id, decoyOf(w).id), { ok: false, reason: 'tired' });
  run(w, 7.5);
  assert.equal(w.commands.decoy(id).reason, 'tired');
  run(w, 0.7);
  assert.equal(decoyOf(w).state, 'idle');
  assert.deepEqual(w.snapshot().decoys, []);
  assert.equal(w.commands.decoy(id).ok, true);
  assert.equal(w.snapshot().decoys[0].stamina, 10);
});

test('inspector resumes patrol after the decoy leaves and is immune for 3s', () => {
  const w = make();
  const id = insp(w).id;
  w.commands.decoy(id);
  assert.ok(run(w, 20, () => engaged(w)));
  assert.ok(run(w, 12, () => w.snapshot().decoys[0].state === 'tired'));
  assert.ok(run(w, 1, () => insp(w).state === 'patrol'));
  assert.ok(insp(w).immune > 2.5);
  const p = { x: insp(w).x, y: insp(w).y };
  run(w, 2);
  assert.ok(Math.hypot(insp(w).x - p.x, insp(w).y - p.y) > 0.5);
});

test('cancelDecoy releases immediately and keeps stamina', () => {
  const w = make();
  const id = insp(w).id;
  const ends = [];
  w.events.on('stallEnd', (e) => ends.push(e));
  w.commands.decoy(id);
  assert.ok(run(w, 20, () => engaged(w)));
  run(w, 2);
  assert.equal(w.commands.cancelDecoy(decoyOf(w).id), true);
  assert.equal(ends.length, 1);
  assert.equal(decoyOf(w).state, 'idle');
  assert.equal(w.commands.cancelDecoy(decoyOf(w).id), false);
  assert.deepEqual(w.snapshot().decoys, []);
  assert.equal(w.commands.decoy(id).ok, true);
  const st = w.snapshot().decoys[0].stamina;
  assert.ok(st < 8.5 && st > 7.5);
});

test('reasons: not-found, no-decoy, ended', () => {
  const w = make();
  assert.deepEqual(w.commands.decoy('nobody'), { ok: false, reason: 'not-found' });
  assert.deepEqual(w.commands.decoy(insp(w).id, 'c1'), { ok: false, reason: 'no-decoy' });
  const none = make({ roles: ['hauler', 'hauler', 'rigger'] });
  assert.deepEqual(none.commands.decoy(insp(none).id), { ok: false, reason: 'no-decoy' });
  assert.equal(w.commands.decoy(insp(w).id).ok, true);
  assert.deepEqual(w.commands.decoy(insp(w).id), { ok: false, reason: 'no-decoy' });
  const e = make({ duration: 1 });
  run(e, 2);
  assert.deepEqual(e.commands.decoy(insp(e).id), { ok: false, reason: 'ended' });
});

test('the whistle does not recruit a chasing decoy', () => {
  const roles = Array(8).fill('hauler').concat('decoy');
  const grid = loadLevel(JSON.parse(raw));
  grid.damageEdge(12, 5, 'W', 9999);
  const w = createWorld({ grid, roles });
  assert.equal(w.commands.decoy(insp(w).id).ok, true);
  run(w, 0.5);
  const r = w.commands.whistle('ceodesk');
  assert.equal(r.ok, true);
  assert.ok(!r.crewIds.includes(decoyOf(w).id));
  assert.equal(r.crewIds.length, 8);
});

test('deterministic', () => {
  const play = () => {
    const w = make();
    run(w, 1);
    w.commands.decoy(insp(w).id);
    run(w, 30);
    return JSON.stringify(w.snapshot());
  };
  assert.equal(play(), play());
});
