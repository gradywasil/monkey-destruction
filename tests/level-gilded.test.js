import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel, parseLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';

const raw = readFileSync(new URL('../src/data/levels/gilded-trust-tower.json', import.meta.url), 'utf8');
const make = () => createWorld({ grid: loadLevel(JSON.parse(raw)), roles: Array(8).fill('hauler') });
const DT = 1 / 30;
const delivered = (w, id) => {
  for (let i = 0; i < 30 * 240 && w.items.get(id).state !== 'delivered'; i++) w.tick(DT);
  return w.items.get(id).state === 'delivered';
};

test('gilded tower parses with 3 inspectors, 6 windows and 12 spawns', () => {
  const lv = parseLevel(JSON.parse(raw));
  assert.equal(lv.id, 'gilded-trust-tower');
  assert.equal(lv.inspectors.length, 3);
  assert.equal(lv.spawns.length, 12);
  assert.equal(lv.walls.filter((e) => e.type === 'window').length, 6);
  assert.equal(lv.props.filter((p) => p.kind === 'rack').length, 6);
  assert.equal(lv.props.filter((p) => p.kind === 'vend').length, 3);
  assert.equal(lv.props.filter((p) => p.kind === 'ceo').length, 3);
});

test('inspector waypoints are walkable and connected to the dock', () => {
  const w = make();
  const reach = w.path.reachable(3, 15);
  for (const i of w.grid.inspectors) {
    for (const p of i.path) {
      assert.ok(w.grid.isWalkable(p.x, p.y), `${i.id} (${p.x},${p.y})`);
      assert.ok(reach.has(`${p.x},${p.y}`), `${i.id} (${p.x},${p.y}) unreachable`);
    }
  }
});

test('open-but-far suite C is reachable without breaching', () => {
  const w = make();
  assert.equal(w.commands.haul('safe3').ok, true);
});

test('locked steel suite A is gated until the door is destroyed', () => {
  const w = make();
  assert.equal(w.commands.haul('safe1').reason, 'unreachable');
  w.grid.damageEdge(13, 8, 'N', 9999);
  assert.equal(w.commands.haul('safe1').ok, true);
  assert.ok(delivered(w, 'safe1'));
});

test('drywall-sealed suite B is gated until the partition is breached', () => {
  const w = make();
  assert.equal(w.commands.haul('safe2').reason, 'unreachable');
  w.grid.damageEdge(17, 8, 'N', 9999);
  assert.equal(w.commands.haul('safe2').ok, true);
});

test('server hall is gated until the drywall is breached', () => {
  const w = make();
  assert.equal(w.commands.haul('rack1').reason, 'unreachable');
  w.grid.damageEdge(8, 8, 'N', 9999);
  assert.equal(w.commands.haul('rack1').ok, true);
});
