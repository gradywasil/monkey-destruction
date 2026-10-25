import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTutorial, TUTORIAL_STEPS } from '../src/ui/tutorial.js';

test('has at most five steps and every spoken step has copy', () => {
  assert.ok(TUTORIAL_STEPS.length <= 5);
  const known = new Set(['item', 'truck']);
  for (const s of TUTORIAL_STEPS) {
    if (s.target) assert.ok(known.has(s.target), s.id);
    if (!s.silent) assert.ok(s.text, s.id);
  }
});

test('advances only on the current step event', () => {
  const t = createTutorial();
  assert.equal(t.current().id, 'pick');
  t.feed('hire');
  t.feed('nudge:sealed');
  t.feed('pin');
  assert.equal(t.index(), 0);
  t.feed('card');
  assert.equal(t.current().id, 'pin');
  t.feed('pin');
  assert.equal(t.current().id, 'hire');
});

test('the hire step points at HIRE and hiring moves on to the work step', () => {
  const t = createTutorial({ startAt: 2 });
  assert.equal(t.current().id, 'hire');
  assert.equal(t.current().focus, 'hire:hauler');
  t.feed('hire');
  assert.equal(t.current().id, 'work');
});

test('timed steps complete on their own so the player is never blocked', () => {
  const t = createTutorial({ startAt: 1 });
  t.tick(24.9);
  assert.equal(t.current().id, 'pin');
  t.tick(0.2);
  assert.equal(t.current().id, 'hire');
  t.tick(119);
  assert.equal(t.current().id, 'hire');
  t.tick(2);
  assert.equal(t.current().id, 'work');
  t.tick(8);
  assert.equal(t.current().id, 'breacher');
  t.tick(1000);
  assert.equal(t.current().id, 'breacher');
  t.feed('nudge:sealed');
  assert.equal(t.done(), true);
});

test('timer resets when the step changes', () => {
  const t = createTutorial({ startAt: 1 });
  t.tick(20);
  t.feed('pin');
  t.tick(100);
  assert.equal(t.current().id, 'hire');
});

test('completes after the last step and notifies', () => {
  const t = createTutorial();
  const seen = [];
  t.onChange((s) => seen.push(s && s.id));
  for (const s of TUTORIAL_STEPS) t.feed([].concat(s.until)[0]);
  assert.equal(t.done(), true);
  assert.equal(t.current(), null);
  assert.equal(seen.at(-1), null);
});

test('skip ends and fires null', () => {
  const t = createTutorial();
  let last = 'unset';
  t.onChange((s) => { last = s; });
  t.skip();
  assert.equal(t.done(), true);
  assert.equal(last, null);
});

test('startAt, start and back', () => {
  const t = createTutorial({ startAt: 2 });
  let got;
  t.onChange((s) => { got = s; });
  t.start();
  assert.equal(got.id, 'hire');
  t.back();
  assert.equal(t.current().id, 'pin');
  assert.equal(createTutorial({ startAt: 99 }).done(), true);
});
