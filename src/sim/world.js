import { ITEM_DEFS, quotaFor } from '../data/items.js';
import { createItemStore } from './items.js';
import { createPathService } from './path.js';
import { createJob } from './job.js';
import { canHaul, createCrew, crewSpeed, crewTile, idleCrew, stepCrew, LIFT_TIME } from './crew.js';
import { createBreachSystem } from './breach.js';
import { createChainSystem } from './chain.js';
import { createWhistleSystem } from './whistle.js';
import { createInspectorSystem } from './inspector.js';
import { createRigSystem } from './rig.js';
import { createDecoySystem } from './decoy.js';
import { createCraneSystem } from './crane.js';
import { NO_MODIFIERS } from './modifiers.js';
import { createAutoSystem } from './auto.js';
import { AUTO_ROLES, AUTO_SPEED, BOOSTS, BOOST_IDS, DEFAULT_CREW_CAP, HIRE_ROLES, WHISTLE_COOLDOWN, boostCostFor, boostMult, hireCostFor, parFor, starsFor } from '../data/economy.js';

const DEFAULT_ROLES = ['breacher', 'breacher', 'hauler', 'hauler', 'hauler', 'hauler', 'hauler', 'hauler', 'hauler', 'hauler', 'rigger', 'decoy'];
const RING = 0.35;

/** Deterministic PRNG (mulberry32). @returns {() => number} */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simulation world: crew, items, job timer. Call tick(1/30) at a fixed rate.
 * @param {{grid:import('./grid.js').Grid, seed?:number, roles?:string[], quota?:number, duration?:number, modifiers?:object}} opts
 */
export function createWorld({ grid, seed = 1, roles, quota, duration = 900, modifiers = NO_MODIFIERS, profile = false, auto = false }) {
  const items = createItemStore(grid);
  const path = createPathService(grid);
  const rng = createRng(seed);
  const handlers = new Map();
  const emit = (type, payload) => {
    for (const fn of handlers.get(type) ?? []) fn(payload);
  };
  const events = {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
  };

  const startRoles = roles ?? (auto ? AUTO_ROLES : DEFAULT_ROLES);
  let crewSeq = 0;
  let spawnCursor = 0;
  const crew = auto
    ? [...startRoles, ...Array(modifiers.startHaulers).fill('hauler')].map((role) => {
      const s = grid.spawns[spawnCursor++ % grid.spawns.length];
      return createCrew(`c${crewSeq++}`, role, s.x, s.y);
    })
    : grid.spawns.slice(0, startRoles.length).map((s, i) => createCrew(`c${i}`, startRoles[i], s.x, s.y));
  const byId = new Map(crew.map((c) => [c.id, c]));
  const job = createJob({
    duration,
    quota: auto ? 0 : quota ?? quotaFor(items.list()),
    onEnd: (j) => emit('timeup', { delivered: j.delivered, stars: j.stars() }),
  });
  const totalValue = items.totals.total;
  const itemCount = items.list().length;
  job.elapsed = 0;
  job.par = parFor(totalValue, grid.par);
  if (auto) job.stars = () => starsFor(job.elapsed, job.par);
  const hauls = new Map();
  const drop = grid.truck ? { x: grid.truck.dropX, y: grid.truck.dropY } : null;
  const world = { grid, items, path, crew, job, events, rng, time: 0, modifiers, auto };
  const eco = { spent: 0, granted: 0, advances: 0, advanced: 0, boosts: { speed: 0, haggle: 0 }, hired: { hauler: 0, breacher: 0, rigger: 0, decoy: 0 }, whistleCd: 0 };
  world.econ = eco;

  /** Crew needed to carry an item of this weight (bionic arms shave heavy ones). */
  world.carriersNeeded = (weight) => (weight >= 3 ? Math.max(1, weight - modifiers.carryReduction) : weight);
  /** Tiles/s for a crew member; hauler/plain roles get the haulSpeed modifier. */
  world.speedOf = (c, weight = 0, n = weight) => crewSpeed(weight, n, world.carriersNeeded(weight)) * (canHaul(c.role) ? modifiers.haulSpeed : 1) * boostMult('speed', eco.boosts.speed) * (auto ? AUTO_SPEED : 1);
  /** Add a delivery to the job at the modified value. @returns {number} credited value */
  world.credit = (base) => {
    const value = Math.round(base * modifiers.valueMult * boostMult('haggle', eco.boosts.haggle));
    job.delivered += value;
    return value;
  };

  const routeTo = (c, goal) => {
    const t = crewTile(c);
    const p = path.findPath(t.x, t.y, goal.x, goal.y);
    if (!p) return false;
    c.path = p.length ? p : [{ x: t.x, y: t.y }];
    return true;
  };

  const finish = (h) => {
    hauls.delete(h.itemId);
    for (const c of h.members) idleCrew(c);
  };

  const fail = (h, reason) => {
    const it = items.get(h.itemId);
    if (it && it.state === 'claimed' && sameCarriers(it, h)) items.release(h.itemId);
    finish(h);
    emit('fail', { itemId: h.itemId, crewIds: h.members.map((c) => c.id), reason });
  };

  const sameCarriers = (it, h) => it.carriers.length === h.members.length && h.members.every((c, i) => it.carriers[i] === c.id);

  const dropNearest = (h) => {
    const leader = h.members[0];
    const start = crewTile(leader);
    const occupied = new Set(crew.map((c) => { const t = crewTile(c); return `${t.x},${t.y}`; }));
    const seen = new Set([`${start.x},${start.y}`]);
    const order = [start];
    for (let i = 0; i < order.length; i++) {
      for (const n of grid.neighbors(order[i].x, order[i].y)) {
        const k = `${n.x},${n.y}`;
        if (!seen.has(k)) { seen.add(k); order.push(n); }
      }
    }
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
      if (!seen.has(`${x},${y}`)) order.push({ x, y });
    }
    const free = order.filter((t) => !occupied.has(`${t.x},${t.y}`));
    for (const t of [...free, ...order]) if (items.drop(h.itemId, t.x, t.y)) return true;
    return false;
  };

  const settleFollowers = (h) => {
    const lt = crewTile(h.members[0]);
    for (const c of h.members.slice(1)) {
      const t = crewTile(c);
      if (path.findPath(t.x, t.y, lt.x, lt.y) === null || !grid.isWalkable(t.x, t.y)) {
        c.x = h.members[0].x;
        c.y = h.members[0].y;
      }
    }
  };

  const block = (h) => {
    const it = items.get(h.itemId);
    dropNearest(h);
    settleFollowers(h);
    finish(h);
    emit('blocked', { item: it, crewIds: h.members.map((c) => c.id) });
  };

  const assignTargets = (h, it) => {
    const adj = path.adjacentTiles(it);
    const taken = new Set();
    for (const c of h.members) {
      const t = crewTile(c);
      const free = adj.filter((a) => !taken.has(`${a.x},${a.y}`));
      const r = (free.length && path.findPathToAny(t.x, t.y, free)) || path.findPathToAny(t.x, t.y, adj);
      if (!r) return false;
      taken.add(`${r.goal.x},${r.goal.y}`);
      c.target = r.goal;
      c.path = r.path.length ? r.path : [{ x: t.x, y: t.y }];
    }
    return true;
  };

  const updateHaul = (h, dt) => {
    const it = items.get(h.itemId);
    const leader = h.members[0];
    if (h.phase === 'toItem' || h.phase === 'lifting') {
      if (!it || it.state !== 'claimed' || !sameCarriers(it, h)) return fail(h, 'lost');
      if (h.version !== grid.version) {
        h.version = grid.version;
        if (h.phase === 'toItem' && !assignTargets(h, it)) return fail(h, 'unreachable');
      }
      if (h.phase === 'toItem') {
        let all = true;
        for (const c of h.members) {
          if (stepCrew(c, dt, world.speedOf(c))) c.state = 'waiting';
          else all = false;
        }
        if (all) {
          h.phase = 'lifting';
          h.lift = LIFT_TIME;
          for (const c of h.members) {
            c.state = 'lifting';
            const dx = it.x + it.w / 2 - c.x;
            const dy = it.y + it.d / 2 - c.y;
            if (Math.abs(dx - dy) > 1e-6) c.facing = dx - dy >= 0 ? 'right' : 'left';
          }
        }
        return;
      }
      h.lift -= dt;
      if (h.lift > 1e-9) return;
      if (!items.pickUp(it.id)) return fail(h, 'lost');
      emit('pickup', { item: it, crewIds: h.members.map((c) => c.id) });
      h.phase = 'carrying';
      for (const c of h.members) {
        c.state = 'carrying';
        c.path = [];
      }
      if (!(h.out = rig.routeOut(leader))) return block(h);
      h.version = grid.version;
      return;
    }
    if (!it || it.state !== 'carried') return finish(h);
    if (h.version !== grid.version) {
      h.version = grid.version;
      if (!(h.out = rig.routeOut(leader))) return block(h);
    }
    const arrived = stepCrew(leader, dt, world.speedOf(leader, it.weight, h.members.length));
    const n = h.members.length - 1;
    h.members.slice(1).forEach((c, i) => {
      const a = (i / n) * Math.PI * 2 + Math.PI / 4;
      c.x = leader.x + Math.cos(a) * RING;
      c.y = leader.y + Math.sin(a) * RING;
      c.facing = leader.facing;
    });
    if (arrived) {
      settleFollowers(h);
      if (h.out.zip) {
        finish(h);
        return rig.shove(h.members, it, h.out.zip);
      }
      const base = items.deliver(it.id);
      const value = world.credit(base);
      finish(h);
      emit('deliver', { item: it, value, base, crewIds: h.members.map((c) => c.id) });
    }
  };

  const start = (members, it) => {
    const crewIds = members.map((c) => c.id);
    if (!items.claim(it.id, crewIds, world.carriersNeeded(it.weight))) return { ok: false, reason: 'not-placed' };
    const h = { itemId: it.id, members, phase: 'toItem', lift: 0, version: grid.version };
    for (const c of members) {
      c.state = 'toItem';
      c.itemId = it.id;
    }
    if (!assignTargets(h, it)) {
      items.release(it.id);
      for (const c of members) idleCrew(c);
      return { ok: false, reason: 'unreachable' };
    }
    hauls.set(it.id, h);
    emit('assign', { itemId: it.id, crewIds });
    return { ok: true, crewIds };
  };

  const precheck = (itemId) => {
    if (job.state === 'ended') return { reason: 'ended' };
    const it = items.get(itemId);
    if (!it || it.state !== 'placed') return { reason: 'not-placed' };
    return { it };
  };

  /**
   * Rank crew by walking distance to the nearest of `adj` with one cached BFS field instead of a search each.
   * `goal()` resolves the concrete reached tile lazily (A* only for the few crew actually used).
   */
  const rankByDistance = (cands, adj) => {
    const ranked = [];
    if (!adj.length) return ranked;
    const f = path.flowField(adj);
    cands.forEach((c, i) => {
      const t = crewTile(c);
      const d = grid.inBounds(t.x, t.y) ? f.dist[t.y * grid.width + t.x] : -1;
      const entry = { c, i, d, goal: null };
      if (d < 0) {
        // a walkable start the BFS never reached is truly cut off; only off-grid/blocked starts need the stepOut search
        if (grid.isWalkable(t.x, t.y)) return;
        const r = path.findPathToAny(t.x, t.y, adj);
        if (!r) return;
        entry.d = r.path.length;
        entry.goal = r.goal;
      }
      ranked.push(entry);
    });
    ranked.goalOf = (e) => e.goal ?? (e.goal = path.findPathToAny(crewTile(e.c).x, crewTile(e.c).y, adj).goal);
    return ranked;
  };

  world.cash = () => job.delivered - job.fines - eco.spent + eco.granted;
  /** Dev/test hook: grant cash without counting it as earnings. */
  world.addCash = (n) => { eco.granted += n; };
  world.crewCap = () => (grid.crewCap ?? DEFAULT_CREW_CAP) + modifiers.crewCap;
  world.hireCost = (role) => (role in eco.hired ? hireCostFor(role, eco.hired[role], modifiers.hireCost) : null);
  world.boostCost = (id) => (eco.boosts[id] < BOOSTS[id].max ? boostCostFor(id, eco.boosts[id]) : null);

  const truckReachableFrom = (tiles) => drop && tiles.some((t) => path.findPath(t.x, t.y, drop.x, drop.y));

  const commands = {
    haul(itemId) {
      const { it, reason } = precheck(itemId);
      if (!it) return { ok: false, reason };
      const idle = crew.filter((c) => c.state === 'idle' && canHaul(c.role));
      const need = world.carriersNeeded(it.weight);
      if (idle.length < need) return { ok: false, reason: 'not-enough-idle' };
      const adj = path.adjacentTiles(it);
      const ranked = rankByDistance(idle, adj);
      if (ranked.length < need) return { ok: false, reason: 'unreachable' };
      ranked.sort((a, b) => a.d - b.d || a.i - b.i);
      const chosen = ranked.slice(0, need);
      if (!truckReachableFrom(chosen.map((r) => ranked.goalOf(r)))) return { ok: false, reason: 'unreachable' };
      return start(chosen.map((r) => r.c), it);
    },

    haulWith(crewIds, itemId) {
      const { it, reason } = precheck(itemId);
      if (!it) return { ok: false, reason };
      const members = crewIds.map((id) => byId.get(id));
      if (members.some((c) => c && !canHaul(c.role))) return { ok: false, reason: 'wrong-role' };
      if (new Set(crewIds).size !== crewIds.length || members.some((c) => !c || c.state !== 'idle') || members.length !== world.carriersNeeded(it.weight)) {
        return { ok: false, reason: 'not-enough-idle' };
      }
      const adj = path.adjacentTiles(it);
      const goals = [];
      for (const c of members) {
        const t = crewTile(c);
        const r = adj.length ? path.findPathToAny(t.x, t.y, adj) : null;
        if (!r) return { ok: false, reason: 'unreachable' };
        goals.push(r.goal);
      }
      if (!truckReachableFrom(goals)) return { ok: false, reason: 'unreachable' };
      return start(members, it);
    },

    cancel(crewId) {
      const c = byId.get(crewId);
      if (!c || !c.itemId) return false;
      if (whistle.has(c.itemId)) return whistle.cancel(c.itemId);
      const h = hauls.get(c.itemId);
      if (!h) {
        idleCrew(c);
        return true;
      }
      if (h.phase === 'carrying') {
        dropNearest(h);
        settleFollowers(h);
        finish(h);
      } else {
        items.release(h.itemId);
        finish(h);
      }
      return true;
    },
  };

  world.commands = commands;
  commands.hire = (role) => {
    if (!auto) return { ok: false, reason: 'disabled' };
    if (job.state === 'ended') return { ok: false, reason: 'ended' };
    if (!HIRE_ROLES.includes(role)) return { ok: false, reason: 'unknown-role' };
    if (crew.length >= world.crewCap()) return { ok: false, reason: 'cap' };
    const cost = world.hireCost(role);
    if (world.cash() < cost) return { ok: false, reason: 'cash' };
    eco.spent += cost;
    eco.hired[role]++;
    const s = grid.spawns[spawnCursor++ % grid.spawns.length];
    const c = createCrew(`c${crewSeq++}`, role, s.x, s.y);
    crew.push(c);
    byId.set(c.id, c);
    emit('hire', { crew: c, role, cost });
    return { ok: true, id: c.id, cost };
  };
  commands.boost = (id) => {
    if (!auto) return { ok: false, reason: 'disabled' };
    if (job.state === 'ended') return { ok: false, reason: 'ended' };
    if (!BOOST_IDS.includes(id)) return { ok: false, reason: 'unknown-boost' };
    const cost = world.boostCost(id);
    if (cost === null) return { ok: false, reason: 'max' };
    if (world.cash() < cost) return { ok: false, reason: 'cash' };
    eco.spent += cost;
    eco.boosts[id]++;
    emit('boost', { id, level: eco.boosts[id], cost });
    return { ok: true, level: eco.boosts[id], cost };
  };
  const whistle = createWhistleSystem(world, emit, { routeOut: (c) => rig.routeOut(c), shove: (m, it, z) => rig.shove(m, it, z), routeTo, dropNearest, settleFollowers, truckReachableFrom, rankByDistance, precheck, drop });
  commands.whistle = (itemId) => {
    if (auto && eco.whistleCd > 0) return { ok: false, reason: 'cooldown' };
    const r = whistle.start(itemId);
    if (auto && r.ok) eco.whistleCd = WHISTLE_COOLDOWN;
    return r;
  };
  commands.whistleCancel = whistle.cancel;
  const breach = createBreachSystem(world, emit);
  commands.breach = breach.breach;
  commands.cancelBreach = breach.cancel;
  const chain = createChainSystem(world, emit);
  commands.chain = { preview: chain.preview, create: chain.create, remove: chain.remove };
  const rig = createRigSystem(world, emit, { drop });
  commands.rig = rig.rig;
  commands.cancelRig = rig.cancel;
  const WORKING = new Set(['carrying', 'lifting', 'breaching', 'rigging', 'launching']);
  const isWorking = (c) => WORKING.has(c.state)
    || (c.state === 'chain' && ['carry', 'throw', 'lift'].includes(c.chainPose))
    || (!!c.itemId && whistle.has(c.itemId) && c.state !== 'toItem');
  const inspector = createInspectorSystem(world, emit, { patrols: grid.inspectors ?? [], isWorking });
  commands.inspector = { stall: inspector.stall };
  const decoy = createDecoySystem(world, emit);
  commands.decoy = decoy.decoy;
  commands.cancelDecoy = decoy.cancel;
  const crane = createCraneSystem(world, emit, { drop });
  commands.crane = crane.start;
  /** Auto mode: pin an item as "haul this next" (same id again unpins). */
  commands.prioritize = (itemId) => (autoSys ? autoSys.setPriority(itemId) : { ok: false, reason: 'disabled' });
  const autoSys = auto ? createAutoSystem(world, emit, { decoys: () => decoy.list(), isWhistling: (id) => whistle.has(id) }) : null;

  const systems = [
    ['hauls', (dt) => { for (const h of [...hauls.values()]) updateHaul(h, dt); }],
    ['whistle', (dt) => whistle.update(dt)],
    ['breach', (dt) => breach.update(dt)],
    ['chain', (dt) => chain.update(dt)],
    ['rig', (dt) => rig.update(dt)],
    ['decoy', (dt) => decoy.update(dt)],
    ['crane', (dt) => crane.update(dt)],
    ['inspector', (dt) => inspector.update(dt)],
  ];
  /** Debug flag `profile`: accumulate ms per system (and path searches) into world.prof. */
  if (profile) {
    world.prof = {};
    for (const name of ['findPath', 'findPathToAny']) {
      const orig = path[name];
      world.prof[`path.${name}`] = 0;
      path[name] = (...a) => {
        const t0 = performance.now();
        const r = orig(...a);
        world.prof[`path.${name}`] += performance.now() - t0;
        return r;
      };
    }
    for (const s of systems) {
      const fn = s[1];
      world.prof[s[0]] = 0;
      s[1] = (dt) => {
        const t0 = performance.now();
        fn(dt);
        world.prof[s[0]] += performance.now() - t0;
      };
    }
  }

  world.tick = (dt) => {
    if (job.state === 'ended') return;
    world.time += dt;
    job.elapsed += dt;
    if (auto) {
      eco.whistleCd = Math.max(0, eco.whistleCd - dt);
      autoSys.update(dt);
    } else {
      job.tick(dt);
      if (job.state === 'ended') return;
    }
    for (let i = 0; i < systems.length; i++) systems[i][1](dt);
    if (auto && items.totals.count >= itemCount) {
      job.state = 'ended';
      emit('cleared', { elapsed: job.elapsed, stars: job.stars(), profit: Math.max(0, world.cash() - eco.advanced) });
    }
  };

  world.itemAt = (tx, ty) => {
    let best = null;
    let bestScore = -1;
    for (const it of items.list()) {
      if (it.state !== 'placed' && it.state !== 'claimed') continue;
      if (tx < it.x || tx >= it.x + it.w || ty < it.y || ty >= it.y + it.d) continue;
      const score = (it.kind === 'monitor' ? 2 : 0) + (it.state === 'placed' ? 1 : 0);
      if (score > bestScore) {
        best = it;
        bestScore = score;
      }
    }
    return best;
  };

  world.crewNear = (x, y, radius = 0.8) => {
    let best = null;
    let bd = radius;
    for (const c of crew) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= bd) {
        best = c;
        bd = d;
      }
    }
    return best;
  };

  const poseOf = (c) => {
    if (c.state === 'carrying') return 'carry';
    if (c.state === 'lifting') return 'lift';
    if (c.state === 'toItem') return 'walk';
    if (c.state === 'breaching') return 'hit';
    if (c.state === 'toBreach') return 'walk';
    if (c.state === 'toRig') return 'walk';
    if (c.state === 'rigging') return 'lift';
    if (c.state === 'launching') return 'launch';
    if (c.state === 'chain') return c.chainPose ?? 'walk';
    if (c.state === 'decoyChase') return 'walk';
    if (c.state === 'decoyEngaged') return 'stall';
    return 'idle';
  };

  const autoSnapshot = () => {
    const cash = world.cash();
    const roleCount = {};
    for (const c of crew) roleCount[c.role] = (roleCount[c.role] ?? 0) + 1;
    const full = crew.length >= world.crewCap();
    const roles = {};
    for (const r of HIRE_ROLES) {
      const cost = world.hireCost(r);
      roles[r] = { cost, count: roleCount[r] ?? 0, canAfford: !full && cash >= cost };
    }
    const strippedValue = items.totals.delivered;
    return {
      auto: true,
      economy: {
        cash, earned: job.delivered, spent: eco.spent, fines: job.fines, strippedValue, totalValue,
        stripped: totalValue > 0 ? strippedValue / totalValue : 1, elapsed: job.elapsed, par: job.par, cleared: job.state === 'ended', advances: eco.advances, advanced: eco.advanced,
      },
      hire: { cap: world.crewCap(), count: crew.length, roles },
      boosts: BOOST_IDS.map((id) => {
        const cost = world.boostCost(id);
        return { id, level: eco.boosts[id], max: BOOSTS[id].max, cost, canAfford: cost !== null && cash >= cost };
      }),
      hints: { ...autoSys.hints },
      whistleCooldown: eco.whistleCd,
      priorityId: autoSys.priority(),
    };
  };

  const toLoot = (it) => ({
    id: it.id, kind: it.kind, x: it.x, y: it.y, w: it.w, d: it.d, value: it.value, weight: it.weight,
    need: world.carriersNeeded(it.weight), claimed: it.state === 'claimed', sealed: !!autoSys?.isSealed(it.id),
  });
  /** Items still on the floor (loose or claimed), for the loot tray. Cheap enough for ~4 Hz polling. */
  world.loot = () => items.list().filter((it) => it.state === 'placed' || it.state === 'claimed').map(toLoot);
  /** One floor item in loot() shape, or null once it is carried off or sold. */
  world.lootOf = (id) => {
    const it = items.get(id);
    return it && (it.state === 'placed' || it.state === 'claimed') ? toLoot(it) : null;
  };

  world.snapshot = () => ({
    crew: crew.map((c) => ({
      id: c.id, role: c.role, x: c.x, y: c.y, facing: c.facing, pose: poseOf(c), carrying: c.state === 'carrying' ? c.itemId : null,
    })),
    carried: [...hauls.values()].filter((h) => h.phase === 'carrying').map((h) => {
      const it = items.get(h.itemId);
      return { id: it.id, kind: it.kind, x: h.members[0].x, y: h.members[0].y, z: ITEM_DEFS[it.kind].carryZ, weight: it.weight };
    }).concat(chain.carried(), whistle.carried(), rig.carried(), crane.carried()),
    timeLeft: job.timeLeft,
    delivered: job.delivered,
    quota: job.quota,
    fines: job.fines,
    net: job.net(),
    inspectors: inspector.list(),
    decoys: decoy.list(),
    state: job.state,
    breaches: breach.list(),
    chains: chain.list(),
    whistles: whistle.list(),
    rigs: rig.list(),
    zips: rig.zips(),
    crane: crane.snapshot(),
    ...(auto ? autoSnapshot() : { auto: false, economy: null, hire: null, boosts: [], hints: null, whistleCooldown: 0 }),
  });

  return world;
}
