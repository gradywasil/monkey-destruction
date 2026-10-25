export const VISION_RANGE = 5;
export const VISION_HALF_ANGLE = (40 * Math.PI) / 180;
export const WAIT_TIME = 1.5;
export const FINE_TIME = 3.5;
export const FINE_IMMUNITY = 5;
export const STALL_IMMUNITY = 3;
export const ALERT_AT = 40;
const RISE = 35;
const RISE_MAX = 100;
const DECAY = 20;
const STEP = 0.25;
/** Auto mode: fines are softened, never push the wallet below zero and total at most AUTO_FINE_CAP of earnings. */
export const AUTO_FINE_MULT = 0.5;
export const AUTO_FINE_CAP = 0.25;

/** @returns {number} fine for the n-th (0-based) offence. */
export const fineAmount = (n) => Math.min(600, Math.round(150 * 1.5 ** n));

const sightBlocked = (grid, ax, ay, bx, by) => {
  const e = (x, y, side) => {
    const ed = grid.edge(x, y, side);
    return !!ed && ed.type !== 'none' && !ed.broken;
  };
  const between = (x0, y0, x1, y1) => {
    if (x0 !== x1) return e(Math.max(x0, x1), y0, 'W');
    return e(x0, Math.max(y0, y1), 'N');
  };
  if (ax === bx || ay === by) return between(ax, ay, bx, by);
  const viaX = between(ax, ay, bx, ay) || between(bx, ay, bx, by);
  const viaY = between(ax, ay, ax, by) || between(ax, by, bx, by);
  return viaX && viaY;
};

/**
 * Pure vision test: within range, inside the cone around (hx,hy) and with clear line of sight.
 * @param {import('./grid.js').Grid} grid
 * @param {{x:number,y:number,hx:number,hy:number}} insp
 * @returns {boolean}
 */
export function canSee(grid, insp, x, y) {
  const dx = x - insp.x;
  const dy = y - insp.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VISION_RANGE) return false;
  if (dist > 1e-6) {
    const cos = (dx * insp.hx + dy * insp.hy) / dist;
    if (cos < Math.cos(VISION_HALF_ANGLE) - 1e-9) return false;
  }
  const n = Math.ceil(dist / STEP);
  let tx = Math.floor(insp.x);
  let ty = Math.floor(insp.y);
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const nx = Math.floor(insp.x + dx * f);
    const ny = Math.floor(insp.y + dy * f);
    if (nx === tx && ny === ty) continue;
    if (sightBlocked(grid, tx, ty, nx, ny)) return false;
    tx = nx;
    ty = ny;
  }
  return true;
}

/**
 * Building inspectors: patrol waypoint loops, watch for visible work and fine the job.
 * @param {object} world
 * @param {(type:string, payload:object)=>void} emit
 * @param {{patrols?:{id:string,path:{x:number,y:number}[],speed:number}[], isWorking:(c:object)=>boolean}} opts
 */
export function createInspectorSystem(world, emit, { patrols = [], isWorking }) {
  const { grid, path, crew, job } = world;
  const list = patrols.map((p) => ({
    id: p.id,
    waypoints: p.path.map((w) => ({ x: w.x, y: w.y })),
    speed: p.speed,
    x: p.path[0].x + 0.5,
    y: p.path[0].y + 0.5,
    hx: 1,
    hy: 0,
    facing: 'right',
    state: 'patrol',
    meter: 0,
    alerted: false,
    wp: 0,
    route: [],
    version: -1,
    timer: 0,
    immune: 0,
    fines: 0,
  }));
  world.inspectors = list;
  const byId = new Map(list.map((i) => [i.id, i]));

  const setHeading = (insp, dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return;
    insp.hx = dx / d;
    insp.hy = dy / d;
    insp.facing = dx - dy >= 0 ? 'right' : 'left';
  };

  const replan = (insp) => {
    const t = { x: Math.floor(insp.x), y: Math.floor(insp.y) };
    const g = insp.waypoints[insp.wp];
    insp.route = path.findPath(t.x, t.y, g.x, g.y) ?? [];
    insp.version = grid.version;
  };

  const walk = (insp, dt) => {
    if (insp.version !== grid.version) replan(insp);
    let left = insp.speed * dt;
    while (left > 1e-9 && insp.route.length) {
      const tx = insp.route[0].x + 0.5;
      const ty = insp.route[0].y + 0.5;
      const dx = tx - insp.x;
      const dy = ty - insp.y;
      const dist = Math.hypot(dx, dy);
      setHeading(insp, dx, dy);
      if (dist <= left) {
        insp.x = tx;
        insp.y = ty;
        insp.route.shift();
        left -= dist;
      } else {
        insp.x += (dx / dist) * left;
        insp.y += (dy / dist) * left;
        left = 0;
      }
    }
    const g = insp.waypoints[insp.wp];
    const t = { x: Math.floor(insp.x), y: Math.floor(insp.y) };
    if (!insp.route.length && t.x === g.x && t.y === g.y) {
      insp.state = 'wait';
      insp.timer = WAIT_TIME;
      insp.wp = (insp.wp + 1) % insp.waypoints.length;
      insp.version = -1;
    }
  };

  const watch = (insp, dt) => {
    const seen = crew.filter((c) => isWorking(c) && canSee(grid, insp, c.x, c.y));
    if (seen.length && insp.immune <= 0) {
      insp.meter = Math.min(100, insp.meter + Math.min(RISE_MAX, RISE * seen.length) * dt);
    } else {
      insp.meter = Math.max(0, insp.meter - DECAY * dt);
    }
    if (insp.meter > ALERT_AT && !insp.alerted) {
      insp.alerted = true;
      emit('alert', { inspectorId: insp.id });
    } else if (insp.meter <= ALERT_AT) {
      insp.alerted = false;
    }
    if (insp.meter < 100 - 1e-9) return;
    const c = seen[0] ?? null;
    if (c) setHeading(insp, c.x - insp.x, c.y - insp.y);
    let amount = fineAmount(insp.fines++);
    if (world.auto) amount = Math.max(0, Math.min(Math.round(amount * AUTO_FINE_MULT), Math.round(world.cash()), Math.round(AUTO_FINE_CAP * job.delivered - job.fines)));
    job.fines += amount;
    insp.meter = 0;
    insp.alerted = false;
    insp.state = 'fine';
    insp.timer = FINE_TIME;
    insp.offender = c?.id ?? null;
    emit('fine', { inspectorId: insp.id, amount, total: job.fines });
  };

  const update = (insp, dt) => {
    insp.immune = Math.max(0, insp.immune - dt);
    if (insp.state === 'stalled' || insp.state === 'fine') {
      if (insp.state === 'stalled') insp.meter = 0;
      insp.timer -= dt;
      if (insp.timer > 1e-9) return;
      insp.immune = insp.state === 'fine' ? FINE_IMMUNITY : STALL_IMMUNITY;
      insp.state = 'patrol';
      insp.version = -1;
      return;
    }
    if (insp.state === 'wait') {
      insp.timer -= dt;
      if (insp.timer <= 1e-9) insp.state = 'patrol';
    } else {
      walk(insp, dt);
    }
    watch(insp, dt);
  };

  return {
    /** Freeze an inspector for `seconds` (meter zeroed, no fines). @returns {boolean} */
    stall(id, seconds) {
      const insp = byId.get(id);
      if (!insp || !(seconds > 0) || job.state === 'ended') return false;
      insp.timer = insp.state === 'stalled' ? Math.max(insp.timer, seconds) : seconds;
      insp.state = 'stalled';
      insp.meter = 0;
      insp.alerted = false;
      return true;
    },
    update(dt) {
      if (job.state === 'ended') return;
      for (const insp of list) update(insp, dt);
    },
    list: () => list.map((i) => ({
      id: i.id, x: i.x, y: i.y, facing: i.facing, state: i.state, meter: i.meter,
      hx: i.hx, hy: i.hy, range: VISION_RANGE, halfAngle: VISION_HALF_ANGLE,
    })),
  };
}
