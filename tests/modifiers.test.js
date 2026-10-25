import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';
import { computeModifiers, NO_MODIFIERS } from '../src/sim/modifiers.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const DT = 1 / 30;
const make = (opts = {}) => createWorld({ grid: loadLevel(JSON.parse(raw)), ...opts });
const run = (w, seconds, until) => {
  for (let i = 0, n = Math.round(seconds * 30); i < n; i++) {
    w.tick(DT);
    if (until?.()) return w.time;
  }
  return null;
};
const haulers = (n) => Array.from({ length: n }, () => 'hauler');
const done = (w, id) => () => w.items.get(id).state === 'delivered';

test('computeModifiers sums effects and ignores unknown ids', () => {
  assert.deepEqual(computeModifiers([]), NO_MODIFIERS);
  const m = computeModifiers(['bionic-legs-1', 'bionic-legs-2', 'bionic-fists', 'bionic-arms', 'decoy-training', 'shredder-truck', 'shredder-2', 'crane-helicopter', 'nope']);
  assert.ok(Math.abs(m.haulSpeed - 1.3) < 1e-9);
  assert.equal(m.breachDamage, 1.5);
  assert.equal(m.decoyStamina, 1.5);
  assert.equal(m.valueMult, 1.5);
  assert.equal(m.carryReduction, 1);
  assert.equal(m.crane, true);
  assert.equal(computeModifiers(['crane-helicopter']).haulSpeed, 1);
});

test('haulSpeed delivers a chair sooner', () => {
  const times = [NO_MODIFIERS, computeModifiers(['bionic-legs-1', 'bionic-legs-2'])].map((modifiers) => {
    const w = make({ roles: haulers(4), modifiers });
    const it = w.items.placed().find((i) => i.weight === 1);
    assert.equal(w.commands.haul(it.id).ok, true);
    return run(w, 120, done(w, it.id));
  });
  assert.ok(times[0] && times[1] && times[1] < times[0]);
});

test('breachDamage scales hits', () => {
  const first = (modifiers) => {
    const w = make({ roles: ['breacher', 'hauler'], modifiers });
    const hp = [];
    w.events.on('hit', (e) => hp.push(e.hp));
    w.events.on('break', () => hp.push('break'));
    assert.equal(w.commands.breach({ x: 7, y: 3, side: 'W' }).ok, true);
    run(w, 30, () => hp.includes('break'));
    return hp;
  };
  assert.deepEqual(first(NO_MODIFIERS), [20, 0, 'break']);
  assert.deepEqual(first(computeModifiers(['bionic-fists'])), [10, 0, 'break']);
  assert.deepEqual(first({ ...NO_MODIFIERS, breachDamage: 2 }), [0, 'break']);
});

test('valueMult raises job.delivered; totals stay base', () => {
  const play = (modifiers) => {
    const w = make({ roles: haulers(4), modifiers });
    const it = w.items.placed().find((i) => i.kind === 'monitor');
    let ev;
    w.events.on('deliver', (e) => { ev = e; });
    w.commands.haul(it.id);
    assert.ok(run(w, 120, done(w, it.id)));
    return { w, ev };
  };
  const a = play(NO_MODIFIERS);
  const b = play(computeModifiers(['shredder-truck']));
  assert.equal(b.w.job.delivered, a.w.job.delivered * 1.25);
  assert.equal(b.ev.value, a.ev.value * 1.25);
  assert.equal(b.ev.base, a.ev.value);
  assert.equal(b.w.items.totals.delivered, a.w.items.totals.delivered);
});

test('carryReduction: 5 haulers carry the weight-6 safe', () => {
  const grid = loadLevel(JSON.parse(raw));
  grid.damageEdge(12, 5, 'W', 9999);
  const w = createWorld({ grid, roles: haulers(5), modifiers: computeModifiers(['bionic-arms']) });
  assert.equal(w.carriersNeeded(6), 5);
  assert.equal(w.carriersNeeded(2), 2);
  assert.equal(w.carriersNeeded(3), 2);
  assert.equal(w.carriersNeeded(1), 1);
  const safe = w.items.placed().find((i) => i.kind === 'safe');
  assert.equal(w.commands.whistle(safe.id).ok, true);
  assert.equal(w.snapshot().whistles[0].needed, 5);
  assert.ok(run(w, 180, done(w, safe.id)));
  assert.equal(w.job.delivered, 1500);
  const w0 = createWorld({ grid: (() => { const g = loadLevel(JSON.parse(raw)); g.damageEdge(12, 5, 'W', 9999); return g; })(), roles: haulers(5) });
  assert.equal(w0.commands.haul(safe.id).ok, false);
});

test('decoyStamina lengthens the stall', () => {
  const stall = (modifiers) => {
    const w = make({ roles: ['hauler', 'decoy'], modifiers });
    const id = w.snapshot().inspectors[0].id;
    assert.equal(w.commands.decoy(id).ok, true);
    assert.equal(w.snapshot().decoys[0].stamina, 10 * modifiers.decoyStamina);
    let start = null;
    let t = null;
    w.events.on('stallStart', () => { start ??= w.time; });
    w.events.on('decoyDone', (e) => { if (e.reason === 'shooed') t = w.time; });
    run(w, 60, () => t !== null);
    return t - start;
  };
  const a = stall(NO_MODIFIERS);
  const b = stall(computeModifiers(['decoy-training']));
  assert.ok(b > a + 4, `${a} vs ${b}`);
});

test('economy v2 upgrades fold into modifiers', () => {
  const m = computeModifiers(['recruiter-1', 'recruiter-2', 'headhunter', 'barracks-1', 'barracks-2']);
  assert.equal(m.startHaulers, 2);
  assert.ok(Math.abs(m.hireCost - 0.85) < 1e-9);
  assert.equal(m.crewCap, 8);
  assert.equal(NO_MODIFIERS.startHaulers, 0);
  assert.equal(NO_MODIFIERS.hireCost, 1);
  assert.equal(NO_MODIFIERS.crewCap, 0);
});
