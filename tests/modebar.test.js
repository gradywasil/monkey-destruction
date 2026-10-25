import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMode, MODE_COPY, CHAIN_COPY } from '../src/ui/modebar.js';

test('none and unknown modes have no banner', () => {
  assert.deepEqual(describeMode('none'), { mode: 'none', step: 0, total: 0, text: '' });
  assert.equal(describeMode('bogus').mode, 'none');
});

test('chain is a two-step flow driven by the first tap', () => {
  const a = describeMode('chain');
  assert.equal(a.step, 1);
  assert.equal(a.total, 2);
  assert.equal(a.text, CHAIN_COPY[0]);
  const b = describeMode('chain', { chainPicked: true });
  assert.equal(b.step, 2);
  assert.equal(b.text, CHAIN_COPY[1]);
  assert.match(b.text, /AGAIN/);
});

test('single-step modes carry their copy', () => {
  for (const m of Object.keys(MODE_COPY)) {
    const d = describeMode(m);
    assert.equal(d.mode, m);
    assert.equal(d.total, 1);
    assert.equal(d.text, MODE_COPY[m]);
  }
  assert.match(describeMode('whistle').text, /HEAVY/);
});
