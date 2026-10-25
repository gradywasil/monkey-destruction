import { ITEM_DEFS } from '../data/items.js';
import { crewTile, idleCrew, stepCrew, WALK_SPEED } from './crew.js';

export const WHISTLE_CAP = 12;
export const WHISTLE_WAIT = 5;
const RING = 0.35;

/** @returns {number} seconds of heaving before an item of this weight leaves the floor. */
export const heaveTime = (weight) => 0.6 + 0.12 * weight;

/**
 * Wrecking Whistle: every idle crew member converges on one heavy item and carries it out.
 * @param {object} world
 * @param {(type:string, payload:object)=>void} emit
 * @param {{routeOut:Function, shove:Function, routeTo:Function, dropNearest:Function, settleFollowers:Function, truckReachableFrom:Function, rankByDistance:Function, precheck:Function, drop:{x:number,y:number}|null}} h
 */
export function createWhistleSystem(world, emit, h) {
  const { grid, items, path, crew } = world;
  const active = new Map();
  const ids = (w) => w.members.map((c) => c.id);

  const finish = (w) => {
    active.delete(w.itemId);
    for (const c of w.members) idleCrew(c);
  };

  const fail = (w, reason) => {
    const it = items.get(w.itemId);
    if (it && it.state === 'claimed') items.release(w.itemId);
    finish(w);
    emit('fail', { itemId: w.itemId, crewIds: ids(w), reason });
  };

  const assignTargets = (w, it) => {
    const adj = path.adjacentTiles(it);
    let taken = new Set();
    for (const c of w.members) {
      let free = adj.filter((a) => !taken.has(`${a.x},${a.y}`));
      if (!free.length) {
        taken = new Set();
        free = adj;
      }
      const t = crewTile(c);
      const r = path.findPathToAny(t.x, t.y, free);
      if (!r) return false;
      taken.add(`${r.goal.x},${r.goal.y}`);
      c.target = r.goal;
      c.path = r.path.length ? r.path : [{ x: t.x, y: t.y }];
    }
    return true;
  };

  const block = (w) => {
    const it = items.get(w.itemId);
    h.dropNearest(w);
    h.settleFollowers(w);
    finish(w);
    emit('blocked', { item: it, crewIds: ids(w) });
  };

  const formation = (w, dt) => {
    const leader = w.members[0];
    const n = w.members.length - 1;
    const radius = RING * (1 + 0.04 * n);
    w.members.slice(1).forEach((c, i) => {
      const a = (i / n) * Math.PI * 2 + Math.PI / 4;
      const sx = leader.x + Math.cos(a) * radius;
      const sy = leader.y + Math.sin(a) * radius;
      if (!w.joined.has(c.id)) {
        const dx = sx - c.x;
        const dy = sy - c.y;
        const dist = Math.hypot(dx, dy);
        const step = WALK_SPEED * 1.25 * dt;
        if (dist > step) {
          c.x += (dx / dist) * step;
          c.y += (dy / dist) * step;
          return;
        }
        w.joined.add(c.id);
      }
      c.x = sx;
      c.y = sy;
      c.facing = leader.facing;
    });
  };

  const update = (w, dt) => {
    const it = items.get(w.itemId);
    w.t += dt;
    if (w.phase !== 'carry') {
      if (!it || (it.state !== 'claimed' && it.state !== 'carried')) return fail(w, 'lost');
      if (w.version !== grid.version) {
        w.version = grid.version;
        if (!assignTargets(w, it)) return fail(w, 'unreachable');
      }
    }
    if (w.phase === 'converge' || w.phase === 'heave') {
      let arrived = 0;
      for (const c of w.members) {
        if (c.state === 'lifting') { arrived++; continue; }
        if (stepCrew(c, dt, world.speedOf(c))) {
          c.state = 'waiting';
          arrived++;
        }
      }
      if (w.phase === 'converge') {
        if (arrived && w.first === null) w.first = w.t;
        const ready = arrived >= world.carriersNeeded(it.weight) && (arrived === w.members.length || w.t - w.first >= WHISTLE_WAIT);
        if (!ready) return;
        w.members.sort((a, b) => (b.state === 'waiting') - (a.state === 'waiting'));
        w.phase = 'heave';
        w.lift = 0;
        for (const c of w.members) {
          if (c.state !== 'waiting') continue;
          c.state = 'lifting';
          const dx = it.x + it.w / 2 - c.x;
          const dy = it.y + it.d / 2 - c.y;
          if (Math.abs(dx - dy) > 1e-6) c.facing = dx - dy >= 0 ? 'right' : 'left';
        }
        return;
      }
      w.lift += dt;
      if (w.lift < heaveTime(it.weight) - 1e-9) return;
      if (!items.pickUp(it.id)) return fail(w, 'lost');
      emit('pickup', { item: it, crewIds: ids(w) });
      w.phase = 'carry';
      for (const c of w.members) {
        c.state = 'carrying';
        c.path = [];
      }
      w.joined = new Set(w.members.filter((c) => Math.hypot(c.x - w.members[0].x, c.y - w.members[0].y) < 1).map((c) => c.id));
      if (!(w.out = h.routeOut(w.members[0]))) return block(w);
      w.version = grid.version;
      return;
    }
    if (!it || it.state !== 'carried') return finish(w);
    if (w.version !== grid.version) {
      w.version = grid.version;
      if (!(w.out = h.routeOut(w.members[0]))) return block(w);
    }
    const leader = w.members[0];
    const arrived = stepCrew(leader, dt, world.speedOf(leader, it.weight, w.members.length));
    formation(w, dt);
    if (arrived) {
      h.settleFollowers(w);
      if (w.out.zip) {
        finish(w);
        return h.shove(w.members, it, w.out.zip);
      }
      const base = items.deliver(it.id);
      const value = world.credit(base);
      finish(w);
      emit('deliver', { item: it, value, base, crewIds: ids(w) });
    }
  };

  return {
    /** @returns {{ok:true,crewIds:string[]}|{ok:false,reason:string,needed?:number}} */
    start(itemId) {
      const { it, reason } = h.precheck(itemId);
      if (!it) return { ok: false, reason };
      const needed = world.carriersNeeded(it.weight);
      const idle = crew.filter((c) => c.state === 'idle');
      if (idle.length < needed) return { ok: false, reason: 'not-enough-idle', needed };
      const adj = path.adjacentTiles(it);
      const ranked = h.rankByDistance(idle, adj);
      // reachability is a component test, so stop at the first crew whose goal reaches the truck
      if (ranked.length < needed || !ranked.some((r) => h.truckReachableFrom([ranked.goalOf(r)]))) return { ok: false, reason: 'unreachable', needed };
      ranked.sort((a, b) => a.d - b.d || a.i - b.i);
      const members = ranked.slice(0, WHISTLE_CAP).map((r) => r.c);
      const crewIds = members.map((c) => c.id);
      if (!items.claim(it.id, crewIds.slice(0, needed), needed)) return { ok: false, reason: 'not-placed', needed };
      it.carriers = [...crewIds];
      const w = { itemId: it.id, members, phase: 'converge', t: 0, first: null, lift: 0, version: grid.version, joined: new Set() };
      for (const c of members) {
        c.state = 'toItem';
        c.itemId = it.id;
      }
      if (!assignTargets(w, it)) {
        items.release(it.id);
        for (const c of members) idleCrew(c);
        return { ok: false, reason: 'unreachable', needed };
      }
      active.set(it.id, w);
      emit('whistle', { itemId: it.id, n: members.length });
      emit('assign', { itemId: it.id, crewIds });
      return { ok: true, crewIds };
    },

    /** Release the swarm; an item already in the air is set down nearby. @returns {boolean} */
    cancel(itemId) {
      const w = active.get(itemId);
      if (!w) return false;
      if (w.phase === 'carry') {
        h.dropNearest(w);
        h.settleFollowers(w);
      } else {
        items.release(itemId);
      }
      finish(w);
      return true;
    },

    has: (itemId) => active.has(itemId),
    update(dt) {
      for (const w of [...active.values()]) update(w, dt);
    },
    carried: () => [...active.values()].filter((w) => w.phase === 'carry').map((w) => {
      const it = items.get(w.itemId);
      return { id: it.id, kind: it.kind, x: w.members[0].x, y: w.members[0].y, z: ITEM_DEFS[it.kind].carryZ, weight: it.weight };
    }),
    list: () => [...active.values()].map((w) => ({
      itemId: w.itemId,
      progress: w.phase === 'heave' ? Math.min(1, w.lift / heaveTime(items.get(w.itemId).weight)) : 0,
      n: w.members.length,
      needed: world.carriersNeeded(items.get(w.itemId).weight),
      phase: w.phase,
    })),
  };
}
