import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createItemStore } from '../src/sim/items.js';
import { quotaFor } from '../src/data/items.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const setup = () => {
  const grid = loadLevel(JSON.parse(raw));
  return { grid, store: createItemStore(grid) };
};
const firstOf = (store, kind) => store.list().find((it) => it.kind === kind);

test('store has one item per prop', () => {
  const { grid, store } = setup();
  assert.equal(store.list().length, grid.props.length);
  assert.equal(store.placed().length, grid.props.length);
  assert.equal(store.totals.total, store.list().reduce((s, it) => s + it.value, 0));
});

test('claim needs exactly weight crew ids', () => {
  const { store } = setup();
  const it = firstOf(store, 'copier');
  assert.equal(store.claim(it.id, ['a']), false);
  assert.equal(store.claim(it.id, ['a', 'b', 'c']), false);
  assert.equal(store.claim(it.id, ['a', 'b']), true);
  assert.equal(it.state, 'claimed');
  assert.equal(store.claim(it.id, ['a', 'b']), false);
  store.release(it.id);
  assert.equal(it.state, 'placed');
  assert.deepEqual(it.carriers, []);
});

test('pickUp unblocks the tile; drop re-blocks or fails', () => {
  const { grid, store } = setup();
  const it = firstOf(store, 'cab');
  const v = grid.version;
  assert.equal(grid.isWalkable(it.x, it.y), false);
  assert.equal(store.pickUp(it.id), true);
  assert.equal(it.state, 'carried');
  assert.equal(grid.isWalkable(it.x, it.y), true);
  assert.ok(grid.version > v);
  const other = firstOf(store, 'chair') ?? store.list().find((o) => o.id !== it.id && o.w === 1 && o.d === 1 && grid.blockMap.has(o.y * grid.width + o.x));
  assert.equal(store.drop(it.id, other.x, other.y), false);
  assert.equal(store.drop(it.id, it.x, it.y), true);
  assert.equal(it.state, 'placed');
  assert.equal(grid.isWalkable(it.x, it.y), false);
});

test('deliver updates totals and fires event', () => {
  const { store } = setup();
  const it = firstOf(store, 'rack');
  const seen = [];
  const off = store.on('deliver', (i) => seen.push(i.id));
  store.pickUp(it.id);
  assert.equal(store.deliver(it.id), 900);
  assert.equal(store.totals.delivered, 900);
  assert.equal(store.totals.count, 1);
  assert.deepEqual(seen, [it.id]);
  off();
  assert.equal(store.deliver(it.id), 0);
});

test('picking a monitor leaves its desk', () => {
  const { grid, store } = setup();
  const mon = firstOf(store, 'monitor');
  const desk = grid.propAt(mon.x, mon.y);
  assert.equal(desk.kind, 'desk');
  assert.equal(grid.isWalkable(mon.x, mon.y), false);
  store.pickUp(mon.id);
  assert.equal(grid.propAt(mon.x, mon.y).id, desk.id);
  assert.equal(grid.isWalkable(mon.x, mon.y), false);
  assert.equal(store.drop(mon.id, mon.x, mon.y), true);
});

test('quotaFor rounds to nearest 100', () => {
  assert.equal(quotaFor([{ value: 1000 }]), 600);
  assert.equal(quotaFor([{ value: 40 }, { value: 80 }]), 100);
  assert.equal(quotaFor([{ value: 1000 }], 0.5), 500);
  assert.equal(quotaFor([{ value: 1234 }], 1), 1200);
});
