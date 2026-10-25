import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Grid } from '../src/sim/grid.js';
import { createWorld } from '../src/sim/world.js';
import { createCamera } from '../src/render/camera.js';
import { isFrontWall } from '../src/render/world-renderer.js';
import { pickItem, pickCrew, pickEdge, pickInspector } from '../src/ui/pick.js';

const level = JSON.parse(readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8'));
const setup = (z) => {
  const grid = new Grid(level);
  const world = createWorld({ grid });
  const camera = createCamera({ viewW: 390, viewH: 844, gridW: grid.width, gridH: grid.height, initial: { cx: 10, cy: 6, z } });
  return { world, camera };
};

for (const z of [1, 3.2]) {
  test(`pickItem finds a chair at its projected centre (z=${z})`, () => {
    const { world, camera } = setup(z);
    const chair = world.items.list().find((i) => i.kind === 'chair');
    assert.ok(chair);
    const p = camera.gridToScreen(chair.x + 0.5, chair.y + 0.5, 0.2);
    assert.equal(pickItem(world, camera, p.x, p.y)?.id, chair.id);
  });

  test(`pickCrew finds a crew sprite (z=${z})`, () => {
    const { world, camera } = setup(z);
    const c = world.crew[2];
    const p = camera.gridToScreen(c.x, c.y, 0.5);
    assert.equal(pickCrew(world, camera, p.x, p.y)?.id, c.id);
  });

  test(`empty sky returns null (z=${z})`, () => {
    const { world, camera } = setup(z);
    assert.equal(pickItem(world, camera, -500, -500), null);
    assert.equal(pickCrew(world, camera, -500, -500), null);
  });
}

const mid = (camera, x, y, side) => camera.gridToScreen(side === 'N' ? x + 0.5 : x, side === 'N' ? y : y + 0.5, 0.7);

for (const z of [1, 3.2]) {
  test(`pickEdge finds the partition and the CEO door (z=${z})`, () => {
    const { world, camera } = setup(z);
    for (const [x, y] of [[7, 3], [12, 5]]) {
      const p = mid(camera, x, y, 'W');
      assert.deepEqual(pickEdge(world, camera, p.x, p.y), { x, y, side: 'W' });
    }
  });

  test(`pickEdge ignores open floor (z=${z})`, () => {
    const { world, camera } = setup(z);
    const p = camera.gridToScreen(9.5, 9.5, 0);
    assert.equal(pickEdge(world, camera, p.x, p.y), null);
    assert.equal(pickEdge(world, camera, -500, -500), null);
  });

  test(`pickEdge skips front walls and broken edges (z=${z})`, () => {
    const { world, camera } = setup(z);
    const { grid } = world;
    let front = null;
    for (const [k] of grid.edges) {
      const [x, y, side] = k.split(',');
      if (isFrontWall(grid, +x, +y, side)) front = { x: +x, y: +y, side };
    }
    assert.ok(front);
    const p = mid(camera, front.x, front.y, front.side);
    const hit = pickEdge(world, camera, p.x, p.y);
    assert.ok(!hit || (hit.x !== front.x || hit.y !== front.y || hit.side !== front.side));
    grid.damageEdge(7, 3, 'W', Infinity);
    const q = mid(camera, 7, 3, 'W');
    const h2 = pickEdge(world, camera, q.x, q.y);
    assert.ok(!h2 || h2.y !== 3 || h2.x !== 7 || h2.side !== 'W');
  });
}

for (const z of [1, 3.2]) {
  test(`pickEdge types filter: window yes, drywall partition no (z=${z})`, () => {
    const { world, camera } = setup(z);
    const win = camera.gridToScreen(5.5, 2, 0.8);
    assert.deepEqual(pickEdge(world, camera, win.x, win.y, { types: ['window'] }), { x: 5, y: 2, side: 'N' });
    const wall = mid(camera, 7, 3, 'W');
    assert.equal(pickEdge(world, camera, wall.x, wall.y, { types: ['window'] }), null);
    assert.deepEqual(pickEdge(world, camera, wall.x, wall.y), { x: 7, y: 3, side: 'W' });
  });

  test(`pickInspector hits an inspector and misses elsewhere (z=${z})`, () => {
    const { camera } = setup(z);
    const g = new Grid(level);
    g.inspectors = level.inspectors;
    const w2 = createWorld({ grid: g });
    const i = w2.snapshot().inspectors[0];
    assert.ok(i);
    const p = camera.gridToScreen(i.x, i.y, 0.5);
    assert.equal(pickInspector(w2, camera, p.x, p.y)?.id, i.id);
    assert.equal(pickInspector(w2, camera, p.x + 200, p.y + 200), null);
    assert.equal(pickInspector(w2, camera, -500, -500), null);
  });
}

const setupTop = (z = 1) => {
  const r = setup(z);
  r.camera.setProjection('top');
  return r;
};

test('top: pickItem hits the footprint cell and tolerates a near miss', () => {
  const { world, camera } = setupTop();
  const desk = world.items.list().find((i) => i.kind === 'desk');
  const inside = camera.gridToScreen(desk.x + 1.5, desk.y + 0.5);
  assert.equal(pickItem(world, camera, inside.x, inside.y)?.kind === 'monitor' || pickItem(world, camera, inside.x, inside.y)?.id === desk.id, true);
  const chair = world.items.list().find((i) => i.kind === 'chair');
  const c = camera.gridToScreen(chair.x + 0.5, chair.y + 0.5);
  assert.equal(pickItem(world, camera, c.x, c.y)?.id, chair.id);
  const near = camera.gridToScreen(chair.x + 1.4, chair.y + 0.5);
  assert.ok(pickItem(world, camera, near.x, near.y));
  assert.equal(pickItem(world, camera, -500, -500), null);
});

test('top: pickCrew and pickInspector use grid distance', () => {
  const { world, camera } = setupTop();
  const c = world.crew[2];
  const p = camera.gridToScreen(c.x + 0.3, c.y - 0.3);
  assert.equal(pickCrew(world, camera, p.x, p.y)?.id, c.id);
  const far = camera.gridToScreen(c.x + 3, c.y + 3);
  assert.notEqual(pickCrew(world, camera, far.x, far.y)?.id, c.id);
  const fake = { crew: [], inspectors: [{ id: 'i1', x: 5, y: 5 }] };
  const q = camera.gridToScreen(5.4, 5.3);
  assert.equal(pickInspector(fake, camera, q.x, q.y)?.id, 'i1');
  const q2 = camera.gridToScreen(7, 7);
  assert.equal(pickInspector(fake, camera, q2.x, q2.y), null);
});

test('top: pickEdge is touch-generous and includes front-facing edges', () => {
  const { world, camera } = setupTop();
  for (const [x, y] of [[7, 3], [12, 5]]) {
    const p = camera.gridToScreen(x + 0.3, y + 0.5);
    assert.deepEqual(pickEdge(world, camera, p.x, p.y), { x, y, side: 'W' });
  }
  const { grid } = world;
  let found = false;
  for (const k of grid.edges.keys()) {
    const [x, y, side] = k.split(',');
    if (isFrontWall(grid, +x, +y, side) && !grid.edges.get(k).broken) {
      const mx = side === 'N' ? +x + 0.5 : +x;
      const my = side === 'N' ? +y : +y + 0.5;
      const p = camera.gridToScreen(mx, my);
      assert.ok(pickEdge(world, camera, p.x, p.y));
      found = true;
      break;
    }
  }
  assert.ok(found);
  const sky = camera.gridToScreen(-5, -5);
  assert.equal(pickEdge(world, camera, sky.x, sky.y), null);
});
