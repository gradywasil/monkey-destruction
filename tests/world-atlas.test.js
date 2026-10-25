import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapToPalette, crispify, boxPolygons } from '../src/render/world-atlas.js';
import { E32 } from '../src/render/lod.js';

test('snapToPalette maps palette colours to themselves', () => {
  for (const hex of E32) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.equal(snapToPalette(r, g, b), hex);
  }
});

test('snapToPalette maps near-white to white', () => {
  assert.equal(snapToPalette(250, 252, 249), '#ffffff');
});

test('crispify removes partial alpha and snaps colours', () => {
  const px = crispify(new Uint8ClampedArray([250, 250, 250, 200, 10, 10, 10, 60]));
  assert.deepEqual([...px], [255, 255, 255, 255, 0, 0, 0, 0]);
});

test('boxPolygons 1x1x1 lo top face', () => {
  const b = boxPolygons(1, 1, 1, 'lo');
  assert.deepEqual(b.top, [[0, -30], [20, -20], [0, -10], [-20, -20]]);
  assert.deepEqual(b.left[0], [-20, 10]);
  assert.deepEqual(b.right[1], [0, 20]);
});
