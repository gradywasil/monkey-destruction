import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, formatClock, starsText, resultTitle } from '../src/ui/screens.js';

test('formatMoney', () => {
  assert.equal(formatMoney(12300), '$12,300');
  assert.equal(formatMoney(0), '$0');
  assert.equal(formatMoney(-150), '-$150');
});

test('formatClock', () => {
  assert.equal(formatClock(900), '15:00');
  assert.equal(formatClock(65), '01:05');
  assert.equal(formatClock(-3), '00:00');
});

test('starsText', () => {
  assert.equal(starsText(2), '★★☆');
  assert.equal(starsText(0), '☆☆☆');
  assert.equal(starsText(5), '★★★');
  assert.equal(starsText(undefined), '☆☆☆');
});

test('resultTitle', () => {
  assert.equal(resultTitle({ stars: 1 }), 'BUILDING STRIPPED!');
  assert.equal(resultTitle({ stars: 0 }), 'BUILDING STRIPPED!');
});

import { jobState, upgradeState } from '../src/ui/screens.js';
import { JOBS } from '../src/data/jobs.js';
import { UPGRADES } from '../src/data/upgrades.js';

test('jobState', () => {
  const [a, b] = JOBS;
  assert.equal(jobState(a, ['dunmore-pike'], 0).state, 'play');
  assert.equal(jobState(b, ['dunmore-pike'], 100).state, 'poor');
  assert.equal(jobState(b, ['dunmore-pike'], b.cost).state, 'buy');
  assert.equal(jobState(JOBS[2], ['dunmore-pike'], 1e6).state, 'locked');
});

test('upgradeState', () => {
  const u2 = UPGRADES.find((u) => u.id === 'bionic-legs-2');
  assert.equal(upgradeState(u2, [], 1e6).state, 'locked');
  assert.equal(upgradeState(u2, ['bionic-legs-1'], 1e6).state, 'buy');
  assert.equal(upgradeState(u2, ['bionic-legs-2'], 0).state, 'owned');
});
