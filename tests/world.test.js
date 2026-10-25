import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';
import { createJob } from '../src/sim/job.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const DT = 1 / 30;
const make = (opts = {}) => createWorld({ grid: loadLevel(JSON.parse(raw)), ...opts });
const run = (world, seconds, until) => {
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    world.tick(DT);
    if (until?.()) return true;
  }
  return false;
};
const delivered = (world, id) => () => world.items.get(id).state === 'delivered';

test('weight-1 chair is hauled to the truck', () => {
  const w = make();
  const seen = [];
  w.events.on('deliver', (e) => seen.push(e));
  const r = w.commands.haul('frontchair');
  assert.equal(r.ok, true);
  assert.equal(r.crewIds.length, 1);
  assert.ok(run(w, 60, delivered(w, 'frontchair')));
  assert.equal(w.job.delivered, 40);
  assert.equal(seen[0].value, 40);
  assert.ok(w.crew.every((c) => c.state === 'idle'));
});

test('weight-2 copier uses two crew', () => {
  const w = make();
  const r = w.commands.haul('copier1');
  assert.equal(r.ok, true);
  assert.equal(r.crewIds.length, 2);
  assert.ok(run(w, 90, delivered(w, 'copier1')));
  assert.equal(w.job.delivered, 220);
});

test('safe: not-enough-idle, locked CEO door, then delivers', () => {
  const w = make({ roles: Array(6).fill('hauler') });
  assert.equal(w.commands.haul('frontchair').ok, true);
  assert.equal(w.commands.haul('safe1').reason, 'not-enough-idle');
  run(w, 60, delivered(w, 'frontchair'));
  assert.equal(w.commands.haul('safe1').reason, 'unreachable');
  w.grid.damageEdge(12, 5, 'W', 9999);
  const r = w.commands.haul('safe1');
  assert.equal(r.ok, true);
  assert.equal(r.crewIds.length, 6);
  assert.ok(run(w, 180, delivered(w, 'safe1')));
});

test('server room is gated by the drywall partition', () => {
  const w = make({ roles: Array(6).fill('hauler') });
  assert.equal(w.commands.haul('rack3').reason, 'unreachable');
  w.grid.damageEdge(7, 3, 'W', 9999);
  assert.equal(w.commands.haul('rack3').ok, true);
  assert.ok(run(w, 180, delivered(w, 'rack3')));
});

test('wall broken mid-walk: crew re-path and still deliver', () => {
  const w = make();
  assert.equal(w.commands.haul('cab2').ok, true);
  run(w, 1.5);
  w.grid.damageEdge(7, 9, 'W', 9999);
  w.grid.damageEdge(7, 8, 'W', 9999);
  assert.ok(run(w, 90, delivered(w, 'cab2')));
});

test('carry is re-pathed when the route is blocked and dropped if impossible', () => {
  const w = make();
  const blocked = [];
  w.events.on('blocked', (e) => blocked.push(e));
  w.commands.haul('frontchair');
  run(w, 60, () => w.crew.some((c) => c.state === 'carrying'));
  w.grid.setEdge(4, 8, 'W', { type: 'wall', material: 'brick', hp: 400 });
  w.grid.setEdge(4, 9, 'W', { type: 'wall', material: 'brick', hp: 400 });
  run(w, 2);
  assert.equal(blocked.length, 1);
  assert.equal(w.items.get('frontchair').state, 'placed');
  assert.ok(w.crew.every((c) => c.state === 'idle'));
});

test('busy crew cannot be double-assigned', () => {
  const w = make();
  const a = w.commands.haul('frontchair');
  assert.equal(w.commands.haul('frontchair').reason, 'not-placed');
  assert.equal(w.commands.haulWith(a.crewIds, 'plant2').reason, 'not-enough-idle');
  const b = w.commands.haul('plant2');
  assert.equal(b.ok, true);
  assert.notDeepEqual(a.crewIds, b.crewIds);
  assert.equal(w.commands.cancel(a.crewIds[0]), true);
  assert.equal(w.items.get('frontchair').state, 'placed');
});

test('timer ends the job and blocks commands; star thresholds', () => {
  const w = make();
  let up = 0;
  w.events.on('timeup', () => up++);
  run(w, 900);
  assert.equal(w.job.state, 'ended');
  assert.equal(up, 1);
  assert.equal(w.commands.haul('frontchair').reason, 'ended');
  const j = createJob({ quota: 1000 });
  assert.equal(j.stars(), 0);
  j.delivered = 1000; assert.equal(j.stars(), 1);
  j.delivered = 1250; assert.equal(j.stars(), 2);
  j.delivered = 1500; assert.equal(j.stars(), 3);
});

test('deterministic with the same seed and script', () => {
  const script = (w) => {
    w.commands.haul('frontchair');
    run(w, 5);
    w.commands.haul('copier1');
    run(w, 10);
    w.grid.damageEdge(7, 3, 'W', 9999);
    w.commands.haul('mon1');
    run(w, 15);
    return w.snapshot();
  };
  assert.deepEqual(script(make({ seed: 7 })), script(make({ seed: 7 })));
});

test('snapshot shape and carry pose', () => {
  const w = make();
  const s = w.snapshot();
  assert.equal(s.crew.length, 12);
  assert.deepEqual(Object.keys(s.crew[0]).sort(), ['carrying', 'facing', 'id', 'pose', 'role', 'x', 'y']);
  assert.equal(s.crew[0].x, 0.5);
  assert.equal(s.crew[0].y, 8.5);
  assert.equal(s.state, 'running');
  assert.equal(s.timeLeft, 900);
  assert.ok(s.quota > 0);
  w.commands.haul('frontchair');
  assert.ok(run(w, 60, () => w.snapshot().carried.length > 0));
  const c = w.snapshot();
  const carrier = c.crew.find((m) => m.carrying === 'frontchair');
  assert.equal(carrier.pose, 'carry');
  assert.deepEqual(Object.keys(c.carried[0]).sort(), ['id', 'kind', 'weight', 'x', 'y', 'z']);
  assert.equal(c.carried[0].z, 1.1);
  assert.equal(c.carried[0].x, carrier.x);
});
