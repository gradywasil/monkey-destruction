import { canHaul, crewTile } from './crew.js';
import { hireCostFor, RESCUE_DELAY, RESCUE_GRACE, RESCUE_MAX } from '../data/economy.js';

export const AUTO_INTERVAL = 0.4;
const SKIP_FOR = 4;
const NEAR_INSPECTOR = 9;
const WEIGHT_COST = 6;
const ZIP_COST = 4;
const MIN_ZIP_GAIN = 3;
const HOP_DISCOUNT = 0.5;
const HP_BIAS = 10;
const PRIORITY_BONUS = 1e6;

/**
 * Automation brain ("economy v2"): every ~0.4 s of sim time it hands idle hired crew work through the
 * ordinary commands (haulWith / breach / rig / decoy), so manual orders keep working and win.
 * Only crew that are 'idle' are touched. Deterministic: scan orders are fixed and ties break on id.
 * @param {object} world
 * @param {(type:string, payload:object)=>void} emit
 * @param {{decoys:()=>{inspectorId:string, state:string}[]}} deps
 */
export function createAutoSystem(world, emit, deps) {
  const { grid, items, path, crew, commands } = world;
  const W = grid.width;
  const N = W * grid.height;
  const drop = grid.truck ? { x: grid.truck.dropX, y: grid.truck.dropY } : null;
  const hints = { sealedValue: 0, heavyWaiting: 0, inspectorNear: false, idleHaulers: 0, idleBreachers: 0 };
  const skipUntil = new Map();
  const adjCache = new Map();
  const queue = new Int32Array(N);
  const dropField = new Int16Array(N);
  const fields = [];
  const winField = new Int16Array(N);
  const idleH = [];
  const cand = [];
  const pick = [];
  let dm = new Int16Array(0);
  let taken = new Uint8Array(0);
  let dropVer = -1;
  let acc = AUTO_INTERVAL;
  let stallFor = 0;
  let lastCheck = 0;
  let claimable = 0;
  let heavyNeed = 0;
  let priorityId = null;
  const sealedIds = new Set();

  /** BFS walking distance from (sx,sy) over open edges into `dist` (-1 = unreachable). */
  const bfs = (dist, sx, sy) => {
    dist.fill(-1);
    if (!grid.inBounds(sx, sy)) return;
    let qh = 0;
    let qt = 0;
    dist[sy * W + sx] = 0;
    queue[qt++] = sy * W + sx;
    while (qh < qt) {
      const i = queue[qh++];
      const x = i % W;
      const y = (i / W) | 0;
      const nd = dist[i] + 1;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? 1 : d === 2 ? -1 : 0);
        const ny = y + (d === 1 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= W || ny >= grid.height) continue;
        const ni = ny * W + nx;
        if (dist[ni] !== -1 || !grid.canStep(x, y, nx, ny)) continue;
        dist[ni] = nd;
        queue[qt++] = ni;
      }
    }
  };

  const adjOf = (it) => {
    let e = adjCache.get(it.id);
    if (!e || e.v !== grid.version) {
      const tiles = path.adjacentTiles(it);
      e = { v: grid.version, tiles: Int32Array.from(tiles, (t) => t.y * W + t.x) };
      adjCache.set(it.id, e);
    }
    return e.tiles;
  };

  const minDist = (dist, tiles) => {
    let m = -1;
    for (let k = 0; k < tiles.length; k++) {
      const d = dist[tiles[k]];
      if (d >= 0 && (m < 0 || d < m)) m = d;
    }
    return m;
  };

  const refreshDrop = () => {
    if (dropVer === grid.version) return;
    dropVer = grid.version;
    if (drop) bfs(dropField, drop.x, drop.y);
    else dropField.fill(-1);
  };

  /** Collect claimable items + hint numbers. */
  const scan = () => {
    refreshDrop();
    cand.length = 0;
    hints.sealedValue = 0;
    hints.heavyWaiting = 0;
    sealedIds.clear();
    claimable = 0;
    heavyNeed = 0;
    let haulers = 0;
    let idleB = 0;
    idleH.length = 0;
    for (const c of crew) {
      if (canHaul(c.role)) haulers++;
      if (c.state !== 'idle') continue;
      if (canHaul(c.role)) idleH.push(c);
      else if (c.role === 'breacher') idleB++;
    }
    hints.idleHaulers = idleH.length;
    hints.idleBreachers = idleB;
    for (const it of items.list()) {
      if (it.state !== 'placed') continue;
      const tiles = adjOf(it);
      if (minDist(dropField, tiles) < 0) {
        hints.sealedValue += it.value;
        sealedIds.add(it.id);
        continue;
      }
      claimable++;
      const need = world.carriersNeeded(it.weight);
      if (need > haulers) {
        hints.heavyWaiting++;
        claimable--;
        if (!heavyNeed || need < heavyNeed) heavyNeed = need;
      } else if ((skipUntil.get(it.id) ?? 0) <= world.time) cand.push(it);
    }
    return haulers;
  };

  const fieldFor = (k) => fields[k] ?? (fields[k] = new Int16Array(N));

  const assignHaulers = (haulers) => {
    const nh = idleH.length;
    const nc = cand.length;
    if (!nh || !nc) return;
    if (dm.length < nh * nc) dm = new Int16Array(nh * nc * 2);
    if (taken.length < nh) taken = new Uint8Array(nh * 2);
    taken.fill(0);
    for (let k = 0; k < nh; k++) {
      const t = crewTile(idleH[k]);
      bfs(fieldFor(k), t.x, t.y);
    }
    for (let ci = 0; ci < nc; ci++) {
      const tiles = adjOf(cand[ci]);
      for (let k = 0; k < nh; k++) dm[ci * nh + k] = minDist(fields[k], tiles);
    }
    let left = nh;
    const used = new Set();
    while (left > 0) {
      let best = null;
      let bestScore = 0;
      let hold = 0;
      for (let ci = 0; ci < nc; ci++) {
        const it = cand[ci];
        if (used.has(it.id)) continue;
        const need = world.carriersNeeded(it.weight);
        // gather the `need` nearest still-free haulers that can reach it
        pick.length = 0;
        let worst = 0;
        for (let n = 0; n < need; n++) {
          let bk = -1;
          for (let k = 0; k < nh; k++) {
            if (taken[k] || pick.includes(k)) continue;
            const d = dm[ci * nh + k];
            if (d >= 0 && (bk < 0 || d < dm[ci * nh + bk])) bk = k;
          }
          if (bk < 0) break;
          pick.push(bk);
          worst = Math.max(worst, dm[ci * nh + bk]);
        }
        if (!pick.length) continue;
        const score = it.value / (worst + WEIGHT_COST * it.weight) + (it.id === priorityId ? PRIORITY_BONUS : 0);
        if (pick.length < need) {
          // heavy loot that busy haulers could still join: remember how good it would be
          if (need <= haulers && score > hold) hold = score;
          continue;
        }
        if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && best && it.id < best.it.id)) {
          bestScore = score;
          best = { it, ci, members: pick.slice() };
        }
      }
      // a more valuable heavy item is waiting on busy haulers: keep the idle ones back so it can start
      if (!best || hold > bestScore) return;
      const members = best.members.map((k) => idleH[k]);
      const r = commands.haulWith(members.map((c) => c.id), best.it.id);
      if (r.ok) {
        for (const k of best.members) taken[k] = 1;
        left -= best.members.length;
      } else {
        skipUntil.set(best.it.id, world.time + SKIP_FOR);
        if (best.it.id === priorityId) priorityId = null;
      }
      used.add(best.it.id);
    }
  };

  // ---- breachers ----
  const comp = new Int16Array(N);
  let breachKey = '';
  let breachPlan = [];

  const buildBreachPlan = () => {
    comp.fill(-1);
    let nComp = 0;
    for (let s = 0; s < N; s++) {
      if (comp[s] !== -1 || !grid.isWalkable(s % W, (s / W) | 0)) continue;
      let qh = 0;
      let qt = 0;
      comp[s] = nComp;
      queue[qt++] = s;
      while (qh < qt) {
        const i = queue[qh++];
        const x = i % W;
        const y = (i / W) | 0;
        for (let d = 0; d < 4; d++) {
          const nx = x + (d === 0 ? 1 : d === 2 ? -1 : 0);
          const ny = y + (d === 1 ? 1 : d === 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= W || ny >= grid.height) continue;
          const ni = ny * W + nx;
          if (comp[ni] === -1 && grid.canStep(x, y, nx, ny)) {
            comp[ni] = nComp;
            queue[qt++] = ni;
          }
        }
      }
      nComp++;
    }
    const home = drop ? comp[drop.y * W + drop.x] : -1;
    const value = new Float64Array(nComp);
    for (const it of items.list()) {
      if (it.state !== 'placed') continue;
      const tiles = adjOf(it);
      if (!tiles.length) continue;
      const c = comp[tiles[0]];
      if (c >= 0 && !tiles.some((t) => comp[t] === home)) value[c] += it.value;
    }
    const edges = [];
    for (const [k, e] of grid.edges) {
      if (e.broken || !((e.type === 'wall' && e.material === 'drywall') || e.type === 'door')) continue;
      const [sx, sy, side] = k.split(',');
      const x = +sx;
      const y = +sy;
      const ox = side === 'N' ? x : x - 1;
      const oy = side === 'N' ? y - 1 : y;
      if (!grid.isWalkable(x, y) || !grid.isWalkable(ox, oy)) continue;
      const a = comp[y * W + x];
      const b = comp[oy * W + ox];
      if (a !== b) edges.push({ edge: { x, y, side }, a, b, hp: e.hp, key: k });
    }
    const plan = [];
    const seen = new Uint8Array(nComp);
    const stack = [];
    for (const e of edges) {
      const far = e.a === home ? e.b : e.b === home ? e.a : -1;
      if (far < 0) continue;
      // value behind the edge, plus a discounted share of whatever lies further through other breakable edges
      let benefit = value[far];
      seen.fill(0);
      seen[home] = 1;
      seen[far] = 1;
      stack.length = 0;
      stack.push(far);
      while (stack.length) {
        const c = stack.pop();
        for (const o of edges) {
          const n = o.a === c ? o.b : o.b === c ? o.a : -1;
          if (n < 0 || seen[n]) continue;
          seen[n] = 1;
          benefit += HOP_DISCOUNT * value[n];
          stack.push(n);
        }
      }
      if (benefit > 0) plan.push({ edge: e.edge, score: benefit / (e.hp + HP_BIAS), key: e.key });
    }
    plan.sort((p, q) => q.score - p.score || (p.key < q.key ? -1 : 1));
    return plan;
  };

  const assignBreachers = () => {
    if (!hints.idleBreachers) return;
    const key = `${grid.version}|${items.totals.count}`;
    if (key !== breachKey) {
      breachKey = key;
      breachPlan = buildBreachPlan();
    }
    let free = hints.idleBreachers;
    for (const p of breachPlan) {
      if (free <= 0) break;
      const r = commands.breach(p.edge);
      if (r.ok) free--;
      else if (r.reason === 'no-breacher') break;
    }
  };

  // ---- riggers ----
  let rigKey = '';
  let rigPlan = [];

  const insideOf = (x, y, side) => {
    const ox = side === 'N' ? x : x - 1;
    const oy = side === 'N' ? y - 1 : y;
    const ra = grid.tile(x, y)?.room ?? null;
    const rb = grid.tile(ox, oy)?.room ?? null;
    if (ra !== null && rb === null && grid.tile(ox, oy)) return { x, y };
    if (rb !== null && ra === null && grid.tile(x, y)) return { x: ox, y: oy };
    return null;
  };

  const buildRigPlan = () => {
    const plan = [];
    for (const [k, e] of grid.edges) {
      if (e.type !== 'window' || e.rigged || e.broken) continue;
      const [sx, sy, side] = k.split(',');
      const inside = insideOf(+sx, +sy, side);
      if (!inside || dropField[inside.y * W + inside.x] < 0) continue;
      bfs(winField, inside.x, inside.y);
      let benefit = 0;
      let best = 0;
      for (const it of cand) {
        const tiles = adjOf(it);
        const gain = minDist(dropField, tiles) - minDist(winField, tiles) - ZIP_COST;
        if (gain >= MIN_ZIP_GAIN) {
          benefit += it.value * gain;
          best = Math.max(best, gain);
        }
      }
      if (benefit > 0) plan.push({ edge: { x: +sx, y: +sy, side }, benefit, key: k });
    }
    plan.sort((p, q) => q.benefit - p.benefit || (p.key < q.key ? -1 : 1));
    return plan;
  };

  const assignRiggers = () => {
    let idle = 0;
    for (const c of crew) if (c.role === 'rigger' && c.state === 'idle') idle++;
    if (!idle) return;
    const key = `${grid.version}|${items.totals.count}|${cand.length}`;
    if (key !== rigKey) {
      rigKey = key;
      rigPlan = buildRigPlan();
    }
    for (const p of rigPlan) {
      if (idle <= 0) break;
      const r = commands.rig(p.edge);
      if (r.ok) idle--;
      else if (r.reason === 'no-rigger') break;
    }
  };

  // ---- decoys ----
  const assignDecoys = () => {
    const insps = world.inspectors;
    if (!insps?.length) return;
    let busyAny = false;
    for (const c of crew) if (c.state !== 'idle' && !c.state.startsWith('decoy')) { busyAny = true; break; }
    hints.inspectorNear = false;
    let idleDecoys = 0;
    for (const c of crew) if (c.role === 'decoy' && c.state === 'idle') idleDecoys++;
    for (const insp of insps) {
      let near = false;
      if (busyAny) {
        for (const c of crew) {
          if (c.state === 'idle' || c.state.startsWith('decoy')) continue;
          if (Math.hypot(c.x - insp.x, c.y - insp.y) <= NEAR_INSPECTOR) { near = true; break; }
        }
      }
      if (near) hints.inspectorNear = true;
      if (!idleDecoys || (insp.state !== 'patrol' && insp.state !== 'wait') || insp.immune > 0) continue;
      if (!near && insp.meter <= 0) continue;
      if (deps.decoys().some((d) => d.inspectorId === insp.id && (d.state === 'chase' || d.state === 'engaged'))) continue;
      let best = null;
      let bd = Infinity;
      for (const c of crew) {
        if (c.role !== 'decoy' || c.state !== 'idle') continue;
        const d = Math.hypot(c.x - insp.x, c.y - insp.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best && commands.decoy(insp.id, best.id).ok) idleDecoys--;
    }
  };

  /**
   * "Haul this next": when too few haulers are idle for the pinned item, pull back haulers that are only walking
   * toward other loot (nearest first). Drops the pin once the item is taken or can no longer be hauled.
   * @returns {boolean} true when crew were freed (the caller rescans).
   */
  const preemptForPriority = () => {
    if (priorityId == null) return false;
    const it = items.get(priorityId);
    if (!it || it.state !== 'placed') {
      priorityId = null;
      return false;
    }
    const need = world.carriersNeeded(it.weight);
    if (idleH.length >= need) return false;
    const tiles = adjOf(it);
    const ax = tiles.length ? tiles[0] % W : it.x;
    const ay = tiles.length ? (tiles[0] / W) | 0 : it.y;
    const walkers = crew
      .filter((c) => canHaul(c.role) && c.state === 'toItem' && c.itemId !== it.id && !deps.isWhistling(c.itemId))
      .sort((a, b) => Math.hypot(a.x - ax, a.y - ay) - Math.hypot(b.x - ax, b.y - ay) || (a.id < b.id ? -1 : 1));
    let freed = false;
    let have = idleH.length;
    for (const c of walkers) {
      if (have >= need) break;
      if (c.state !== 'toItem') continue;
      const before = crew.reduce((n, k) => n + (k.state === 'idle' ? 1 : 0), 0);
      if (!commands.cancel(c.id)) continue;
      freed = true;
      have += crew.reduce((n, k) => n + (k.state === 'idle' ? 1 : 0), 0) - before;
    }
    return freed;
  };

  /** Cheapest purchase that restores progress, or null when money would not help. */
  const rescueNeed = (haulers) => {
    const eco = world.econ;
    const roleCount = (r) => crew.reduce((n, c) => n + (c.role === r ? 1 : 0), 0);
    if (hints.sealedValue > 0 && !roleCount('breacher')) {
      return crew.length < world.crewCap() ? { reason: 'breacher', cost: world.hireCost('breacher') } : null;
    }
    if (hints.heavyWaiting > 0) {
      const extra = heavyNeed - haulers;
      if (extra <= 0 || crew.length + extra > world.crewCap()) return null;
      let cost = 0;
      for (let k = 0; k < extra; k++) cost += hireCostFor('hauler', eco.hired.hauler + k, world.modifiers.hireCost);
      return { reason: 'haulers', cost };
    }
    if (hints.sealedValue > 0 && !roleCount('rigger') && crew.length < world.crewCap()
      && [...grid.edges.values()].some((e) => e.type === 'window' && !e.rigged && !e.broken)) {
      return { reason: 'rigger', cost: world.hireCost('rigger') };
    }
    return null;
  };

  /** Stall rescue: nothing moving, nothing claimable, cash too low for the one hire that helps -> grant the gap. */
  const checkRescue = (haulers) => {
    const eco = world.econ;
    const dt = world.time - lastCheck;
    lastCheck = world.time;
    const idle = crew.every((c) => c.state === 'idle');
    const live = !world.job || world.job.state !== 'ended';
    if (world.time < RESCUE_GRACE || !idle || claimable > 0 || !live || items.totals.count >= items.list().length) {
      stallFor = 0;
      return;
    }
    stallFor += dt;
    if (stallFor < RESCUE_DELAY || eco.advances >= RESCUE_MAX) return;
    const need = rescueNeed(haulers);
    if (!need) return;
    const gap = need.cost - world.cash();
    stallFor = 0;
    if (gap <= 0) return;
    eco.granted += gap;
    eco.advances++;
    eco.advanced += gap;
    emit('bailout', { amount: gap, reason: need.reason });
  };

  return {
    hints,
    priority: () => priorityId,
    /** True when the item cannot reach the truck until a wall breaks (as of the last auto scan). */
    isSealed: (id) => sealedIds.has(id),
    /** Pin an item as "haul this next" (calling again with the same id unpins). */
    setPriority(itemId) {
      if (itemId === priorityId) {
        priorityId = null;
        return { ok: true, cleared: true };
      }
      const it = items.get(itemId);
      if (!it || it.state !== 'placed') return { ok: false, reason: 'not-placed' };
      refreshDrop();
      if (minDist(dropField, adjOf(it)) < 0) return { ok: false, reason: 'unreachable' };
      let haulers = 0;
      for (const c of crew) if (canHaul(c.role)) haulers++;
      const need = world.carriersNeeded(it.weight);
      if (need > haulers) return { ok: false, reason: 'not-enough-haulers', needed: need, haulers };
      priorityId = itemId;
      acc = AUTO_INTERVAL;
      return { ok: true, cleared: false };
    },
    update(dt) {
      acc += dt;
      if (acc < AUTO_INTERVAL - 1e-9) return;
      acc = 0;
      let haulers = scan();
      if (preemptForPriority()) haulers = scan();
      checkRescue(haulers);
      assignBreachers();
      assignRiggers();
      assignDecoys();
      assignHaulers(haulers);
    },
  };
}
