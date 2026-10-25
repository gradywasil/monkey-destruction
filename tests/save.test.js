import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSave, migrate } from '../src/platform/save.js';

const mem = (init) => {
  const m = new Map(init);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m };
};

test('defaults when empty, undefined or corrupt', () => {
  for (const storage of [mem(), undefined, mem([['imi-takeover-v1', '{bad']])]) {
    const p = createSave({ storage }).get();
    assert.equal(p.bank, 0);
    assert.deepEqual(p.tutorial, { done: false, step: 0 });
    assert.equal(p.settings.hints, true);
  }
});

test('throwing storage falls back to memory', () => {
  const storage = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const s = createSave({ storage });
  s.setSetting('sound', false);
  assert.equal(s.get().settings.sound, false);
});

test('get returns a deep copy', () => {
  const s = createSave({ storage: mem() });
  s.get().bank = 99;
  assert.equal(s.get().bank, 0);
});

test('recordResult banks profit', () => {
  const s = createSave({ storage: mem() });
  const r = s.recordResult({ jobId: 'a', profit: 1200, stars: 3 });
  assert.equal(r.bankDelta, 1200);
  assert.equal(s.get().jobs.a.bestNet, 1200);
  assert.equal(s.get().bank, 1200);
});

test('recordResult math and newBest', () => {
  const storage = mem();
  const s = createSave({ storage });
  let r = s.recordResult({ jobId: 'a', net: 500, delivered: 3, fines: 0, stars: 2 });
  assert.equal(r.bankDelta, 500);
  assert.equal(r.newBest, true);
  r = s.recordResult({ jobId: 'a', net: 300, stars: 1 });
  assert.equal(r.newBest, false);
  r = s.recordResult({ jobId: 'a', net: -50, stars: 0 });
  assert.equal(r.bankDelta, 0);
  const j = s.get().jobs.a;
  assert.deepEqual(j, { bestStars: 2, bestNet: 500, plays: 3 });
  assert.equal(s.get().bank, 800);
  assert.equal(createSave({ storage }).get().bank, 800);
});

test('migrate fills missing fields', () => {
  const p = migrate({ version: 0, bank: 5, jobs: { x: { plays: 2 } } });
  assert.equal(p.version, 1);
  assert.equal(p.bank, 5);
  assert.deepEqual(p.jobs.x, { bestStars: 0, bestNet: 0, plays: 2 });
  assert.equal(p.settings.debug, false);
  assert.equal(migrate(null).bank, 0);
});

test('setTutorial, update and reset', () => {
  const s = createSave({ storage: mem() });
  s.setTutorial({ step: 3 });
  assert.equal(s.get().tutorial.step, 3);
  s.update((p) => { p.bank = 7; });
  assert.equal(s.get().bank, 7);
  s.reset();
  assert.equal(s.get().bank, 0);
  assert.equal(s.get().tutorial.step, 0);
});

test('migrate adds unlocks and owned to old profiles', () => {
  const p = migrate({ version: 1, bank: 9 });
  assert.deepEqual(p.unlocks, []);
  assert.deepEqual(p.owned, ['dunmore-pike']);
  assert.deepEqual(migrate({ owned: ['x', 'x', 5], unlocks: 'bad' }).owned, ['dunmore-pike', 'x']);
  assert.deepEqual(createSave({ storage: mem([['imi-takeover-v1', '{"bank":3}']]) }).get().owned, ['dunmore-pike']);
});

test('purchase deducts, rejects poor/owned/unknown and persists', () => {
  const storage = mem();
  const s = createSave({ storage });
  assert.deepEqual(s.purchase('upgrade', 'bionic-fists', 1500), { ok: false, reason: 'poor' });
  s.update((p) => { p.bank = 5000; });
  const r = s.purchase('upgrade', 'bionic-fists', 1500);
  assert.equal(r.ok, true);
  assert.equal(r.profile.bank, 3500);
  assert.deepEqual(r.profile.unlocks, ['bionic-fists']);
  assert.deepEqual(s.purchase('upgrade', 'bionic-fists', 1500), { ok: false, reason: 'owned' });
  assert.equal(s.purchase('job', 'dunmore-pike', 0).reason, 'owned');
  assert.equal(s.purchase('job', 'fairfax-credit-union', 2500).ok, true);
  assert.equal(s.purchase('car', 'x', 1).reason, 'unknown');
  const again = createSave({ storage }).get();
  assert.equal(again.bank, 1000);
  assert.deepEqual(again.owned, ['dunmore-pike', 'fairfax-credit-union']);
  assert.deepEqual(again.unlocks, ['bionic-fists']);
});

test('settings.view defaults to iso, persists top, and rejects junk', () => {
  assert.equal(migrate({}).settings.view, 'iso');
  assert.equal(migrate({ settings: { view: 'top' } }).settings.view, 'top');
  assert.equal(migrate({ settings: { view: 'sideways' } }).settings.view, 'iso');
  assert.equal(migrate({ settings: { sound: false } }).settings.view, 'iso');
});
