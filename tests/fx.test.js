import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFx } from '../src/render/fx.js';

test('debris emits chips that expire', () => {
  const fx = createFx();
  fx.emit('debris', 5, 5, 0.8, { color: '#ead4aa' });
  assert.ok(fx.count >= 3 && fx.count <= 5);
  fx.update(0.1);
  assert.ok(fx.count > 0);
  fx.update(2);
  assert.equal(fx.count, 0);
});

test('burst emits chips plus dust; sparkle rises', () => {
  const fx = createFx();
  fx.emit('burst', 1, 1, 0.8);
  assert.ok(fx.count >= 13 && fx.count <= 17);
  fx.clear();
  fx.emit('sparkle', 1, 1, 0);
  const z0 = fx.particles[0].gz;
  fx.update(0.1);
  assert.ok(fx.particles[0].gz > z0);
});

test('particle count is capped at 200', () => {
  const fx = createFx();
  for (let i = 0; i < 40; i++) fx.emit('burst', 1, 1, 1);
  assert.equal(fx.count, 200);
});

test('same seed gives identical particles', () => {
  const run = () => {
    const fx = createFx(3);
    fx.emit('burst', 2, 3, 1);
    fx.update(0.2);
    return JSON.stringify(fx.particles);
  };
  assert.equal(run(), run());
});

test('draw fills squares through the camera', () => {
  const fx = createFx();
  fx.emit('puff', 1, 1, 0);
  const rects = [];
  const ctx = { fillRect: (...a) => rects.push(a), set fillStyle(v) {}, set globalAlpha(v) {} };
  fx.draw(ctx, { transform: () => ({ lod: 'hi' }), gridToScreen: () => ({ x: 10, y: 10 }) });
  assert.equal(rects.length, 3);
});
