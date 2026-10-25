import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createPathService } from '../src/sim/path.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const setup = () => {
  const grid = loadLevel(raw);
  return { grid, ps: createPathService(grid) };
};
const assertSteps = (grid, sx, sy, path) => {
  let [x, y] = [sx, sy];
  for (const p of path) {
    assert.ok(grid.canStep(x, y, p.x, p.y), `step ${x},${y} -> ${p.x},${p.y}`);
    [x, y] = [p.x, p.y];
  }
};

test('spawn to truck drop path is valid', () => {
  const { grid, ps } = setup();
  const s = grid.spawns[0];
  const path = ps.findPath(s.x, s.y, grid.truck.dropX, grid.truck.dropY);
  assert.ok(path && path.length > 0);
  assert.deepEqual(path.at(-1), { x: grid.truck.dropX, y: grid.truck.dropY });
  assertSteps(grid, s.x, s.y, path);
  assert.deepEqual(ps.findPath(s.x, s.y, s.x, s.y), []);
});

test('CEO suite opens when locked door is destroyed; flow field invalidated', () => {
  const { grid, ps } = setup();
  const s = grid.spawns[0];
  assert.equal(ps.findPath(s.x, s.y, 13, 5), null);
  assert.equal(ps.reachable(s.x, s.y).has('13,5'), false);
  const before = ps.flowField([{ x: 13, y: 5 }]);
  assert.equal(before.dist[s.y * grid.width + s.x], -1);
  assert.equal(ps.flowField([{ x: 13, y: 5 }]), before);
  grid.damageEdge(12, 5, 'W', 60);
  assert.equal(ps.findPath(s.x, s.y, 13, 5), null);
  grid.damageEdge(12, 5, 'W', 60);
  const path = ps.findPath(s.x, s.y, 13, 5);
  assert.ok(path);
  assertSteps(grid, s.x, s.y, path);
  const after = ps.flowField([{ x: 13, y: 5 }]);
  assert.notEqual(after, before);
  assert.equal(after.version, grid.version);
  assert.ok(after.dist[s.y * grid.width + s.x] > 0);
  assert.equal(ps.reachable(s.x, s.y).has('13,5'), true);
});

test('server room opens when drywall partition breaks', () => {
  const { grid, ps } = setup();
  const s = grid.spawns[0];
  assert.equal(ps.findPath(s.x, s.y, 5, 3), null);
  grid.damageEdge(7, 3, 'W', 40);
  const path = ps.findPath(s.x, s.y, 5, 3);
  assert.ok(path);
  assertSteps(grid, s.x, s.y, path);
});

test('findPathToAny picks nearer goal', () => {
  const { grid, ps } = setup();
  const s = grid.spawns[0];
  const near = { x: grid.truck.dropX, y: grid.truck.dropY };
  const far = { x: 10, y: 3 };
  const res = ps.findPathToAny(s.x, s.y, [far, near]);
  assert.deepEqual(res.goal, near);
  assert.deepEqual(res.path, ps.findPath(s.x, s.y, near.x, near.y));
  assert.equal(ps.findPathToAny(s.x, s.y, [{ x: 13, y: 5 }]), null);
});

test('flowNext walks to goal in exactly dist steps', () => {
  const { grid, ps } = setup();
  const s = grid.spawns[0];
  const field = ps.flowField([{ x: 10, y: 3 }]);
  const d = field.dist[s.y * grid.width + s.x];
  assert.ok(d > 0);
  assert.equal(d, ps.findPath(s.x, s.y, 10, 3).length);
  let cur = { ...s };
  let steps = 0;
  for (let n; (n = ps.flowNext(field, cur.x, cur.y)); steps++) {
    assert.ok(grid.canStep(cur.x, cur.y, n.x, n.y));
    cur = n;
  }
  assert.equal(steps, d);
  assert.deepEqual(cur, { x: 10, y: 3 });
  assert.ok(ps.stats.cacheHits === 0);
  ps.flowField([{ x: 10, y: 3 }]);
  assert.equal(ps.stats.cacheHits, 1);
});

test('adjacentTiles for a desk', () => {
  const { grid, ps } = setup();
  // (6,2) is across the drywall partition, so it cannot reach the desk until the wall is breached
  assert.deepEqual(ps.adjacentTiles({ x: 7, y: 2, w: 2, d: 1 }), [
    { x: 7, y: 3 }, { x: 8, y: 3 },
  ]);
  grid.damageEdge(7, 2, 'W', 9999);
  assert.deepEqual(ps.adjacentTiles({ x: 7, y: 2, w: 2, d: 1 }), [
    { x: 6, y: 2 }, { x: 7, y: 3 }, { x: 8, y: 3 },
  ]);
});

test('blocked start tile can still path out', () => {
  const { grid, ps } = setup();
  grid.addProp({ id: 'dropped', kind: 'cab', x: 3, y: 8 });
  assert.equal(grid.isWalkable(3, 8), false);
  const path = ps.findPath(3, 8, 0, 9);
  assert.ok(path && path.length > 0);
  assertSteps(grid, path[0].x, path[0].y, path.slice(1));
  assert.ok(ps.reachable(3, 8).has('0,9'));
});

test('200 findPath calls under 300 ms', () => {
  const { grid, ps } = setup();
  const tiles = [...ps.reachable(grid.spawns[0].x, grid.spawns[0].y)].map((k) => k.split(',').map(Number));
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) {
    const [ax, ay] = tiles[(i * 7) % tiles.length];
    const [bx, by] = tiles[(i * 13 + 5) % tiles.length];
    assert.ok(ps.findPath(ax, ay, bx, by));
  }
  assert.ok(performance.now() - t0 < 300);
});
