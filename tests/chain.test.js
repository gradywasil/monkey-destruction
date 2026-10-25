import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const make = (opts = {}) => createWorld({ grid: loadLevel(JSON.parse(raw)), ...opts });
const run = (world, seconds, until) => {
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n; i++) {
    world.tick(1 / 30);
    if (until && until()) return true;
  }
  return false;
};
const RECEPTION = { x: 5, y: 8 };
const FAR = { x: 11, y: 8 };

test('preview from reception reaches the drop tile', () => {
  const w = make();
  const p = w.commands.chain.preview(RECEPTION);
  assert.equal(p.ok, true);
  assert.equal(p.needed, p.stations.length);
  assert.deepEqual(p.stations[0], RECEPTION);
  assert.deepEqual(p.stations.at(-1), { x: 3, y: 9 });
  assert.deepEqual(p.pathTiles.at(-1), { x: 3, y: 9 });
  assert.equal(p.available, 8);
  assert.equal(w.commands.chain.preview({ x: 15, y: 0 }).reason, 'invalid');
  assert.equal(w.commands.chain.preview({ x: 5, y: 3 }).reason, 'unreachable');
});

test('create reserves exactly the needed haulers', () => {
  const w = make();
  const r = w.commands.chain.create(FAR);
  assert.equal(r.ok, true);
  const chained = w.crew.filter((c) => c.state === 'chain');
  assert.equal(chained.length, r.needed);
  assert.ok(chained.every((c) => c.role === 'hauler'));
  assert.equal(w.commands.haulWith([chained[0].id], 'frontchair').reason, 'not-enough-idle');
  assert.equal(w.commands.chain.preview(FAR).available, 8 - r.needed);
  assert.equal(w.snapshot().chains[0].stations.length, r.needed);
});

test('not enough haulers', () => {
  const w = make({ roles: ['hauler', 'hauler', 'rigger'] });
  const p = w.commands.chain.preview({ x: 10, y: 8 });
  assert.equal(p.needed, 3);
  assert.deepEqual(w.commands.chain.create({ x: 10, y: 8 }), { ok: false, reason: 'not-enough-haulers', needed: 3 });
  assert.ok(w.crew.every((c) => c.state === 'idle'));
});

test('reception chain delivers nearby light items', () => {
  const w = make();
  const want = ['frontchair', 'frontmon', 'plant1', 'plant2'];
  const delivered = [];
  w.events.on('deliver', (e) => delivered.push(e.item.id));
  let flew = false;
  assert.equal(w.commands.chain.create(RECEPTION).ok, true);
  run(w, 90, () => {
    const s = w.snapshot();
    const f = s.chains[0].flights[0];
    if (f) {
      flew = true;
      assert.ok(s.carried.some((c) => c.id === f.itemId && c.z === f.z));
    }
    return false;
  });
  assert.ok(flew);
  for (const id of want) assert.ok(delivered.includes(id), id);
  const sum = delivered.reduce((s, id) => s + w.items.get(id).value, 0);
  assert.equal(w.job.delivered, sum);
  assert.ok(delivered.every((id) => w.items.get(id).weight === 1));
});

test('distant chain keeps up with a single sequential hauler', () => {
  const T = 40;
  const w = make();
  let chainCount = 0;
  w.events.on('deliver', () => chainCount++);
  w.commands.chain.create(FAR);
  run(w, T);

  const h = make({ roles: ['hauler'] });
  let soloCount = 0;
  h.events.on('deliver', () => soloCount++);
  const queue = ['breakchair', 'mon6', 'plant3'];
  for (let i = 0; i < T * 30; i++) {
    if (h.crew[0].state === 'idle' && queue.length) h.commands.haul(queue.shift());
    h.tick(1 / 30);
  }
  assert.ok(chainCount >= soloCount, `${chainCount} < ${soloCount}`);
  assert.ok(chainCount > 0);
});

test('remove releases crew and drops held items', () => {
  const w = make();
  const { chainId } = w.commands.chain.create(RECEPTION);
  assert.ok(run(w, 30, () => w.snapshot().chains[0].stations[0].holding !== null || w.snapshot().chains[0].flights.length > 0));
  const held = w.snapshot().carried[0].id;
  assert.equal(w.commands.chain.remove(chainId), true);
  assert.ok(w.crew.every((c) => c.state === 'idle'));
  assert.equal(w.items.get(held).state, 'placed');
  assert.deepEqual(w.snapshot().chains, []);
  assert.equal(w.commands.haul(held).ok, true);
});

test('blocked when the grid cuts the chain', () => {
  const w = make();
  let blocked = 0;
  w.events.on('blocked', () => blocked++);
  w.commands.chain.create(FAR);
  run(w, 5);
  w.grid.setEdge(4, 8, 'W', { type: 'wall', material: 'brick' });
  w.grid.setEdge(4, 9, 'W', { type: 'wall', material: 'brick' });
  run(w, 5);
  assert.equal(w.snapshot().chains[0].blocked, true);
  assert.equal(blocked, 1);
});

test('deterministic', () => {
  const script = () => {
    const w = make();
    w.commands.chain.create(RECEPTION);
    w.commands.chain.create(FAR);
    run(w, 60);
    return JSON.stringify(w.snapshot());
  };
  assert.equal(script(), script());
});
