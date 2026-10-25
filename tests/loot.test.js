import test from 'node:test';
import assert from 'node:assert/strict';
import { groupLoot, itemCard, recommendRole, shortName } from '../src/ui/loot.js';

const L = (id, kind, x, y, over = {}) => ({ id, kind, x, y, w: 1, d: 1, value: 100, weight: 1, need: 1, claimed: false, sealed: false, ...over });
const ctx = (over = {}) => ({ pinnedId: null, haulers: 2, breachers: 0, whistleCd: 0, crane: null, ...over });

test('groupLoot: groups by kind, open groups first then richest, nearest-to-truck first inside a group', () => {
  const loot = [
    L('a', 'chair', 9, 9, { value: 40 }), L('b', 'chair', 1, 1, { value: 40 }), L('c', 'chair', 5, 5, { value: 40, sealed: true }),
    L('d', 'safe', 7, 7, { value: 1500, weight: 6, sealed: true }),
    L('e', 'desk', 3, 3, { value: 260 })
  ];
  const g = groupLoot(loot, { x: 0, y: 0 });
  assert.deepEqual(g.map((x) => x.kind), ['desk', 'chair', 'safe']);
  const chairs = g.find((x) => x.kind === 'chair');
  assert.deepEqual(chairs.ids, ['b', 'a', 'c'], 'open ones nearest the truck first, sealed last');
  assert.equal(chairs.count, 3);
  assert.equal(chairs.open, 2);
  assert.equal(chairs.sealed, 1);
  assert.equal(g.find((x) => x.kind === 'safe').open, 0);
  assert.equal(groupLoot([], null).length, 0);
});

test('itemCard: haul-next, pinned, sealed, too heavy for the crew, claimed', () => {
  const plain = itemCard(L('a', 'chair', 1, 1), ctx());
  assert.equal(plain.title, 'CHAIR');
  assert.deepEqual(plain.actions.map((a) => a.id), ['pin']);
  assert.equal(plain.actions[0].primary, true);

  const pinned = itemCard(L('a', 'chair', 1, 1), ctx({ pinnedId: 'a' }));
  assert.equal(pinned.actions[0].label, 'PINNED');
  assert.equal(pinned.actions[0].primary, false);

  const sealedNoBreacher = itemCard(L('s', 'safe', 1, 1, { sealed: true, weight: 6, need: 6 }), ctx());
  assert.deepEqual(sealedNoBreacher.actions.map((a) => a.id), ['hire']);
  const sealedWithBreacher = itemCard(L('s', 'safe', 1, 1, { sealed: true, weight: 6, need: 6 }), ctx({ breachers: 1 }));
  assert.equal(sealedWithBreacher.actions[0].disabled, true);

  const claimed = itemCard(L('c', 'chair', 1, 1, { claimed: true }), ctx());
  assert.equal(claimed.actions[0].disabled, true);

  const heavy = itemCard(L('h', 'desk', 1, 1, { weight: 3, need: 3 }), ctx({ haulers: 2 }));
  assert.deepEqual(heavy.actions.map((a) => a.id), ['hire', 'whistle']);
  assert.match(heavy.actions[0].label, /NEED 3 HAULERS/);
});

test('itemCard: whistle cooldown and crane availability', () => {
  const heavy = L('h', 'desk', 1, 1, { weight: 3, need: 3 });
  const cd = itemCard(heavy, ctx({ haulers: 4, whistleCd: 12.2 }));
  const w = cd.actions.find((a) => a.id === 'whistle');
  assert.equal(w.disabled, true);
  assert.match(w.sub, /13S/);
  const crane = itemCard(heavy, ctx({ haulers: 4, crane: { unlocked: true, state: 'idle', cooldown: 0 } }));
  assert.deepEqual(crane.actions.map((a) => a.id), ['pin', 'whistle', 'crane']);
  assert.equal(crane.actions[2].disabled, false);
  const locked = itemCard(heavy, ctx({ haulers: 4, crane: { unlocked: false, state: 'idle', cooldown: 0 } }));
  assert.ok(!locked.actions.some((a) => a.id === 'crane'));
  const light = itemCard(L('l', 'chair', 1, 1), ctx({ crane: { unlocked: true, state: 'idle', cooldown: 0 } }));
  assert.ok(!light.actions.some((a) => a.id === 'crane' || a.id === 'whistle'));
});

test('recommendRole: haulers first, then breacher for sealed loot, null when full', () => {
  const snap = (counts, cash, hints = {}, full = false) => {
    const cost = { hauler: 350, breacher: 1200, rigger: 1400, decoy: 1000 };
    const roles = {};
    for (const r of Object.keys(cost)) roles[r] = { cost: cost[r], count: counts[r] ?? 0, canAfford: cash >= cost[r] };
    return { hire: { cap: 12, count: full ? 12 : 2, roles }, hints: { sealedValue: 0, heavyWaiting: 0, inspectorNear: false, ...hints } };
  };
  assert.equal(recommendRole(snap({ hauler: 2 }, 400)).role, 'hauler');
  assert.equal(recommendRole(snap({ hauler: 2 }, 400)).canAfford, true);
  assert.equal(recommendRole(snap({ hauler: 4 }, 0, { sealedValue: 900 })).role, 'breacher');
  assert.equal(recommendRole(snap({ hauler: 5 }, 0, { heavyWaiting: 1 })).role, 'hauler');
  assert.equal(recommendRole(snap({ hauler: 5, breacher: 1 }, 0, { inspectorNear: true })).role, 'decoy');
  assert.equal(recommendRole(snap({ hauler: 5 }, 0, {}, true)), null);
  assert.equal(recommendRole(null), null);
});

test('shortName falls back to the catalogue name', () => {
  assert.equal(shortName('vend'), 'VENDING');
  assert.equal(shortName('unknown'), 'UNKNOWN');
});
