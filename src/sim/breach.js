import { crewTile, faceToward, idleCrew, stepCrew } from './crew.js';

export const HIT_INTERVAL = 0.55;
export const BREACH_DAMAGE = 20;

const BREACHABLE = { wall: ['drywall'], door: null, window: ['glass'] };

/**
 * Breacher crew smash walls, doors and windows.
 * @param {object} world
 * @param {(type:string, payload:object) => void} emit
 */
export function createBreachSystem(world, emit) {
  const { grid, path, crew, job } = world;
  const jobs = new Map();
  const ekey = (e) => `${e.x},${e.y},${e.side}`;
  const sides = (e) => [{ x: e.x, y: e.y }, e.side === 'N' ? { x: e.x, y: e.y - 1 } : { x: e.x - 1, y: e.y }];

  const check = (e) => {
    const w = grid.edge(e.x, e.y, e.side);
    if (!w || w.broken || !(w.type in BREACHABLE)) return { reason: 'not-breachable' };
    const mats = BREACHABLE[w.type];
    if (mats && !mats.includes(w.material)) return { reason: w.material === 'brick' ? 'too-tough' : 'not-breachable' };
    return { w };
  };

  const route = (c, e) => {
    const t = crewTile(c);
    const goals = sides(e).filter((g) => grid.isWalkable(g.x, g.y));
    return goals.length ? path.findPathToAny(t.x, t.y, goals) : null;
  };

  const stop = (b) => {
    jobs.delete(b.crewId);
    idleCrew(b.c);
  };

  const fail = (b, reason) => {
    stop(b);
    emit('fail', { edge: b.edge, crewIds: [b.crewId], reason });
  };

  const setRoute = (b) => {
    const r = route(b.c, b.edge);
    if (!r) return false;
    const t = crewTile(b.c);
    b.c.target = r.goal;
    b.c.path = r.path.length ? r.path : [{ x: t.x, y: t.y }];
    b.version = grid.version;
    return true;
  };

  const face = (b) => {
    const { x, y, side } = b.edge;
    const mx = side === 'N' ? x + 0.5 : x;
    const my = side === 'N' ? y : y + 0.5;
    faceToward(b.c, mx - b.c.x, my - b.c.y);
  };

  /**
   * @param {{x:number,y:number,side:'N'|'W'}} edge
   * @param {string[]} [crewIds]
   */
  function breach(edge, crewIds) {
    if (job.state === 'ended') return { ok: false, reason: 'ended' };
    const e = { x: edge.x, y: edge.y, side: edge.side };
    const { reason } = check(e);
    if (reason) return { ok: false, reason };
    const k = ekey(e);
    let chosen;
    if (crewIds) {
      const members = crewIds.map((id) => crew.find((c) => c.id === id));
      if (members.some((c) => c && c.role !== 'breacher')) return { ok: false, reason: 'wrong-role' };
      if (!members.length || members.some((c) => !c || c.state !== 'idle')) return { ok: false, reason: 'no-breacher' };
      chosen = [];
      for (const c of members) {
        const r = route(c, e);
        if (!r) return { ok: false, reason: 'unreachable' };
        chosen.push(c);
      }
    } else {
      if ([...jobs.values()].some((b) => ekey(b.edge) === k)) return { ok: false, reason: 'already' };
      const idle = crew.filter((c) => c.state === 'idle' && c.role === 'breacher');
      if (!idle.length) return { ok: false, reason: 'no-breacher' };
      let best = null;
      idle.forEach((c, i) => {
        const r = route(c, e);
        if (r && (!best || r.path.length < best.d)) best = { c, d: r.path.length, i };
      });
      if (!best) return { ok: false, reason: 'unreachable' };
      chosen = [best.c];
    }
    for (const c of chosen) {
      const b = { crewId: c.id, c, edge: e, phase: 'walk', timer: 0, version: grid.version };
      c.state = 'toBreach';
      setRoute(b);
      jobs.set(c.id, b);
    }
    const ids = chosen.map((c) => c.id);
    emit('breachAssign', { edge: e, crewIds: ids });
    return { ok: true, crewIds: ids };
  }

  const hit = (b) => {
    const { w } = check(b.edge);
    if (!w) return stop(b);
    const r = grid.damageEdge(b.edge.x, b.edge.y, b.edge.side, BREACH_DAMAGE * world.modifiers.breachDamage);
    emit('hit', { edge: b.edge, hp: r.hp, maxHp: w.maxHp ?? w.hp, crewId: b.crewId });
    if (r.broken) {
      emit('break', { edge: b.edge, material: w.material });
      const k = ekey(b.edge);
      for (const o of [...jobs.values()]) if (ekey(o.edge) === k) stop(o);
    }
  };

  function update(dt) {
    for (const b of [...jobs.values()]) {
      if (!jobs.has(b.crewId)) continue;
      if (!check(b.edge).w) {
        stop(b);
        continue;
      }
      if (b.phase === 'walk') {
        const g = b.c.target;
        if (b.version !== grid.version || (g && !grid.isWalkable(g.x, g.y))) {
          if (!setRoute(b)) {
            fail(b, 'unreachable');
            continue;
          }
        }
        if (!stepCrew(b.c, dt, world.speedOf(b.c))) continue;
        b.phase = 'swing';
        b.c.state = 'breaching';
        b.timer = HIT_INTERVAL;
        face(b);
        continue;
      }
      face(b);
      b.timer -= dt;
      if (b.timer > 1e-9) continue;
      b.timer += HIT_INTERVAL;
      hit(b);
    }
  }

  /** Stop a crew member's breach. @returns {boolean} */
  function cancel(crewId) {
    const b = jobs.get(crewId);
    if (!b) return false;
    stop(b);
    return true;
  }

  /** @returns {{edge:object, hp:number, maxHp:number}[]} edges under attack */
  function list() {
    const seen = new Map();
    for (const b of jobs.values()) {
      if (b.phase !== 'swing') continue;
      const k = ekey(b.edge);
      if (seen.has(k)) continue;
      const w = grid.edge(b.edge.x, b.edge.y, b.edge.side);
      if (w) seen.set(k, { edge: { ...b.edge }, hp: w.hp, maxHp: w.maxHp ?? w.hp });
    }
    return [...seen.values()];
  }

  return { breach, update, cancel, list };
}
