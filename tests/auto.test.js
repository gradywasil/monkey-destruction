import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel, parseLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';
import { computeModifiers } from '../src/sim/modifiers.js';
import { HIRE_BASE, HIRE_GROWTH, starsFor, parFor } from '../src/data/economy.js';
import { playLevel } from '../scripts/auto-sim.mjs';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const DT = 1 / 30;
const make = (opts = {}) => createWorld({ grid: loadLevel(JSON.parse(raw)), auto: true, ...opts });
const run = (w, seconds, until) => {
  for (let i = 0, n = Math.round(seconds * 30); i < n; i++) {
    w.tick(DT);
    if (until?.()) return true;
  }
  return false;
};
const count = (w, type) => {
  const seen = [];
  w.events.on(type, (e) => seen.push(e));
  return seen;
};

test('two haulers auto-deliver loose items with no commands; cash rises', () => {
  const w = make();
  assert.equal(w.crew.length, 2);
  const sales = count(w, 'deliver');
  assert.equal(w.cash(), 0);
  run(w, 120);
  assert.ok(sales.length >= 3, `${sales.length} deliveries`);
  assert.equal(w.cash(), w.job.delivered - w.job.fines);
  assert.ok(w.cash() > 200);
  const s = w.snapshot();
  assert.equal(s.auto, true);
  assert.equal(s.economy.cash, w.cash());
  assert.ok(s.economy.stripped > 0 && s.economy.stripped < 1);
  assert.equal(s.economy.totalValue, w.items.totals.total);
  assert.equal(s.state, 'running');
});

test('hire: cash gate, escalating cost, spawn, event, unknown role', () => {
  const w = make();
  const hires = count(w, 'hire');
  assert.deepEqual(w.commands.hire('hauler'), { ok: false, reason: 'cash' });
  assert.equal(w.commands.hire('janitor').reason, 'unknown-role');
  assert.equal(w.hireCost('hauler'), HIRE_BASE.hauler);
  run(w, 300, () => w.cash() >= HIRE_BASE.hauler);
  const before = w.cash();
  const r = w.commands.hire('hauler');
  assert.equal(r.ok, true);
  assert.equal(r.cost, HIRE_BASE.hauler);
  assert.equal(w.cash(), before - r.cost);
  assert.equal(w.crew.length, 3);
  const c = w.crew[2];
  assert.equal(c.id, r.id);
  assert.equal(c.role, 'hauler');
  assert.equal(hires[0].role, 'hauler');
  assert.equal(hires[0].cost, r.cost);
  assert.equal(w.hireCost('hauler'), Math.round(HIRE_BASE.hauler * HIRE_GROWTH));
  assert.equal(w.hireCost('breacher'), HIRE_BASE.breacher);
  const roles = w.snapshot().hire.roles;
  assert.equal(roles.hauler.cost, w.hireCost('hauler'));
  assert.equal(roles.hauler.count, 3);
});

test('hire respects the crew cap (level crewCap + barracks)', () => {
  const w = make();
  w.addCash(1e6);
  let last;
  for (let i = 0; i < 20; i++) {
    last = w.commands.hire('hauler');
    if (!last.ok) break;
  }
  assert.equal(last.reason, 'cap');
  assert.equal(w.crew.length, 12);
  assert.equal(w.snapshot().hire.cap, 12);
  const grid = loadLevel(JSON.parse(raw));
  grid.crewCap = 3;
  const w2 = createWorld({ grid, auto: true, modifiers: computeModifiers(['barracks-1']) });
  assert.equal(w2.snapshot().hire.cap, 7);
  const w3 = createWorld({ grid, auto: true });
  w3.addCash(1e6);
  assert.equal(w3.commands.hire('decoy').ok, true);
  assert.equal(w3.commands.hire('decoy').reason, 'cap');
});

test('classic mode is untouched', () => {
  const w = createWorld({ grid: loadLevel(JSON.parse(raw)) });
  assert.equal(w.crew.length, 12);
  assert.equal(w.commands.hire('hauler').ok, false);
  assert.equal(w.commands.boost('speed').ok, false);
  const t0 = w.job.timeLeft;
  run(w, 5);
  assert.ok(w.job.timeLeft < t0);
  const s = w.snapshot();
  assert.equal(s.auto, false);
  assert.equal(s.economy, null);
  assert.equal(s.hints, null);
  assert.ok(s.quota > 0);
});

test('hints flag sealed loot and heavy items that wait for hires', () => {
  const w = make();
  run(w, 1);
  const h = w.snapshot().hints;
  assert.ok(h.sealedValue > 0);
  assert.equal(h.idleBreachers, 0);
  assert.ok(h.heavyWaiting > 0);
  assert.equal(typeof h.inspectorNear, 'boolean');
});

test('heavy items are skipped until enough haulers exist', () => {
  const w = make();
  const heavy = (id) => w.items.get(id).weight >= 3;
  run(w, 150);
  assert.equal(w.items.list().filter((i) => i.state !== 'placed' && heavy(i.id) && i.state !== 'delivered').length, 0);
  assert.equal(w.items.list().filter((i) => i.state === 'delivered' && heavy(i.id)).length, 0);
  w.addCash(1e5);
  assert.equal(w.commands.hire('hauler').ok, true);
  assert.equal(w.commands.hire('hauler').ok, true);
  assert.ok(run(w, 300, () => w.items.list().some((i) => i.state === 'delivered' && i.weight === 3)));
});

test('a hired breacher opens the server room and the loot behind it is delivered', () => {
  const w = make({ roles: ['hauler', 'hauler', 'hauler', 'hauler'] });
  const breaks = count(w, 'break');
  run(w, 5);
  assert.equal(w.items.get('rack1').state, 'placed');
  assert.ok(w.snapshot().hints.sealedValue >= 2700);
  w.addCash(5000);
  assert.equal(w.commands.hire('breacher').ok, true);
  assert.ok(run(w, 600, () => w.items.get('rack1').state === 'delivered'));
  assert.ok(breaks.length >= 1);
});

test('manual orders still win over the brain', () => {
  const w = make();
  const r = w.commands.haul('frontchair');
  assert.equal(r.ok, true);
  run(w, 0.5);
  assert.equal(w.items.get('frontchair').carriers.join(), r.crewIds.join());
  assert.ok(run(w, 60, () => w.items.get('frontchair').state === 'delivered'));
});

test('riggers rig a window when the window route beats the walk', () => {
  const grid = loadLevel(JSON.parse(raw));
  grid.damageEdge(7, 3, 'W', 9999);
  const w = createWorld({ grid, auto: true, roles: ['hauler', 'hauler', 'hauler', 'hauler', 'rigger'] });
  const rigged = count(w, 'rigged');
  const shoves = count(w, 'shove');
  assert.ok(run(w, 200, () => rigged.length > 0));
  assert.ok(run(w, 400, () => shoves.length > 0));
});

test('decoy auto-stalls a nearby inspector', () => {
  const w = make({ roles: ['hauler', 'hauler', 'decoy'] });
  const stalls = count(w, 'stallStart');
  assert.ok(run(w, 240, () => stalls.length > 0));
});

test('boosts: escalating cost, caps, speed and haggle effects', () => {
  const w = make();
  assert.equal(w.commands.boost('haggle').reason, 'cash');
  assert.equal(w.commands.boost('nope').reason, 'unknown-boost');
  w.addCash(1e7);
  const c1 = w.commands.boost('haggle');
  assert.equal(c1.ok, true);
  assert.equal(w.credit(100), 110);
  assert.ok(w.boostCost('haggle') > c1.cost);
  const base = w.speedOf(w.crew[0]);
  assert.equal(w.commands.boost('speed').ok, true);
  assert.ok(Math.abs(w.speedOf(w.crew[0]) / base - 1.12) < 1e-9);
  for (let i = 0; i < 20; i++) w.commands.boost('speed');
  const b = w.snapshot().boosts.find((x) => x.id === 'speed');
  assert.deepEqual([b.level, b.max, b.cost], [8, 8, null]);
  assert.equal(w.commands.boost('speed').reason, 'max');
});

test('whistle has a cooldown in auto mode', () => {
  const w = make();
  const heavy = w.items.placed().find((i) => i.kind === 'cab');
  assert.equal(w.commands.whistle(heavy.id).ok, true);
  assert.equal(w.commands.whistle(heavy.id).reason, 'cooldown');
  assert.ok(w.snapshot().whistleCooldown > 19);
});

test('clearing the building ends the run with stars and profit', () => {
  const w = make();
  const cleared = count(w, 'cleared');
  w.addCash(1e5);
  for (let i = 0; i < 8; i++) w.commands.hire(i < 2 ? 'breacher' : 'hauler');
  assert.ok(run(w, 1500, () => cleared.length > 0));
  assert.equal(cleared.length, 1);
  assert.equal(w.job.state, 'ended');
  assert.equal(cleared[0].stars, starsFor(cleared[0].elapsed, w.job.par));
  assert.equal(cleared[0].profit, Math.max(0, w.cash()));
  assert.ok(w.snapshot().economy.cleared);
  assert.equal(w.snapshot().economy.stripped, 1);
  assert.equal(w.commands.hire('hauler').reason, 'ended');
});

test('stars and par', () => {
  assert.deepEqual([starsFor(100, 100), starsFor(150, 100), starsFor(151, 100)], [3, 2, 1]);
  assert.equal(parFor(12055), 900);
  assert.equal(parFor(1200), 240);
  assert.equal(parFor(6000), 500);
  assert.equal(parFor(6000, 777), 777);
  assert.equal(make().job.par, 600);
});

test('deterministic', () => {
  const go = () => {
    const w = make({ seed: 7 });
    run(w, 60);
    w.addCash(3000);
    w.commands.hire('hauler');
    w.commands.hire('breacher');
    run(w, 120);
    return JSON.stringify([w.time, w.job.delivered, w.job.fines, w.snapshot().crew]);
  };
  assert.equal(go(), go());
});

test('level crewCap and par validate', () => {
  const lv = JSON.parse(raw);
  assert.throws(() => parseLevel({ ...lv, crewCap: 0 }), /crewCap/);
  assert.throws(() => parseLevel({ ...lv, par: -5 }), /par/);
  assert.equal(parseLevel({ ...lv, crewCap: 20 }).crewCap, 20);
});

test('recruiters add starting haulers', () => {
  const w = make({ modifiers: computeModifiers(['recruiter-1', 'recruiter-2', 'headhunter']) });
  assert.equal(w.crew.length, 4);
  assert.equal(w.hireCost('hauler'), Math.round(HIRE_BASE.hauler * 0.85));
});

for (const [file, lo, hi] of [['dunmore-pike', 8, 12], ['fairfax-credit-union', 12, 16], ['gilded-trust-tower', 15, 20]]) {
  test(`${file}: greedy hiring clears in ${lo}-${hi} min`, () => {
    const { cleared } = playLevel(file);
    assert.ok(cleared, 'not cleared in 30 min');
    const min = cleared.elapsed / 60;
    assert.ok(min >= lo && min <= hi, `${min.toFixed(1)} min`);
  });
}

test('prioritize: the pinned item is hauled first, even when haulers were already walking elsewhere', () => {
  const w = make();
  run(w, 3);
  const pick = w.items.list()
    .filter((it) => it.state === 'placed' && it.weight === 1)
    .sort((a, b) => a.value - b.value)[0];
  const r = w.commands.prioritize(pick.id);
  assert.equal(r.ok, true);
  assert.equal(w.snapshot().priorityId, pick.id);
  const sales = count(w, 'deliver');
  run(w, 120, () => sales.length >= 2);
  assert.ok(sales.slice(0, 2).some((e) => e.item.id === pick.id), 'pinned item delivered in the first two sales');
  assert.equal(w.snapshot().priorityId, null, 'pin clears once the item is taken');
});

test('prioritize: same id unpins; heavy loot beyond the hauler count and delivered loot are refused', () => {
  const w = make();
  const light = w.items.list().find((it) => it.weight === 1);
  assert.deepEqual(w.commands.prioritize(light.id), { ok: true, cleared: false });
  assert.deepEqual(w.commands.prioritize(light.id), { ok: true, cleared: true });
  assert.equal(w.snapshot().priorityId, null);
  const heavy = w.items.list().filter((it) => it.weight > w.crew.length).map((it) => w.commands.prioritize(it.id));
  const short = heavy.find((r) => r.reason === 'not-enough-haulers');
  assert.ok(short, 'a reachable heavy item reports how many haulers it needs');
  assert.ok(short.needed > short.haulers);
  assert.ok(heavy.every((r) => !r.ok), 'sealed or too-heavy loot is never pinned');
  assert.equal(w.commands.prioritize('nope').reason, 'not-placed');
});

test('loot(): lists floor items with sealed flags; delivered items drop out', () => {
  const w = make();
  run(w, 1);
  const before = w.loot();
  assert.equal(before.length, w.items.list().length);
  assert.ok(before.every((l) => l.need >= 1 && typeof l.sealed === 'boolean'));
  assert.ok(before.some((l) => l.sealed), 'the server room starts sealed');
  assert.ok(before.some((l) => !l.sealed));
  const sales = count(w, 'deliver');
  run(w, 120, () => sales.length >= 1);
  assert.ok(w.loot().length < before.length);
});
