import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../src/platform/stage.js';

test('iPhone 390x844 dpr 3', () => {
  const l = computeLayout({ vw: 390, vh: 844, dpr: 3 });
  assert.equal(l.k, 1);
  assert.equal(l.width, 390);
  assert.equal(l.height, 844);
  assert.equal(l.backingWidth, 1170);
  assert.equal(l.backingHeight, 2532);
  assert.equal(l.offsetX, 0);
  assert.equal(l.offsetY, 0);
});

test('Pixel 412x915 dpr 2.625', () => {
  const l = computeLayout({ vw: 412, vh: 915, dpr: 2.625 });
  assert.equal(l.k, 1);
  assert.equal(l.backingWidth, Math.round(412 * 2.625));
  assert.equal(l.backingHeight, Math.round(915 * 2.625));
});

test('desktop 1440x900 caps width and centres', () => {
  const l = computeLayout({ vw: 1440, vh: 900, dpr: 1 });
  assert.equal(l.k, 1);
  assert.equal(l.height, 900);
  assert.equal(l.width, 675);
  assert.equal(l.offsetX, Math.floor((1440 - 675) / 2));
  assert.equal(l.offsetY, 0);
});

test('1920x1200 and 2560x1600 stay k 1', () => {
  assert.equal(computeLayout({ vw: 1920, vh: 1200, dpr: 1 }).k, 1);
  assert.equal(computeLayout({ vw: 2560, vh: 1600, dpr: 1 }).k, 1);
});

test('4K 3840x2160 upscales by 2', () => {
  const l = computeLayout({ vw: 3840, vh: 2160, dpr: 1 });
  assert.equal(l.k, 2);
  assert.equal(l.height, 1080);
  assert.equal(l.width, 810);
  assert.equal(l.cssWidth, 1620);
  assert.equal(l.cssHeight, 2160);
  assert.equal(l.offsetX, 1110);
  assert.equal(l.offsetY, 0);
  assert.equal(l.backingWidth, 1620);
});

test('landscape 844x390 is sane', () => {
  const l = computeLayout({ vw: 844, vh: 390, dpr: 2 });
  assert.equal(l.k, 1);
  for (const v of Object.values(l)) assert.ok(Number.isFinite(v));
  assert.ok(l.width > 0);
  assert.equal(l.width, Math.floor(390 * 0.75));
});
