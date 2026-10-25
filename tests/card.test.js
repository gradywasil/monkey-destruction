import test from 'node:test';
import assert from 'node:assert/strict';
import { placeCard } from '../src/ui/card.js';

const area = { width: 390, top: 128, bottom: 702 };
const size = { w: 224, h: 120 };

test('placeCard: sits above the anchor when there is room', () => {
  const p = placeCard({ x: 195, y: 400 }, size, area);
  assert.equal(p.below, false);
  assert.equal(p.top, 400 - 22 - 120);
  assert.equal(p.left, 195 - 112);
});

test('placeCard: flips below when the anchor is near the top bar', () => {
  const p = placeCard({ x: 195, y: 150 }, size, area);
  assert.equal(p.below, true);
  assert.equal(p.top, 172);
});

test('placeCard: clamps to the screen edges', () => {
  assert.equal(placeCard({ x: 5, y: 400 }, size, area).left, 8);
  assert.equal(placeCard({ x: 385, y: 400 }, size, area).left, 390 - 8 - 224);
});

test('placeCard: stays inside the band when neither side fits', () => {
  const tall = { w: 224, h: 520 };
  const p = placeCard({ x: 195, y: 400 }, tall, area);
  assert.ok(p.top >= area.top && p.top + tall.h <= area.bottom + 1);
});
