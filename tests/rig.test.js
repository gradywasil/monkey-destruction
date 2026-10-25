import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { Grid } from '../src/sim/grid.js';
import { createWorld } from '../src/sim/world.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const DT = 1 / 30;
const ROLES = ['hauler', 'hauler', 'hauler', 'hauler', 'rigger', 'hauler'];
const WIN = { x: 5, y: 2, side: 'N' };
const make = (opts = {}, sealWest = true) => {
  const grid = loadLevel(JSON.parse(raw));
  grid.damageEdge(7, 3, 'W', 9999);
  if (sealWest) {
    // adjacentTiles ignores walls: keep haulers from grabbing racks through the outer brick.
    for (let y = 2; y < 6; y++) grid.addProp({ id: `seal${y}`, kind: 'safe', x: 3, y });
    grid.addProp({ id: 'sealN', kind: 'safe', x: 4, y: 1 });
  }
  return createWorld({ grid, roles: ROLES, ...opts });
};
const run = (world, seconds, until) => {
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    world.tick(DT);
    if (until?.()) return true;
  }
  return false;
};
const delivered = (w, id) => () => w.items.get(id).state === 'delivered';
const rigged = (w) => {
  const ev = [];
  w.events.on('rigged', (e) => ev.push(e));
  assert.equal(w.commands.rig(WIN).ok, true);
  assert.ok(run(w, 60, () => ev.length > 0));
  return ev[0];
};
const haulTime = (w, id) => {
  const t0 = w.time;
  assert.equal(w.commands.haulWith(['c0', 'c1', 'c2', 'c3'], id).ok, true);
  assert.ok(run(w, 300, delivered(w, id)));
  return w.time - t0;
};

test('rig rejects non-windows and non-riggers', () => {
  const w = make();
  assert.equal(w.commands.rig({ x: 7, y: 4, side: 'W' }).reason, 'not-a-window');
  assert.equal(w.commands.rig(WIN, ['c0']).reason, 'no-rigger');
  const w2 = make({ roles: ['hauler', 'hauler'] });
  assert.equal(w2.commands.rig(WIN).reason, 'no-rigger');
  assert.equal(w.commands.haulWith(['c4'], 'frontchair').reason, 'wrong-role');
});

test('unreachable when the server room is sealed', () => {
  const w = createWorld({ grid: loadLevel(JSON.parse(raw)), roles: ROLES });
  assert.equal(w.commands.rig(WIN).reason, 'unreachable');
});

test('rigger rigs the window: progress, lift pose, zips', () => {
  const w = make();
  const r = w.commands.rig(WIN);
  assert.deepEqual(r, { ok: true, crewIds: ['c4'] });
  assert.equal(w.commands.rig(WIN).reason, 'already-rigged');
  let maxP = 0;
  let lifted = false;
  const ev = [];
  w.events.on('rigged', (e) => ev.push(e));
  run(w, 60, () => {
    const s = w.snapshot();
    if (s.rigs.length) maxP = Math.max(maxP, s.rigs[0].progress);
    if (s.crew.find((c) => c.id === 'c4').pose === 'lift') lifted = true;
    return ev.length > 0;
  });
  assert.ok(maxP > 0.9 && lifted);
  assert.deepEqual(ev[0], { edge: WIN, inside: { x: 5, y: 2 }, net: { x: 5, y: 1 } });
  const s = w.snapshot();
  assert.equal(s.rigs.length, 0);
  assert.deepEqual(s.zips, [{ edge: WIN, inside: { x: 5, y: 2 }, net: { x: 5, y: 1 } }]);
  assert.equal(w.crew[4].state, 'idle');
  assert.equal(w.commands.rig(WIN).reason, 'already-rigged');
  assert.equal(w.grid.isEdgeBlocked(5, 2, 'N'), true);
});

test('cancelRig stops the rigger', () => {
  const w = make();
  w.commands.rig(WIN);
  assert.equal(w.commands.cancelRig('c4'), true);
  assert.equal(w.crew[4].state, 'idle');
  assert.equal(w.snapshot().rigs.length, 0);
});

test('rack is shoved out of the rigged window, faster than the truck', () => {
  const w = make();
  rigged(w);
  const shoves = [];
  const flights = [];
  let launched = false;
  w.events.on('shove', (e) => shoves.push(e));
  w.events.on('deliver', () => {});
  const t0 = w.time;
  assert.equal(w.commands.haulWith(['c0', 'c1', 'c2', 'c3'], 'rack1').ok, true);
  assert.ok(run(w, 300, () => {
    const s = w.snapshot();
    if (s.crew.some((c) => c.pose === 'launch')) launched = true;
    const f = s.carried.find((c) => c.id === 'rack1');
    if (shoves.length && f) flights.push(f);
    return w.items.get('rack1').state === 'delivered';
  }));
  const tWin = w.time - t0;
  assert.ok(launched);
  assert.deepEqual(shoves, [{ itemId: 'rack1', edge: WIN }]);
  assert.ok(flights.some((f) => f.y < 2 && f.z > 1));
  assert.equal(w.job.delivered, w.items.get('rack1').value);
  assert.ok(w.crew.every((c) => c.state === 'idle'));
  const tTruck = haulTime(make(), 'rack1');
  assert.ok(tWin < tTruck, `${tWin} < ${tTruck}`);
});

test('far items still go to the truck', () => {
  const w = make();
  rigged(w);
  const shoves = [];
  w.events.on('shove', (e) => shoves.push(e));
  assert.equal(w.commands.haul('frontchair').ok, true);
  assert.ok(run(w, 120, delivered(w, 'frontchair')));
  assert.equal(shoves.length, 0);
});

test('rigged flag survives Grid toJSON/fromJSON', () => {
  const w = make();
  rigged(w);
  const g = Grid.fromJSON(JSON.parse(JSON.stringify(w.grid.toJSON())));
  assert.equal(g.edge(5, 2, 'N').rigged, true);
  assert.equal(g.edge(6, 2, 'N').rigged, undefined);
});

test('falls back to the truck when the window route is blocked', () => {
  const w = make();
  rigged(w);
  const shoves = [];
  w.events.on('shove', (e) => shoves.push(e));
  let blocked = false;
  w.events.on('pickup', () => {
    if (blocked) return;
    blocked = true;
    w.grid.addProp({ id: 'blocker', kind: 'safe', x: 5, y: 2 });
  });
  assert.equal(w.commands.haulWith(['c0', 'c1', 'c2', 'c3'], 'rack2').ok, true);
  assert.ok(run(w, 300, delivered(w, 'rack2')));
  assert.ok(blocked);
  assert.equal(shoves.length, 0);
});

test('whistle also uses the window', () => {
  const w = make();
  rigged(w);
  const shoves = [];
  w.events.on('shove', (e) => shoves.push(e));
  assert.equal(w.commands.whistle('rack1').ok, true);
  assert.ok(run(w, 300, delivered(w, 'rack1')));
  assert.equal(shoves.length, 1);
});

test('deterministic', () => {
  const go = () => {
    const w = make();
    rigged(w);
    w.commands.haulWith(['c0', 'c1', 'c2', 'c3'], 'rack1');
    run(w, 40);
    return JSON.stringify([w.time, w.job.delivered, w.snapshot().crew]);
  };
  assert.equal(go(), go());
});
