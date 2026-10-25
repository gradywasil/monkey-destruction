import test from 'node:test';
import assert from 'node:assert/strict';
import { UPGRADES, canBuy, upgradeById } from '../src/data/upgrades.js';
import { JOBS, jobById } from '../src/data/jobs.js';

test('catalogue ids are unique and requires resolve', () => {
  assert.equal(new Set(UPGRADES.map((u) => u.id)).size, UPGRADES.length);
  for (const u of UPGRADES) for (const r of u.requires) assert.ok(upgradeById(r), r);
  assert.equal(jobById('gilded-trust-tower').cost, 9000);
  assert.equal(JOBS[0].cost, 0);
});

test('canBuy: owned, locked, poor, ok', () => {
  const legs1 = upgradeById('bionic-legs-1');
  const legs2 = upgradeById('bionic-legs-2');
  assert.deepEqual(canBuy(legs1, [], 1499), { ok: false, reason: 'poor' });
  assert.deepEqual(canBuy(legs1, [], 1500), { ok: true });
  assert.deepEqual(canBuy(legs1, ['bionic-legs-1'], 9999), { ok: false, reason: 'owned' });
  assert.deepEqual(canBuy(legs2, [], 99999), { ok: false, reason: 'locked' });
  assert.deepEqual(canBuy(legs2, ['bionic-legs-1'], 4999), { ok: false, reason: 'poor' });
  assert.deepEqual(canBuy(legs2, new Set(['bionic-legs-1']), 5000), { ok: true });
});

test('requires chains: shredder-2 needs shredder-truck', () => {
  assert.equal(canBuy(upgradeById('shredder-2'), [], 1e6).reason, 'locked');
  assert.equal(canBuy(upgradeById('shredder-2'), ['shredder-truck'], 9000).ok, true);
});

test('economy v2 upgrades: costs and requires', () => {
  assert.equal(upgradeById('recruiter-1').cost, 1200);
  assert.deepEqual(upgradeById('recruiter-2').requires, ['recruiter-1']);
  assert.equal(canBuy(upgradeById('recruiter-2'), [], 1e6).reason, 'locked');
  assert.equal(upgradeById('headhunter').cost, 2500);
  assert.equal(upgradeById('barracks-1').cost, 3000);
  assert.equal(upgradeById('barracks-2').cost, 7000);
});
