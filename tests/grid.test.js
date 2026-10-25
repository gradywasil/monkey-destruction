import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Grid } from '../src/sim/grid.js';
import { loadLevel, parseLevel } from '../src/sim/level.js';

const raw = readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8');
const level = () => JSON.parse(raw);

function bfs(grid) {
  const seen = new Set();
  const q = grid.spawns.map((s) => [s.x, s.y]);
  for (const [x, y] of q) seen.add(`${x},${y}`);
  while (q.length) {
    const [x, y] = q.shift();
    for (const n of grid.neighbors(x, y)) {
      const k = `${n.x},${n.y}`;
      if (!seen.has(k)) {
        seen.add(k);
        q.push([n.x, n.y]);
      }
    }
  }
  return seen;
}

function roomsReached(grid) {
  const rooms = new Set();
  for (const k of bfs(grid)) {
    const [x, y] = k.split(',').map(Number);
    rooms.add(grid.tile(x, y).room ?? 'outdoors');
  }
  return rooms;
}

function tinyGrid() {
  return new Grid({
    width: 3,
    height: 3,
    legend: { floor: { '.': 'void', t: 'tile' }, room: { '.': null } },
    floor: ['ttt', 'ttt', 'ttt'],
    room: ['...', '...', '...'],
    walls: [],
    props: [],
    spawns: [{ x: 0, y: 0 }],
  });
}

test('level 1 parses and has expected shape', () => {
  const g = loadLevel(raw);
  assert.equal(g.width, 16);
  assert.equal(g.height, 12);
  assert.ok(g.props.length >= 30);
  assert.equal(g.spawns.length, 12);
  assert.equal(g.tile(5, 3).room, 'server');
  assert.equal(g.tile(0, 0).floor, 'asphalt');
  assert.equal(g.tile(99, 0), undefined);
  assert.equal(g.edge(12, 5, 'W').locked, true);
});

test('toJSON / fromJSON round trip', () => {
  const g = loadLevel(raw);
  g.damageEdge(7, 3, 'W', 15);
  g.removeProp('plant1');
  const j = g.toJSON();
  const g2 = Grid.fromJSON(JSON.parse(JSON.stringify(j)));
  assert.deepEqual(g2.toJSON(), j);
  assert.deepEqual(g2.edges, g.edges);
  assert.deepEqual(g2.tiles, g.tiles);
  assert.equal(g2.version, g.version);
});

test('edge crossing in all four directions', () => {
  const g = tinyGrid();
  assert.ok(g.canStep(0, 1, 1, 1));
  g.setEdge(1, 1, 'W', { type: 'wall', material: 'drywall', hp: 10 });
  g.setEdge(1, 1, 'N', { type: 'wall', material: 'drywall', hp: 10 });
  assert.equal(g.canStep(0, 1, 1, 1), false); // +x
  assert.equal(g.canStep(1, 1, 0, 1), false); // -x
  assert.equal(g.canStep(1, 0, 1, 1), false); // +y
  assert.equal(g.canStep(1, 1, 1, 0), false); // -y
  assert.ok(g.canStep(1, 1, 2, 1));
  assert.ok(g.canStep(1, 1, 1, 2));
  assert.equal(g.canStep(0, 0, 1, 1), false);
  const v = g.version;
  assert.deepEqual(g.damageEdge(1, 1, 'W', 4), { hp: 6, broken: false });
  assert.equal(g.version, v);
  assert.deepEqual(g.damageEdge(1, 1, 'W', 50), { hp: 0, broken: true });
  assert.equal(g.version, v + 1);
  assert.ok(g.canStep(0, 1, 1, 1));
  assert.ok(g.canStep(1, 1, 0, 1));
  g.damageEdge(1, 1, 'N', 10);
  assert.ok(g.canStep(1, 0, 1, 1));
  assert.ok(g.canStep(1, 1, 1, 0));
});

test('doors and windows', () => {
  const g = tinyGrid();
  g.setEdge(1, 0, 'W', { type: 'door', material: 'steel', hp: 20, locked: true });
  g.setEdge(1, 1, 'W', { type: 'door', material: 'drywall', hp: 20, locked: false });
  g.setEdge(1, 2, 'W', { type: 'window', material: 'glass', hp: 5 });
  assert.equal(g.canStep(0, 0, 1, 0), false);
  assert.ok(g.canStep(0, 1, 1, 1));
  assert.equal(g.canStep(0, 2, 1, 2), false);
  g.damageEdge(1, 0, 'W', 20);
  assert.ok(g.canStep(0, 0, 1, 0));
  g.damageEdge(1, 2, 'W', 5);
  assert.ok(g.canStep(1, 2, 0, 2));
});

test('props block and removeProp unblocks', () => {
  const g = tinyGrid();
  const v = g.version;
  g.addProp({ id: 'd', kind: 'desk', x: 0, y: 1 });
  g.addProp({ id: 'm', kind: 'monitor', x: 2, y: 2 });
  assert.equal(g.version, v + 2);
  assert.equal(g.isWalkable(1, 1), false);
  assert.ok(g.isWalkable(2, 2));
  assert.equal(g.propAt(1, 1).id, 'd');
  assert.equal(g.propAt(2, 2).id, 'm');
  assert.equal(g.canStep(1, 0, 1, 1), false);
  g.removeProp('d');
  assert.equal(g.version, v + 3);
  assert.ok(g.isWalkable(1, 1));
  assert.equal(g.propAt(1, 1), null);
});

test('reachability: yard, dock, cubicles open; CEO and server gated', () => {
  const g = loadLevel(raw);
  const rooms = roomsReached(g);
  for (const r of ['outdoors', 'reception', 'cubicles', 'break', 'manager']) assert.ok(rooms.has(r), r);
  assert.ok(bfs(g).has(`${g.truck.dropX},${g.truck.dropY}`));
  assert.ok(bfs(g).has('5,0'));
  assert.equal(rooms.has('ceo'), false);
  assert.equal(rooms.has('server'), false);

  g.damageEdge(12, 5, 'W', 120);
  assert.ok(roomsReached(g).has('ceo'));
  g.damageEdge(7, 3, 'W', 40);
  assert.ok(roomsReached(g).has('server'));

  // After both breaches every walkable tile is reachable.
  const seen = bfs(g);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      if (g.isWalkable(x, y)) assert.ok(seen.has(`${x},${y}`), `unreachable (${x},${y})`);
    }
  }
});

test('invalid levels throw', () => {
  const oob = level();
  oob.props.push({ id: 'x', kind: 'cab', x: 16, y: 0 });
  assert.throws(() => parseLevel(oob), /out of bounds/);
  const overlap = level();
  overlap.props.push({ id: 'x', kind: 'chair', x: 8, y: 2 });
  assert.throws(() => parseLevel(overlap), /overlaps/);
  const onVoid = level();
  onVoid.props.push({ id: 'x', kind: 'cab', x: 10, y: 0 });
  assert.throws(() => parseLevel(onVoid), /void/);
  const badKind = level();
  badKind.props.push({ id: 'x', kind: 'tank', x: 1, y: 1 });
  assert.throws(() => parseLevel(badKind), /unknown kind/);
  const badDims = level();
  badDims.width = 0;
  assert.throws(() => parseLevel(badDims), /dimensions/);
  const badDoor = level();
  badDoor.walls.push({ x: 15, y: 3, side: 'W', type: 'door', material: 'drywall', hp: 40 });
  assert.throws(() => parseLevel(badDoor), /two floor tiles/);
  const badSpawn = level();
  badSpawn.spawns.push({ x: 20, y: 20 });
  assert.throws(() => parseLevel(badSpawn), /spawn/);
});
