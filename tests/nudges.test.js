import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseNudge } from '../src/ui/nudges.js';

const snap = (over = {}) => ({
  economy: { cash: 0, cleared: false },
  hire: {
    cap: 12,
    count: 2,
    roles: {
      hauler: { cost: 350, count: 2, canAfford: false },
      breacher: { cost: 1200, count: 0, canAfford: false },
      rigger: { cost: 1400, count: 0, canAfford: false },
      decoy: { cost: 1000, count: 0, canAfford: false }
    }
  },
  hints: { sealedValue: 0, heavyWaiting: 0, inspectorNear: false, idleHaulers: 0, idleBreachers: 0 },
  ...over
});
const withHints = (h, over = {}) => snap({ hints: { ...snap().hints, ...h }, ...over });

test('nothing to say on a quiet snapshot or without auto data', () => {
  assert.equal(chooseNudge(snap()), null);
  assert.equal(chooseNudge(null), null);
  assert.equal(chooseNudge({ hints: null }), null);
});

test('sealed loot with no breacher nudges toward BREACHER with the dollar amount', () => {
  const n = chooseNudge(withHints({ sealedValue: 12300 }));
  assert.equal(n.id, 'sealed');
  assert.equal(n.pulse, 'breacher');
  assert.match(n.text, /\$12,300/);
  assert.match(n.text, /HIRE A BREACHER/);
});

test('sealed nudge is silent once a breacher is owned', () => {
  const s = withHints({ sealedValue: 500 });
  s.hire.roles.breacher.count = 1;
  assert.equal(chooseNudge(s), null);
});

test('heavy loot and inspector nudges', () => {
  assert.deepEqual(chooseNudge(withHints({ heavyWaiting: 2 })), { id: 'heavy', text: 'HEAVY LOOT NEEDS MORE HAULERS', pulse: 'hauler' });
  const i = chooseNudge(withHints({ inspectorNear: true }));
  assert.equal(i.id, 'inspector');
  assert.equal(i.pulse, 'decoy');
  const s = withHints({ inspectorNear: true });
  s.hire.roles.decoy.count = 1;
  assert.equal(chooseNudge(s), null);
});

test('inspector outranks sealed outranks heavy', () => {
  const s = withHints({ inspectorNear: true, sealedValue: 10, heavyWaiting: 1 });
  assert.equal(chooseNudge(s).id, 'inspector');
  assert.equal(chooseNudge(s, { shown: ['inspector'] }).id, 'sealed');
  assert.equal(chooseNudge(s, { shown: ['inspector', 'sealed'] }).id, 'heavy');
  assert.equal(chooseNudge(s, { shown: new Set(['inspector', 'sealed', 'heavy']) }), null);
});

test('afford nudge: cheapest affordable role, only before the first hire, not during the tutorial hire step', () => {
  const s = snap({ economy: { cash: 400, cleared: false } });
  s.hire.roles.hauler.canAfford = true;
  const n = chooseNudge(s);
  assert.equal(n.id, 'afford');
  assert.equal(n.pulse, 'hauler');
  assert.equal(chooseNudge(s, { hired: true }), null);
  assert.equal(chooseNudge(s, { tutorialHire: true }), null);
});

test('afford nudge stays off when the crew is full or the run is cleared', () => {
  const s = snap({ economy: { cash: 400, cleared: false } });
  s.hire.roles.hauler.canAfford = true;
  s.hire.count = 12;
  assert.equal(chooseNudge(s), null);
  s.hire.count = 2;
  s.economy.cleared = true;
  assert.equal(chooseNudge(s), null);
});
