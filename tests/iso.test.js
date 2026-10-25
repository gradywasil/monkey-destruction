import test from 'node:test';
import assert from 'node:assert/strict';
import { gridToScreen, screenToGrid, tileAt, tileDiamond, depthKey, sortDrawables, worldBounds, LAYER } from '../src/render/iso.js';
import { LODS } from '../src/render/lod.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('gridToScreen basics and unknown lod', () => {
  assert.deepEqual(gridToScreen(0, 0, 0, 'lo'), { x: 0, y: 0 });
  assert.deepEqual(gridToScreen(1, 0, 0, 'lo'), { x: 20, y: 10 });
  assert.deepEqual(gridToScreen(0, 1, 0, 'hi'), { x: -32, y: 16 });
  assert.deepEqual(gridToScreen(0, 0, 2, 'hi'), { x: 0, y: -120 });
  assert.throws(() => gridToScreen(0, 0, 0, 'mid'));
});

test('round trip', () => {
  for (const lod of ['lo', 'hi']) {
    for (const [x, y] of [[0, 0], [3.5, 5.25], [10, 2], [-1.5, 7]]) {
      for (const z of [0, 1, 2.5]) {
        const s = gridToScreen(x, y, z, lod);
        const g = screenToGrid(s.x, s.y, lod, z);
        close(g.x, x);
        close(g.y, y);
      }
    }
  }
});

test('tileAt centres, edges, corners', () => {
  for (const lod of ['lo', 'hi']) {
    const c = gridToScreen(3.5, 5.5, 0, lod);
    assert.deepEqual(tileAt(c.x, c.y, lod), { x: 3, y: 5 });
    const [top, right, bottom, left] = tileDiamond(3, 5, lod);
    assert.deepEqual(tileAt(top.x, top.y, lod), { x: 3, y: 5 });
    assert.deepEqual(tileAt(left.x, left.y, lod), { x: 3, y: 6 });
    assert.deepEqual(tileAt(right.x, right.y, lod), { x: 4, y: 5 });
    assert.deepEqual(tileAt(bottom.x, bottom.y, lod), { x: 4, y: 6 });
    const e = gridToScreen(3.5, 5.01, 0, lod);
    assert.deepEqual(tileAt(e.x, e.y, lod), { x: 3, y: 5 });
  }
  const raised = gridToScreen(3.5, 5.5, 2, 'lo');
  assert.deepEqual(tileAt(raised.x, raised.y, 'lo', 2), { x: 3, y: 5 });
});

test('tileDiamond geometry', () => {
  for (const lod of ['lo', 'hi']) {
    const { tileW, tileH } = LODS[lod];
    const [t, r, b, l] = tileDiamond(4, 2, lod);
    assert.equal(r.x - l.x, tileW);
    assert.equal(b.y - t.y, tileH);
    assert.equal(t.x, b.x);
    assert.equal(l.y, r.y);
  }
});

test('depth sorting', () => {
  const backWall = { id: 'wall', gx: 2, gy: 0, w: 0, d: 1, layer: LAYER.BACK_WALL };
  const ch = { id: 'ch', gx: 2, gy: 2, layer: LAYER.CHARACTER };
  const prop = { id: 'prop', gx: 2, gy: 2, w: 1, d: 1, layer: LAYER.PROP };
  const list = sortDrawables([prop, ch, backWall]);
  assert.deepEqual(list.map(d => d.id), ['wall', 'ch', 'prop']);
  assert.ok(depthKey(backWall) < depthKey(ch));
  assert.ok(depthKey(ch) < depthKey(prop));
});

test('sort ties, layers and stability', () => {
  const a = { id: 'a', gx: 1, gy: 1, layer: 3 };
  const b = { id: 'b', gx: 1, gy: 1, layer: 3 };
  const c = { id: 'c', gx: 1, gy: 1, layer: 0 };
  const d = { id: 'd', gx: 2, gy: 0, layer: 0 };
  const list = [a, d, b, c];
  assert.equal(sortDrawables(list), list);
  assert.deepEqual(list.map(x => x.id), ['c', 'd', 'a', 'b']);
  const again = sortDrawables([b, a, d, c]);
  assert.deepEqual(again.map(x => x.id), ['c', 'd', 'b', 'a']);
});

test('worldBounds 10x8', () => {
  assert.deepEqual(worldBounds(10, 8, 'lo'), { minX: -160, minY: -60, maxX: 200, maxY: 180 });
  assert.deepEqual(worldBounds(10, 8, 'hi'), { minX: -256, minY: -120, maxX: 320, maxY: 288 });
  assert.equal(worldBounds(10, 8, 'lo', 1).minY, -30);
});
