import { ITEM_DEFS } from '../data/items.js';
import { crewTile, faceToward, idleCrew, stepCrew, LIFT_TIME } from './crew.js';

export const STATION_SPACING = 5;
export const HANDOFF_TIME = 0.35;
export const FEED_RADIUS = 4;
const THROW_POSE = 0.2;

/**
 * Chain-gang haulers: a line of stationed haulers tosses weight-1 items hand to hand to the truck.
 * @param {object} world
 * @param {(type:string, payload:object) => void} emit
 */
export function createChainSystem(world, emit) {
  const { grid, path, crew, job, items } = world;
  const chains = new Map();
  let nextId = 1;
  const drop = grid.truck ? { x: grid.truck.dropX, y: grid.truck.dropY } : null;
  const truckAt = grid.truck ? { x: grid.truck.x + grid.truck.w / 2, y: grid.truck.y + grid.truck.d / 2 } : null;

  const route = (from) => {
    if (job.state === 'ended') return { reason: 'ended' };
    if (!from || !Number.isInteger(from.x) || !Number.isInteger(from.y) || !drop || !grid.isWalkable(from.x, from.y)) return { reason: 'invalid' };
    const p = path.findPath(from.x, from.y, drop.x, drop.y);
    if (!p) return { reason: 'unreachable' };
    const pathTiles = [{ x: from.x, y: from.y }, ...p];
    const len = pathTiles.length - 1;
    const n = Math.ceil(len / STATION_SPACING);
    const stations = [{ ...pathTiles[0] }];
    for (let i = 1; i <= n; i++) stations.push({ ...pathTiles[Math.round((i * len) / n)] });
    return { pathTiles, stations };
  };

  const idleHaulers = () => crew.filter((c) => c.state === 'idle' && c.role === 'hauler');

  /** @param {{x:number,y:number}} from */
  function preview(from) {
    const r = route(from);
    const available = idleHaulers().length;
    if (r.reason) return { ok: false, reason: r.reason, pathTiles: [], stations: [], needed: 0, available };
    return { ok: true, pathTiles: r.pathTiles, stations: r.stations, needed: r.stations.length, available };
  }

  const walkTo = (c, goal) => {
    const t = crewTile(c);
    const p = path.findPath(t.x, t.y, goal.x, goal.y);
    if (!p) return false;
    c.path = p.length ? p : [{ x: t.x, y: t.y }];
    return true;
  };

  /** @param {{x:number,y:number}} from */
  function create(from) {
    const r = route(from);
    if (r.reason) return { ok: false, reason: r.reason, needed: 0 };
    const needed = r.stations.length;
    const pool = idleHaulers();
    if (pool.length < needed) return { ok: false, reason: 'not-enough-haulers', needed };
    const picks = [];
    const used = new Set();
    for (const s of r.stations) {
      let best = null;
      for (const c of pool) {
        if (used.has(c)) continue;
        const t = crewTile(c);
        const p = path.findPath(t.x, t.y, s.x, s.y);
        if (p && (!best || p.length < best.d)) best = { c, d: p.length };
      }
      if (!best) return { ok: false, reason: 'unreachable', needed };
      used.add(best.c);
      picks.push(best.c);
    }
    const id = `chain${nextId++}`;
    const ch = {
      id, from: { x: from.x, y: from.y }, pathTiles: r.pathTiles, blocked: false, version: grid.version,
      stations: r.stations.map((s, i) => ({ x: s.x, y: s.y, c: picks[i], holding: null, incoming: false, arrived: false, throwT: 0 })),
      flights: [], feed: { phase: 'idle', itemId: null, lift: 0 }, scanKey: null,
    };
    for (const st of ch.stations) {
      st.c.state = 'chain';
      st.c.itemId = null;
      st.c.target = { x: st.x, y: st.y };
      if (!walkTo(st.c, st)) st.c.path = [];
    }
    chains.set(id, ch);
    emit('chainAssign', { chainId: id, crewIds: picks.map((c) => c.id) });
    return { ok: true, chainId: id, stations: r.stations, needed };
  }

  const dropNear = (itemId, x, y) => {
    const start = { x: Math.min(grid.width - 1, Math.max(0, Math.floor(x))), y: Math.min(grid.height - 1, Math.max(0, Math.floor(y))) };
    const occupied = new Set(crew.map((c) => { const t = crewTile(c); return `${t.x},${t.y}`; }));
    const seen = new Set([`${start.x},${start.y}`]);
    const order = [start];
    for (let i = 0; i < order.length; i++) {
      for (const n of grid.neighbors(order[i].x, order[i].y)) {
        const k = `${n.x},${n.y}`;
        if (!seen.has(k)) { seen.add(k); order.push(n); }
      }
    }
    for (let yy = 0; yy < grid.height; yy++) for (let xx = 0; xx < grid.width; xx++) {
      if (!seen.has(`${xx},${yy}`)) order.push({ x: xx, y: yy });
    }
    const free = order.filter((t) => !occupied.has(`${t.x},${t.y}`));
    for (const t of [...free, ...order]) if (items.drop(itemId, t.x, t.y)) return true;
    return false;
  };

  const stationPos = (ch, idx) => (idx >= ch.stations.length ? truckAt : { x: ch.stations[idx].x + 0.5, y: ch.stations[idx].y + 0.5 });

  const flightPos = (ch, f) => {
    const a = stationPos(ch, f.fromIdx);
    const b = stationPos(ch, f.toIdx);
    return { x: a.x + (b.x - a.x) * f.t, y: a.y + (b.y - a.y) * f.t };
  };

  /** @param {string} chainId @returns {boolean} */
  function remove(chainId) {
    const ch = chains.get(chainId);
    if (!ch) return false;
    chains.delete(chainId);
    for (const f of ch.flights) {
      const p = flightPos(ch, f);
      dropNear(f.itemId, p.x, p.y);
    }
    const feeder = ch.stations[0].c;
    if (ch.feed.itemId) {
      const it = items.get(ch.feed.itemId);
      if (it?.state === 'claimed') items.release(it.id);
      else if (it?.state === 'carried') dropNear(it.id, feeder.x, feeder.y);
    }
    for (const st of ch.stations) {
      if (st.holding) dropNear(st.holding, st.c.x, st.c.y);
      idleCrew(st.c);
      st.c.chainPose = null;
    }
    emit('chainRemove', { chainId });
    return true;
  }

  const connected = (ch) => ch.stations.every((s, i) => i === 0 || path.findPath(ch.stations[i - 1].x, ch.stations[i - 1].y, s.x, s.y));

  const resetFeed = (ch) => {
    const feeder = ch.stations[0].c;
    const it = ch.feed.itemId ? items.get(ch.feed.itemId) : null;
    if (it?.state === 'claimed') items.release(it.id);
    else if (it?.state === 'carried') dropNear(it.id, feeder.x, feeder.y);
    ch.feed = { phase: 'idle', itemId: null, lift: 0 };
  };

  const onGridChange = (ch) => {
    ch.version = grid.version;
    const p = path.findPath(ch.from.x, ch.from.y, drop.x, drop.y);
    ch.pathTiles = p ? [{ ...ch.from }, ...p] : [];
    const wasBlocked = ch.blocked;
    ch.blocked = !connected(ch);
    if (ch.blocked && !wasBlocked) emit('blocked', { chainId: ch.id, crewIds: ch.stations.map((s) => s.c.id) });
    ch.stations.forEach((st, i) => {
      if (i === 0 && ch.feed.phase !== 'idle') return;
      if (!st.arrived && !walkTo(st.c, st)) st.c.path = [];
    });
    const f = ch.feed;
    const feeder = ch.stations[0].c;
    if (f.phase === 'toItem') {
      const it = items.get(f.itemId);
      const t = crewTile(feeder);
      const r = it && !ch.blocked ? path.findPathToAny(t.x, t.y, path.adjacentTiles(it)) : null;
      if (!r) {
        resetFeed(ch);
        ch.stations[0].arrived = false;
        if (!walkTo(feeder, ch.stations[0])) feeder.path = [];
      } else feeder.path = r.path.length ? r.path : [{ x: t.x, y: t.y }];
    } else if (f.phase === 'return' && !walkTo(feeder, ch.stations[0])) {
      resetFeed(ch);
      feeder.path = [];
    }
  };

  const findFeed = (ch) => {
    const s0 = ch.stations[0];
    let best = null;
    for (const it of items.list()) {
      if (it.state !== 'placed' || it.weight !== 1) continue;
      const adj = path.adjacentTiles(it);
      const r = adj.length ? path.findPathToAny(s0.x, s0.y, adj) : null;
      if (r && r.path.length <= FEED_RADIUS && (!best || r.path.length < best.r.path.length)) best = { it, r };
    }
    return best;
  };

  const updateFeeder = (ch, dt) => {
    const s0 = ch.stations[0];
    const c = s0.c;
    const f = ch.feed;
    if (f.phase === 'idle') {
      if (!s0.arrived || s0.holding || ch.blocked) return;
      const key = `${grid.version}:${items.placed().length}`;
      if (ch.scanKey === key) return;
      const best = findFeed(ch);
      if (!best) { ch.scanKey = key; return; }
      ch.scanKey = null;
      if (!items.claim(best.it.id, [c.id])) return;
      f.phase = 'toItem';
      f.itemId = best.it.id;
      c.itemId = best.it.id;
      s0.arrived = false;
      c.path = best.r.path.length ? best.r.path : [crewTile(c)];
    }
    if (f.phase === 'toItem') {
      if (!stepCrew(c, dt, world.speedOf(c))) return;
      f.phase = 'lifting';
      f.lift = LIFT_TIME;
      const it = items.get(f.itemId);
      if (it) faceToward(c, it.x + it.w / 2 - c.x, it.y + it.d / 2 - c.y);
      return;
    }
    if (f.phase === 'lifting') {
      f.lift -= dt;
      if (f.lift > 1e-9) return;
      const it = items.get(f.itemId);
      if (!it || !items.pickUp(it.id)) {
        ch.feed = { phase: 'idle', itemId: null, lift: 0 };
        c.itemId = null;
        if (!walkTo(c, s0)) c.path = [];
        return;
      }
      emit('pickup', { item: it, crewIds: [c.id] });
      f.phase = 'return';
      if (!walkTo(c, s0)) c.path = [];
      return;
    }
    if (f.phase === 'return') {
      const it = items.get(f.itemId);
      if (!stepCrew(c, dt, world.speedOf(c, it?.weight ?? 1))) return;
      s0.holding = f.itemId;
      s0.arrived = true;
      c.itemId = null;
      ch.feed = { phase: 'idle', itemId: null, lift: 0 };
    }
  };

  const updateChain = (ch, dt) => {
    if (ch.version !== grid.version) onGridChange(ch);
    const n = ch.stations.length;
    ch.stations.forEach((st, i) => {
      if (st.throwT > 0) st.throwT = Math.max(0, st.throwT - dt);
      if (i === 0 && ch.feed.phase !== 'idle') return;
      if (!st.arrived && stepCrew(st.c, dt, world.speedOf(st.c))) st.arrived = crewTile(st.c).x === st.x && crewTile(st.c).y === st.y;
    });
    updateFeeder(ch, dt);
    for (const f of [...ch.flights]) {
      f.t = Math.min(1, f.t + dt / HANDOFF_TIME);
      if (f.t < 1) continue;
      ch.flights.splice(ch.flights.indexOf(f), 1);
      if (f.toIdx >= n) {
        const it = items.get(f.itemId);
        const base = items.deliver(f.itemId);
        const value = world.credit(base);
        emit('deliver', { item: it, value, base, crewIds: [ch.stations[n - 1].c.id] });
      } else {
        const to = ch.stations[f.toIdx];
        to.incoming = false;
        to.holding = f.itemId;
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      const st = ch.stations[i];
      if (!st.holding || !st.arrived) continue;
      const next = ch.stations[i + 1];
      if (next && (!next.arrived || next.holding || next.incoming)) continue;
      if (next) next.incoming = true;
      ch.flights.push({ itemId: st.holding, fromIdx: i, toIdx: i + 1, t: 0 });
      st.holding = null;
      st.throwT = THROW_POSE;
      emit('toss', { chainId: ch.id, itemId: ch.flights[ch.flights.length - 1].itemId, fromIdx: i, toIdx: i + 1 });
    }
    ch.stations.forEach((st, i) => {
      const c = st.c;
      const feeding = i === 0 && ch.feed.phase !== 'idle';
      if (feeding) {
        c.chainPose = ch.feed.phase === 'lifting' ? 'lift' : ch.feed.phase === 'return' ? 'carry' : 'walk';
        return;
      }
      if (!st.arrived) {
        c.chainPose = 'walk';
        return;
      }
      const to = stationPos(ch, i + 1);
      faceToward(c, to.x - c.x, to.y - c.y);
      c.chainPose = st.throwT > 0 ? 'throw' : st.holding ? 'carry' : 'idle';
    });
  };

  /** @param {number} dt */
  function update(dt) {
    for (const ch of [...chains.values()]) if (chains.has(ch.id)) updateChain(ch, dt);
  }

  /** Snapshot view of all chains. */
  function list() {
    return [...chains.values()].map((ch) => ({
      id: ch.id,
      active: !ch.blocked && ch.stations.every((s) => s.arrived || s === ch.stations[0]),
      blocked: ch.blocked,
      stations: ch.stations.map((s) => ({ x: s.x, y: s.y, crewId: s.c.id, holding: s.holding })),
      flights: ch.flights.map((f) => {
        const it = items.get(f.itemId);
        const p = flightPos(ch, f);
        return { itemId: f.itemId, kind: it.kind, fromIdx: f.fromIdx, toIdx: f.toIdx, t: f.t, x: p.x, y: p.y, z: ITEM_DEFS[it.kind].carryZ + 0.6 * Math.sin(Math.PI * f.t) };
      }),
    }));
  }

  /** Items held or in flight, for the renderer's carried list. */
  function carried() {
    const out = [];
    for (const ch of chains.values()) {
      const add = (id, x, y, z) => {
        const it = items.get(id);
        out.push({ id, kind: it.kind, x, y, z: z ?? ITEM_DEFS[it.kind].carryZ, weight: it.weight });
      };
      const feeder = ch.stations[0].c;
      if (ch.feed.phase === 'return') add(ch.feed.itemId, feeder.x, feeder.y);
      for (const s of ch.stations) if (s.holding) add(s.holding, s.c.x, s.c.y);
      for (const f of ch.flights) {
        const p = flightPos(ch, f);
        add(f.itemId, p.x, p.y, ITEM_DEFS[items.get(f.itemId).kind].carryZ + 0.6 * Math.sin(Math.PI * f.t));
      }
    }
    return out;
  }

  return { preview, create, remove, update, list, carried };
}
