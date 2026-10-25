import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFlow } from '../src/ui/flow.js';

const CASES = [
  ['title', 'play', 'map'],
  ['map', 'select', 'briefing'],
  ['map', 'back', 'title'],
  ['briefing', 'start', 'playing'],
  ['briefing', 'back', 'map'],
  ['playing', 'pause', 'paused'],
  ['paused', 'resume', 'playing'],
  ['paused', 'restart', 'playing'],
  ['paused', 'quit', 'title'],
  ['playing', 'cleared', 'results'],
  ['results', 'continue', 'map'],
  ['results', 'retry', 'playing']
];

for (const [from, ev, to] of CASES) {
  test(`${from} --${ev}--> ${to}`, () => {
    const f = createFlow(from);
    const seen = [];
    f.onChange((n, o, e) => seen.push([n, o, e]));
    assert.equal(f.dispatch(ev), true);
    assert.equal(f.state, to);
    assert.deepEqual(seen, [[to, from, ev]]);
  });
}

test('defaults to title', () => {
  assert.equal(createFlow().state, 'title');
});

test('unknown or invalid events are ignored', () => {
  const f = createFlow();
  let n = 0;
  f.onChange(() => n++);
  assert.equal(f.dispatch('pause'), false);
  assert.equal(f.dispatch('nope'), false);
  assert.equal(f.state, 'title');
  assert.equal(n, 0);
});

test('onChange unsubscribe', () => {
  const f = createFlow();
  let n = 0;
  const off = f.onChange(() => n++);
  off();
  f.dispatch('play');
  assert.equal(n, 0);
});
