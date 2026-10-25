import test from 'node:test';
import assert from 'node:assert/strict';
import { boxOverlap, occluders } from '../src/render/occlusion.js';

const box = (x, y, w, h) => ({ x, y, w, h });

test('boxOverlap detects overlap, touching edges and separation', () => {
  assert.equal(boxOverlap(box(0, 0, 10, 10), box(5, 5, 10, 10)), true);
  assert.equal(boxOverlap(box(0, 0, 10, 10), box(2, 2, 3, 3)), true);
  assert.equal(boxOverlap(box(0, 0, 10, 10), box(10, 0, 5, 5)), false);
  assert.equal(boxOverlap(box(0, 0, 10, 10), box(0, 11, 5, 5)), false);
  assert.equal(boxOverlap(box(20, 20, 4, 4), box(0, 0, 10, 10)), false);
});

test('occluders returns overlapping later non-crew, non-carried drawables only', () => {
  const list = [
    { id: 'wallBefore', b: box(0, 0, 50, 50) },
    { id: 'crew', crew: {}, b: box(10, 10, 10, 10) },
    { id: 'otherCrew', crew: {}, b: box(10, 10, 10, 10) },
    { id: 'carried', prop: { kind: 'box' }, b: box(10, 10, 10, 10) },
    { id: 'far', b: box(100, 100, 5, 5) },
    { id: 'prop', b: box(15, 15, 10, 10) },
    { id: 'wall', b: box(0, 0, 12, 12) }
  ];
  const boxOf = (d) => d.b;
  assert.deepEqual(occluders(list, 1, boxOf), [5, 6]);
  assert.deepEqual(occluders(list, 6, boxOf), []);
});

test('occluders tolerates a missing box', () => {
  const list = [{ crew: {}, b: box(0, 0, 4, 4) }, { b: null }];
  assert.deepEqual(occluders(list, 0, (d) => d.b), []);
  assert.deepEqual(occluders(list, 1, (d) => d.b), []);
});
