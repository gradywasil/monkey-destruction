import { ITEM_DEFS } from '../data/items.js';
import { crewTile, faceToward, idleCrew, stepCrew } from './crew.js';

export const RIG_TIME = 4;
export const LAUNCH_TIME = 0.7;
export const ZIP_TIME = 1.2;
const ARC = 1.5;

/**
 * Riggers set up window zip-lines; heavy items are shoved out to a catch-net.
 * @param {object} world
 * @param {(type:string, payload:object) => void} emit
 * @param {{drop:{x:number,y:number}|null}} h
 */
export function createRigSystem(world, emit, h) {
  const { grid, path, crew, items, job } = world;
  const jobs = new Map();
  const shoves = [];
  const ekey = (e) => `${e.x},${e.y},${e.side}`;

  /** @returns {{inside:{x:number,y:number}, net:{x:number,y:number}}|null} */
  const sidesOf = (e) => {
    const a = { x: e.x, y: e.y };
    const b = e.side === 'N' ? { x: e.x, y: e.y - 1 } : { x: e.x - 1, y: e.y };
    const ra = grid.tile(a.x, a.y)?.room ?? null;
    const rb = grid.tile(b.x, b.y)?.room ?? null;
    if (ra !== null && rb === null && grid.tile(b.x, b.y)) return { inside: a, net: b };
    if (rb !== null && ra === null && grid.tile(a.x, a.y)) return { inside: b, net: a };
    return null;
  };

  const zips = () => {
    const out = [];
    for (const [k, w] of grid.edges) {
      if (w.type !== 'window' || !w.rigged) continue;
      const [x, y, side] = k.split(',');
      const edge = { x: +x, y: +y, side };
      const s = sidesOf(edge);
      if (s) out.push({ edge, inside: s.inside, net: s.net });
    }
    return out;
  };

  const routeTo = (c, goal) => {
    const t = crewTile(c);
    const p = path.findPath(t.x, t.y, goal.x, goal.y);
    if (!p) return null;
    c.target = goal;
    c.path = p.length ? p : [{ x: t.x, y: t.y }];
    return p;
  };

  /**
   * Route a carrier to the nearest of the truck drop and every rigged window.
   * @returns {{zip:object|null}|null} null when nothing is reachable
   */
  const routeOut = (c) => {
    const t = crewTile(c);
    let best = null;
    const opts = (h.drop ? [{ goal: h.drop, zip: null }] : []).concat(zips().map((z) => ({ goal: z.inside, zip: z })));
    for (const o of opts) {
      const p = path.findPath(t.x, t.y, o.goal.x, o.goal.y);
      if (p && (!best || p.length < best.p.length)) best = { ...o, p };
    }
    if (!best) return null;
    c.path = best.p.length ? best.p : [{ x: t.x, y: t.y }];
    return { zip: best.zip };
  };

  /** Hand a carried item at a rigged window to the zip-line. Members must already be released. */
  const shove = (members, it, zip) => {
    const leader = members[0];
    leader.state = 'launching';
    leader.itemId = it.id;
    shoves.push({ it, zip, leader, crewIds: members.map((c) => c.id), phase: 'launch', t: 0 });
  };

  const stop = (r) => {
    jobs.delete(r.c.id);
    idleCrew(r.c);
  };

  const check = (e) => {
    const w = grid.edge(e.x, e.y, e.side);
    if (!w || w.type !== 'window') return { reason: 'not-a-window' };
    const s = sidesOf(e);
    if (!s) return { reason: 'not-a-window' };
    if (w.rigged) return { reason: 'already-rigged' };
    return { w, s };
  };

  /**
   * @param {{x:number,y:number,side:'N'|'W'}} edge
   * @param {string[]} [crewIds]
   */
  function rig(edge, crewIds) {
    if (job.state === 'ended') return { ok: false, reason: 'ended' };
    const e = { x: edge.x, y: edge.y, side: edge.side };
    const { s, reason } = check(e);
    if (reason) return { ok: false, reason };
    if ([...jobs.values()].some((r) => ekey(r.edge) === ekey(e))) return { ok: false, reason: 'already-rigged' };
    const pool = crewIds ? crewIds.map((id) => crew.find((c) => c.id === id)) : crew;
    if (crewIds && pool.some((c) => !c || c.role !== 'rigger' || c.state !== 'idle')) return { ok: false, reason: 'no-rigger' };
    const idle = pool.filter((c) => c.state === 'idle' && c.role === 'rigger');
    if (!idle.length) return { ok: false, reason: 'no-rigger' };
    let best = null;
    for (const c of idle) {
      const t = crewTile(c);
      const p = path.findPath(t.x, t.y, s.inside.x, s.inside.y);
      if (p && (!best || p.length < best.d)) best = { c, d: p.length };
    }
    if (!best) return { ok: false, reason: 'unreachable' };
    const chosen = crewIds ? idle : [best.c];
    for (const c of chosen) {
      if (!routeTo(c, s.inside)) continue;
      c.state = 'toRig';
      jobs.set(c.id, { c, edge: e, inside: s.inside, phase: 'walk', timer: 0, version: grid.version });
    }
    const ids = chosen.filter((c) => jobs.has(c.id)).map((c) => c.id);
    emit('rigAssign', { edge: e, crewIds: ids });
    return { ok: true, crewIds: ids };
  }

  const face = (r) => {
    const { x, y, side } = r.edge;
    faceToward(r.c, (side === 'N' ? x + 0.5 : x) - r.c.x, (side === 'N' ? y : y + 0.5) - r.c.y);
  };

  const updateShove = (s, dt) => {
    s.t += dt;
    if (s.phase === 'launch') {
      if (s.t < LAUNCH_TIME - 1e-9) return false;
      s.phase = 'zip';
      s.t = 0;
      if (s.leader.state === 'launching' && s.leader.itemId === s.it.id) idleCrew(s.leader);
      emit('shove', { itemId: s.it.id, edge: { ...s.zip.edge } });
      return false;
    }
    if (s.t < ZIP_TIME - 1e-9) return false;
    const base = items.deliver(s.it.id);
    const value = world.credit(base);
    emit('deliver', { item: s.it, value, base, crewIds: s.crewIds });
    return true;
  };

  function update(dt) {
    for (let i = shoves.length - 1; i >= 0; i--) if (updateShove(shoves[i], dt)) shoves.splice(i, 1);
    for (const r of [...jobs.values()]) {
      const w = grid.edge(r.edge.x, r.edge.y, r.edge.side);
      if (!w || w.type !== 'window' || w.rigged) {
        stop(r);
        continue;
      }
      if (r.phase === 'walk') {
        if (r.version !== grid.version) {
          r.version = grid.version;
          if (!routeTo(r.c, r.inside)) {
            stop(r);
            emit('fail', { edge: r.edge, crewIds: [r.c.id], reason: 'unreachable' });
            continue;
          }
        }
        if (!stepCrew(r.c, dt, world.speedOf(r.c))) continue;
        r.phase = 'rig';
        r.c.state = 'rigging';
        face(r);
        continue;
      }
      r.timer += dt;
      if (r.timer < RIG_TIME - 1e-9) continue;
      for (const o of [...jobs.values()]) if (ekey(o.edge) === ekey(r.edge)) stop(o);
      grid.setRigged(r.edge.x, r.edge.y, r.edge.side, true);
      const s = sidesOf(r.edge);
      emit('rigged', { edge: { ...r.edge }, inside: s.inside, net: s.net });
    }
  }

  /** @returns {boolean} */
  function cancel(crewId) {
    const r = jobs.get(crewId);
    if (!r) return false;
    stop(r);
    return true;
  }

  const lerp = (a, b, f) => a + (b - a) * f;

  return {
    rig, cancel, update, routeOut, shove, zips,
    list: () => [...jobs.values()].map((r) => ({
      edge: { ...r.edge }, progress: r.phase === 'rig' ? Math.min(1, r.timer / RIG_TIME) : 0, crewId: r.c.id,
    })),
    carried: () => shoves.map((s) => {
      const z0 = ITEM_DEFS[s.it.kind].carryZ;
      const base = { id: s.it.id, kind: s.it.kind, weight: s.it.weight };
      if (s.phase === 'launch') return { ...base, x: s.leader.x, y: s.leader.y, z: z0 };
      const f = Math.min(1, s.t / ZIP_TIME);
      const { inside, net } = s.zip;
      return {
        ...base,
        x: lerp(inside.x + 0.5, net.x + 0.5, f),
        y: lerp(inside.y + 0.5, net.y + 0.5, f),
        z: lerp(z0, 0, f) + ARC * 4 * f * (1 - f),
      };
    }),
  };
}
