import { crewTile, faceToward, idleCrew, stepCrew } from './crew.js';

export const DECOY_SPEED = 2.6;
export const DECOY_STAMINA = 10;
export const DECOY_TIRED_TIME = 8;
export const ENGAGE_RANGE = 1.3;
export const STALL_HOLD = 0.6;
export const GIVE_UP_TIME = 2;
const REPATH = 0.4;

/**
 * Legal Decoys chase an inspector and stall him until their stamina runs out.
 * @param {object} world
 * @param {(type:string, payload:object) => void} emit
 */
export function createDecoySystem(world, emit) {
  const { grid, path, crew, job } = world;
  const recs = new Map();

  const recOf = (c) => {
    if (!recs.has(c.id)) recs.set(c.id, { c, insp: null, stamina: DECOY_STAMINA * world.modifiers.decoyStamina, mode: 'idle', repath: 0, lost: 0, tired: 0 });
    return recs.get(c.id);
  };

  const findInsp = (id) => world.inspectors?.find((i) => i.id === id) ?? null;

  const route = (r) => {
    const { c, insp } = r;
    const t = crewTile(c);
    const it = { x: Math.floor(insp.x), y: Math.floor(insp.y) };
    const goals = grid.neighbors(it.x, it.y).filter((n) => grid.isWalkable(n.x, n.y));
    const hit = goals.length ? path.findPathToAny(t.x, t.y, goals) : null;
    if (!hit) return false;
    c.target = hit.goal;
    c.path = hit.path;
    return true;
  };

  const release = (r) => {
    if (r.mode === 'engaged') emit('stallEnd', { inspectorId: r.insp.id });
    r.lastId = r.insp.id;
    idleCrew(r.c);
    r.mode = 'idle';
    r.insp = null;
  };

  const done = (r, reason) => {
    const id = r.insp.id;
    release(r);
    emit('decoyDone', { crewId: r.c.id, inspectorId: id, reason });
  };

  const setMode = (r, mode) => {
    r.mode = mode;
    r.c.state = mode === 'chase' ? 'decoyChase' : mode === 'engaged' ? 'decoyEngaged' : 'decoyTired';
  };

  /** @returns {{ok:true, crewId:string}|{ok:false, reason:string}} */
  function decoy(inspectorId, crewId) {
    if (job.state === 'ended') return { ok: false, reason: 'ended' };
    const insp = findInsp(inspectorId);
    if (!insp) return { ok: false, reason: 'not-found' };
    const decoys = crew.filter((c) => c.role === 'decoy');
    let c;
    if (crewId !== undefined) {
      c = decoys.find((d) => d.id === crewId);
      if (!c) return { ok: false, reason: 'no-decoy' };
      if (c.state === 'decoyTired') return { ok: false, reason: 'tired' };
      if (c.state !== 'idle') return { ok: false, reason: 'no-decoy' };
    } else {
      c = decoys.find((d) => d.state === 'idle');
      if (!c) return { ok: false, reason: decoys.some((d) => d.state === 'decoyTired') ? 'tired' : 'no-decoy' };
    }
    const r = recOf(c);
    r.insp = insp;
    if (!route(r)) {
      r.insp = null;
      return { ok: false, reason: 'unreachable' };
    }
    r.repath = REPATH;
    r.lost = 0;
    setMode(r, 'chase');
    emit('decoy', { crewId: c.id, inspectorId });
    return { ok: true, crewId: c.id };
  }

  /** Stop chasing/engaging immediately (stamina is kept). @returns {boolean} */
  function cancel(crewId) {
    const r = recs.get(crewId);
    if (!r || (r.mode !== 'chase' && r.mode !== 'engaged')) return false;
    release(r);
    return true;
  }

  function update(dt) {
    for (const r of recs.values()) {
      const { c, insp } = r;
      if (r.mode === 'tired') {
        r.tired -= dt;
        if (r.tired <= 1e-9) {
          r.stamina = DECOY_STAMINA * world.modifiers.decoyStamina;
          idleCrew(c);
          r.mode = 'idle';
        }
        continue;
      }
      if (r.mode === 'idle') continue;
      const dx = insp.x - c.x;
      const dy = insp.y - c.y;
      if (Math.hypot(dx, dy) <= ENGAGE_RANGE) {
        if (r.mode === 'chase') {
          setMode(r, 'engaged');
          c.path = [];
          emit('stallStart', { inspectorId: insp.id });
        }
        faceToward(c, dx, dy);
        if (insp.state !== 'fine') world.commands.inspector.stall(insp.id, STALL_HOLD);
        r.stamina = Math.max(0, r.stamina - dt);
        if (r.stamina <= 1e-9) {
          const id = insp.id;
          release(r);
          setMode(r, 'tired');
          r.tired = DECOY_TIRED_TIME;
          emit('decoyDone', { crewId: c.id, inspectorId: id, reason: 'shooed' });
        }
        continue;
      }
      if (r.mode === 'engaged') {
        emit('stallEnd', { inspectorId: insp.id });
        setMode(r, 'chase');
        r.repath = 0;
      }
      r.repath -= dt;
      if (r.repath <= 1e-9) {
        r.repath = REPATH;
        if (route(r)) r.lost = 0;
        else {
          c.path = [];
          r.lost += REPATH;
        }
      }
      if (r.lost >= GIVE_UP_TIME - 1e-9) {
        done(r, 'lost');
        continue;
      }
      stepCrew(c, dt, DECOY_SPEED);
    }
  }

  /** @returns {{crewId:string, inspectorId:string, stamina:number, state:string}[]} */
  function list() {
    return [...recs.values()].filter((r) => r.mode !== 'idle').map((r) => ({
      crewId: r.c.id, inspectorId: r.insp?.id ?? r.lastId, stamina: r.stamina, state: r.mode,
    }));
  }

  return { decoy, cancel, update, list };
}
