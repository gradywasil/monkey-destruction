import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseLead, outsideDeadZone, createDirector } from '../src/render/director.js';

const C = (id, pose, extra = {}) => ({ id, pose, x: 0, y: 0, carrying: null, ...extra });

test('chooseLead: none when everyone is idle', () => {
  assert.equal(chooseLead([C('a', 'idle'), C('b', 'idle')], null), null);
  assert.equal(chooseLead([], null), null);
});

test('chooseLead: prefers a carrier, then lowest id; sticks with the current lead while busy', () => {
  const crew = [C('c3', 'walk'), C('c1', 'walk'), C('c2', 'carry', { carrying: 'desk1' })];
  assert.equal(chooseLead(crew, null), 'c2');
  assert.equal(chooseLead([C('c3', 'walk'), C('c1', 'walk')], null), 'c1');
  assert.equal(chooseLead(crew, 'c3'), 'c3');
  assert.equal(chooseLead([C('c3', 'idle'), C('c1', 'walk')], 'c3'), 'c1');
});

test('outsideDeadZone: only moves once the lead leaves the central region', () => {
  const centre = { x: 195, y: 400 };
  const band = { w: 390, h: 570 };
  assert.equal(outsideDeadZone({ x: 200, y: 420 }, centre, band), false);
  assert.equal(outsideDeadZone({ x: 195 + 130, y: 400 }, centre, band), true);
  assert.equal(outsideDeadZone({ x: 195, y: 400 - 170 }, centre, band), true);
});

test('director: follows a drifting lead, respects the user hold, and does nothing when idle', () => {
  const focused = [];
  const lead = { id: 'c1', pose: 'walk', x: 10, y: 10 };
  const camera = {
    isBusy: () => false,
    gridToScreen: (x) => ({ x: x * 40, y: 400 }),
    viewCenter: () => ({ x: 195, y: 400 }),
    focus: (x, y, o) => focused.push([x, y, o.duration])
  };
  const d = createDirector({ camera, band: () => ({ w: 390, h: 570 }) });
  d.update(0.6, { crew: [lead] });
  assert.equal(focused.length, 1, 'lead at x=400px is outside the dead zone');
  assert.deepEqual(focused[0].slice(0, 2), [10, 10]);

  lead.x = 5;
  d.update(0.6, { crew: [lead] });
  assert.equal(focused.length, 1, 'x=200px is inside the dead zone');

  lead.x = 12;
  d.hold(2);
  d.update(0.6, { crew: [lead] });
  d.update(0.6, { crew: [lead] });
  assert.equal(focused.length, 1, 'held while the player has the wheel');
  d.update(1, { crew: [lead] });
  assert.equal(focused.length, 2, 'resumes after the hold');

  d.update(0.6, { crew: [{ ...lead, pose: 'idle' }] });
  assert.equal(focused.length, 2);
});

test('director: stays off while the camera is already moving or disabled', () => {
  let busy = true;
  const focused = [];
  const camera = { isBusy: () => busy, gridToScreen: () => ({ x: 999, y: 0 }), viewCenter: () => ({ x: 195, y: 400 }), focus: () => focused.push(1) };
  const d = createDirector({ camera, band: () => ({ w: 390, h: 570 }) });
  d.update(0.6, { crew: [C('a', 'walk')] });
  assert.equal(focused.length, 0);
  busy = false;
  d.setEnabled(false);
  d.update(0.6, { crew: [C('a', 'walk')] });
  assert.equal(focused.length, 0);
  d.setEnabled(true);
  d.update(0.6, { crew: [C('a', 'walk')] });
  assert.equal(focused.length, 1);
});
