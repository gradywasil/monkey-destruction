import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel, parseLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';
import { canSee } from '../src/sim/inspector.js';

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
const shadow = (w, c, state) => () => {
  const i = insp(w);
  c.state = state;
  c.x = i.x + i.hx * 1.5;
  c.y = i.y + i.hy * 1.5;
};

test('level validates inspectors', () => {
  const lv = JSON.parse(raw);
  lv.inspectors = [{ id: 'x', path: [{ x: 5, y: 8 }], speed: 1 }];
  assert.throws(() => parseLevel(lv), /2 waypoints/);
  lv.inspectors = [{ id: 'x', path: [{ x: 5, y: 8 }, { x: 15, y: 0 }], speed: 1 }];
  assert.throws(() => parseLevel(lv), /not walkable/);
});

test('patrol loop is reachable and returns to the first waypoint', () => {
  const w = make();
  const i = insp(w);
  const wps = i.waypoints;
  for (let k = 0; k < wps.length; k++) {
    const a = wps[k];
    const b = wps[(k + 1) % wps.length];
    assert.ok(w.path.findPath(a.x, a.y, b.x, b.y), `leg ${k}`);
  }
  const visited = new Set();
  let left = false;
  const back = run(w, 60, () => {
    const t = `${Math.floor(i.x)},${Math.floor(i.y)}`;
    visited.add(t);
    if (t !== '5,8') left = true;
    return left && t === '5,8';
  });
  assert.ok(back);
  assert.ok(visited.has('9,5') && visited.has('13,3'));
  const s = w.snapshot().inspectors[0];
  assert.ok(Math.abs(Math.hypot(s.hx, s.hy) - 1) < 1e-9);
  assert.ok(['left', 'right'].includes(s.facing));
});

test('canSee: open, behind, through a wall', () => {
  const g = loadLevel(JSON.parse(raw));
  const me = { x: 8.5, y: 5.5, hx: 1, hy: 0 };
  assert.equal(canSee(g, me, 11.5, 5.5), true);
  assert.equal(canSee(g, me, 10.5, 6.5), true);
  assert.equal(canSee(g, me, 7.5, 5.5), false);
  assert.equal(canSee(g, me, 8.5, 7.5), false);
  assert.equal(canSee(g, { x: 8.5, y: 3.5, hx: 1, hy: 0 }, 14.5, 3.5), false);
  assert.equal(canSee(g, { x: 6.5, y: 3.5, hx: 1, hy: 0 }, 8.5, 3.5), false);
});

test('visible carrier is fined $150, immunity, then $225', () => {
  const w = make();
  const c = w.crew[1];
  const fines = [];
  const alerts = [];
  w.events.on('fine', (e) => fines.push(e));
  w.events.on('alert', (e) => alerts.push(e));
  const each = shadow(w, c, 'carrying');
  run(w, 3, () => insp(w).meter > 0, each);
  assert.ok(insp(w).meter > 0);
  assert.ok(run(w, 10, () => fines.length === 1, each));
  assert.deepEqual(fines[0], { inspectorId: 'insp1', amount: 150, total: 150 });
  assert.equal(w.job.fines, 150);
  assert.equal(alerts.length, 1);
  assert.equal(w.snapshot().inspectors[0].state, 'fine');
  assert.equal(w.snapshot().inspectors[0].meter, 0);
  run(w, 3.5 + 4.8, null, each);
  assert.equal(fines.length, 1);
  assert.ok(run(w, 10, () => fines.length === 2, each));
  assert.equal(fines[1].amount, 225);
  assert.equal(w.snapshot().fines, 375);
});

test('idle crew in view do not raise the meter', () => {
  const w = make();
  run(w, 10, null, shadow(w, w.crew[1], 'idle'));
  assert.equal(insp(w).meter, 0);
  assert.equal(w.job.fines, 0);
});

test('stall stops him, zeroes the meter, then he resumes', () => {
  const w = make();
  const each = shadow(w, w.crew[1], 'carrying');
  assert.ok(run(w, 10, () => insp(w).meter > 10, each));
  assert.equal(w.commands.inspector.stall('nope', 2), false);
  assert.equal(w.commands.inspector.stall('insp1', 2), true);
  assert.equal(w.commands.inspector.stall('insp1', 1), true);
  const at = { x: insp(w).x, y: insp(w).y };
  run(w, 1.9, null, each);
  assert.equal(insp(w).state, 'stalled');
  assert.equal(insp(w).meter, 0);
  assert.deepEqual({ x: insp(w).x, y: insp(w).y }, at);
  run(w, 0.2, null, each);
  assert.notEqual(insp(w).state, 'stalled');
  run(w, 3, null);
  assert.notDeepEqual({ x: insp(w).x, y: insp(w).y }, at);
});

test('net() and stars use net', () => {
  const w = make({ quota: 100 });
  w.job.delivered = 150;
  assert.equal(w.job.stars(), 3);
  w.job.fines = 30;
  assert.equal(w.job.net(), 120);
  assert.equal(w.job.stars(), 1);
  w.job.fines = 500;
  assert.equal(w.job.net(), 0);
  assert.equal(w.snapshot().delivered, 150);
  assert.equal(w.snapshot().net, 0);
});

test('ended job freezes him', () => {
  const w = make({ duration: 1 });
  run(w, 2);
  const at = { ...w.snapshot().inspectors[0] };
  run(w, 3);
  assert.deepEqual(w.snapshot().inspectors[0], at);
});

test('deterministic', () => {
  const go = () => {
    const w = make();
    run(w, 20, null, shadow(w, w.crew[1], 'carrying'));
    return JSON.stringify(w.snapshot());
  };
  assert.equal(go(), go());
});
