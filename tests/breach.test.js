import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const DT = 1 / 30;
const ROLES = ['breacher', 'hauler', 'hauler', 'hauler', 'rigger', 'decoy'];
const make = (opts = {}) => createWorld({ grid: loadLevel(JSON.parse(raw)), roles: ROLES, ...opts });
const run = (world, seconds, until) => {
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    world.tick(DT);
    if (until?.()) return true;
  }
  return false;
};
const broken = (w, x, y, s) => () => !!w.grid.edge(x, y, s).broken;

test('breacher smashes the drywall partition in 2 hits', () => {
  const w = make();
  const log = [];
  w.events.on('hit', (e) => log.push(['hit', e.hp, e.maxHp]));
  w.events.on('break', (e) => log.push(['break', e.material]));
  assert.equal(w.path.findPath(6, 3, 8, 3), null);
  const r = w.commands.breach({ x: 7, y: 3, side: 'W' });
  assert.deepEqual(r, { ok: true, crewIds: ['c0'] });
  assert.equal(w.commands.breach({ x: 7, y: 3, side: 'W' }).reason, 'already');
  assert.ok(run(w, 30, () => w.snapshot().crew[0].pose === 'hit'));
  assert.equal(w.snapshot().breaches.length, 1);
  assert.deepEqual(w.snapshot().breaches[0], { edge: { x: 7, y: 3, side: 'W' }, hp: 40, maxHp: 40 });
  assert.ok(run(w, 10, broken(w, 7, 3, 'W')));
  assert.deepEqual(log, [['hit', 20, 40], ['hit', 0, 40], ['break', 'drywall']]);
  assert.notEqual(w.path.findPath(6, 3, 8, 3), null);
  assert.equal(w.crew[0].state, 'idle');
  assert.deepEqual(w.snapshot().breaches, []);
});

test('locked CEO door takes 6 hits, then the safe is haulable', () => {
  const w = make();
  let hits = 0;
  w.events.on('hit', () => hits++);
  assert.equal(w.commands.breach({ x: 12, y: 5, side: 'W' }).ok, true);
  assert.ok(run(w, 60, broken(w, 12, 5, 'W')));
  assert.equal(hits, 6);
  assert.equal(w.crew[0].state, 'idle');
  const h = createWorld({ grid: w.grid, roles: Array(6).fill('hauler') });
  assert.equal(h.commands.haul('safe1').ok, true);
});

test('failure reasons and role gating', () => {
  const w = make();
  assert.equal(w.commands.breach({ x: 4, y: 3, side: 'W' }).reason, 'too-tough');
  assert.equal(w.commands.breach({ x: 10, y: 10, side: 'W' }).reason, 'not-breachable');
  assert.equal(w.commands.breach({ x: 7, y: 3, side: 'W' }, ['c1']).reason, 'wrong-role');
  assert.equal(w.commands.haulWith(['c0'], 'frontchair').reason, 'wrong-role');
  assert.equal(w.commands.breach({ x: 7, y: 3, side: 'W' }).ok, true);
  assert.equal(w.commands.breach({ x: 7, y: 4, side: 'W' }).reason, 'no-breacher');
  assert.equal(w.commands.cancelBreach('c0'), true);
  assert.equal(w.crew[0].state, 'idle');
  assert.equal(make({ roles: ['hauler'] }).commands.breach({ x: 7, y: 3, side: 'W' }).reason, 'no-breacher');
});

test('breach is deterministic', () => {
  const script = (w) => {
    w.commands.breach({ x: 7, y: 3, side: 'W' });
    w.commands.haul('frontchair');
    run(w, 20);
    return w.snapshot();
  };
  assert.deepEqual(script(make({ seed: 3 })), script(make({ seed: 3 })));
});
