import test from 'node:test';
import assert from 'node:assert/strict';
import { downsample2x } from '../src/render/atlas.js';
import { ROLES, POSES } from '../src/data/crew-roles.js';

function img4(fn) {
  const d = new Uint8ClampedArray(4 * 4 * 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) d.set(fn(x, y), (y * 4 + x) * 4);
  return d;
}
const px = (d, x, y, w = 2) => [...d.slice((y * w + x) * 4, (y * w + x) * 4 + 4)];

test('majority colour wins', () => {
  const d = img4((x, y) => (x < 2 && y < 2 ? (x === 1 && y === 1 ? [0, 0, 255, 255] : [255, 0, 0, 255]) : [0, 0, 0, 0]));
  assert.deepEqual(px(downsample2x(d, 4, 4), 0, 0), [255, 0, 0, 255]);
});

test('tie picks darker', () => {
  const d = img4((x, y) => (x < 2 && y < 2 ? (x === 0 ? [200, 200, 200, 255] : [10, 10, 10, 255]) : [0, 0, 0, 0]));
  assert.deepEqual(px(downsample2x(d, 4, 4), 0, 0), [10, 10, 10, 255]);
});

test('transparent block stays transparent', () => {
  const d = img4(() => [9, 9, 9, 100]);
  const o = downsample2x(d, 4, 4);
  assert.equal(o.length, 16);
  assert.deepEqual(px(o, 1, 1), [0, 0, 0, 0]);
});

test('roles are well formed', () => {
  for (const r of Object.values(ROLES)) {
    assert.ok(r.variants.length > 0);
    assert.ok(POSES.includes(r.pose));
  }
});
