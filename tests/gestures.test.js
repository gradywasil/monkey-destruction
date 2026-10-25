import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGestureRecognizer } from '../src/platform/gestures.js';

function setup() {
  const rec = createGestureRecognizer({});
  const log = [];
  for (const type of [
    'tap', 'longpressstart', 'longpressmove', 'longpressend',
    'dragstart', 'drag', 'dragend', 'pinchstart', 'pinch', 'pinchend'
  ]) {
    rec.on(type, (e) => log.push({ type, ...e }));
  }
  const types = () => log.map((e) => e.type);
  return { rec, log, types };
}

test('quick tap emits tap', () => {
  const { rec, types } = setup();
  rec.pointerDown(1, 10, 10, 0);
  rec.pointerUp(1, 10, 10, 100);
  assert.deepEqual(types(), ['tap']);
});

test('jitter within slop is still a tap', () => {
  const { rec, types } = setup();
  rec.pointerDown(1, 10, 10, 0);
  rec.pointerMove(1, 14, 12, 50);
  rec.pointerUp(1, 14, 12, 100);
  assert.deepEqual(types(), ['tap']);
});

test('movement beyond slop drags and does not tap', () => {
  const { rec, log, types } = setup();
  rec.pointerDown(1, 10, 10, 0);
  rec.pointerMove(1, 30, 10, 50);
  rec.pointerMove(1, 40, 15, 80);
  rec.pointerUp(1, 40, 15, 100);
  assert.deepEqual(types(), ['dragstart', 'drag', 'drag', 'dragend']);
  assert.equal(log[2].dx, 10);
  assert.equal(log[2].dy, 5);
});

test('hold without moving emits longpress, no tap', () => {
  const { rec, types } = setup();
  rec.pointerDown(1, 10, 10, 0);
  rec.tick(400);
  rec.pointerUp(1, 10, 10, 410);
  assert.deepEqual(types(), ['longpressstart', 'longpressend']);
});

test('two-finger pinch scales and ends', () => {
  const { rec, log, types } = setup();
  rec.pointerDown(1, 0, 0, 0);
  rec.pointerDown(2, 100, 0, 10);
  rec.pointerMove(2, 200, 0, 20);
  rec.pointerUp(2, 200, 0, 30);
  assert.deepEqual(types(), ['pinchstart', 'pinch', 'pinchend']);
  assert.ok(Math.abs(log[1].scale - 2) < 1e-9);
  assert.ok(Math.abs(log[1].delta - 2) < 1e-9);
});

test('leftover finger after pinch emits no tap or drag', () => {
  const { rec, types } = setup();
  rec.pointerDown(1, 0, 0, 0);
  rec.pointerDown(2, 100, 0, 10);
  rec.pointerUp(2, 100, 0, 20);
  rec.pointerMove(1, 50, 50, 30);
  rec.pointerUp(1, 50, 50, 40);
  assert.deepEqual(types(), ['pinchstart', 'pinchend']);
});

test('second finger during drag ends drag then starts pinch', () => {
  const { rec, types } = setup();
  rec.pointerDown(1, 0, 0, 0);
  rec.pointerMove(1, 30, 0, 20);
  rec.pointerDown(2, 100, 0, 40);
  assert.deepEqual(types(), ['dragstart', 'drag', 'dragend', 'pinchstart']);
});
