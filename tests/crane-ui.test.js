import test from 'node:test';
import assert from 'node:assert/strict';
import { craneFailText, craneLabel } from '../src/ui/crane-ui.js';

test('craneFailText maps reasons with a fallback', () => {
  assert.equal(craneFailText('too-light'), 'TOO LIGHT FOR THE CRANE');
  assert.equal(craneFailText('weird'), 'NOPE');
});

test('craneLabel shows cooldown seconds and busy state', () => {
  assert.equal(craneLabel({ state: 'idle', cooldown: 0 }), 'CRANE');
  assert.equal(craneLabel({ state: 'idle', cooldown: 41.2 }), 'CRANE 42s');
  assert.equal(craneLabel({ state: 'lift', cooldown: 0 }), 'CRANE...');
});
