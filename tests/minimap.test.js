import { test } from 'node:test';
import assert from 'node:assert/strict';
import { miniScale, gridToMini, miniToGrid, viewportQuad, roleColor } from '../src/ui/minimap.js';

test('miniScale fits 80x62 with min 2', () => {
  assert.equal(miniScale(16, 12), 5);
  assert.equal(miniScale(100, 100), 2);
  assert.equal(miniScale(8, 8), 7);
});

test('gridToMini / miniToGrid round trip and clamp', () => {
  const g = { width: 16, height: 12 };
  const p = gridToMini(3.5, 2, 5);
  assert.deepEqual(p, { x: 17.5, y: 10 });
  assert.deepEqual(miniToGrid(p.x, p.y, 5, g), { x: 3.5, y: 2 });
  assert.deepEqual(miniToGrid(-10, 999, 5, g), { x: 0, y: 12 });
});

test('viewportQuad bounds and clamps', () => {
  const g = { width: 16, height: 12 };
  const cam = {
    state: { viewW: 100, viewH: 200 },
    screenToGrid: (sx, sy) => ({ x: sx / 10 - 2, y: sy / 10 }),
  };
  assert.deepEqual(viewportQuad(cam, g), { x0: 0, y0: 0, x1: 8, y1: 12 });
  assert.deepEqual(viewportQuad(cam, g, { w: 50, h: 50 }), { x0: 0, y0: 0, x1: 3, y1: 5 });
});

test('roleColor', () => {
  assert.equal(roleColor('breacher'), '#f77622');
  assert.equal(roleColor('hauler'), '#63c74d');
  assert.equal(roleColor('rigger'), '#0099db');
  assert.equal(roleColor('decoy'), '#b55088');
  assert.match(roleColor('???'), /^#/);
});
