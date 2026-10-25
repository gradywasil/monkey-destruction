export const CRANE_COOLDOWN = 60;
export const LIFT_TIME = 1.2;
export const MIN_WEIGHT = 3;
const SPEED = { inbound: 7, outbound: 6, exit: 8 };
const Z = { inbound: 4, lift: 3, outbound: 3, exit: 4 };
const HANG = 0.6;
const OFF = 14;

/**
 * Crane helicopter: airlifts one heavy placed item straight to the truck, ignoring walls.
 * @param {object} world
 * @param {(type:string, payload:object) => void} emit
 * @param {{drop:{x:number,y:number}|null}} h
 */
export function createCraneSystem(world, emit, h) {
  const { items, job, modifiers } = world;
  let heli = null;
  let cooldown = 0;

  const fly = (dt) => {
    const sp = SPEED[heli.state] * dt;
    const dx = heli.tx - heli.x;
    const dy = heli.ty - heli.y;
    const d = Math.hypot(dx, dy);
    if (d <= sp + 1e-9) {
      heli.x = heli.tx;
      heli.y = heli.ty;
      return true;
    }
    heli.x += (dx / d) * sp;
    heli.y += (dy / d) * sp;
    return false;
  };

  /** @param {string} itemId */
  function start(itemId) {
    if (!modifiers.crane) return { ok: false, reason: 'locked' };
    if (job.state === 'ended') return { ok: false, reason: 'ended' };
    const it = items.get(itemId);
    if (!it) return { ok: false, reason: 'unknown-item' };
    if (heli) return { ok: false, reason: 'busy' };
    if (cooldown > 0) return { ok: false, reason: 'cooldown' };
    if (it.state !== 'placed') return { ok: false, reason: 'not-placed' };
    if (it.weight < MIN_WEIGHT) return { ok: false, reason: 'too-light' };
    if (!h.drop || !items.claim(it.id, ['crane'], 1)) return { ok: false, reason: 'not-placed' };
    const tx = it.x + it.w / 2;
    const ty = it.y + it.d / 2;
    heli = { it, state: 'inbound', x: tx - OFF, y: ty - OFF, z: Z.inbound, tx, ty, t: 0 };
    emit('crane', { itemId: it.id });
    return { ok: true };
  }

  function update(dt) {
    if (cooldown > 0) cooldown = Math.max(0, cooldown - dt);
    if (!heli) return;
    const s = heli.state;
    if (s === 'inbound') {
      heli.z = Z.inbound + (Z.lift - Z.inbound) * Math.min(1, 1 - Math.hypot(heli.tx - heli.x, heli.ty - heli.y) / (OFF * Math.SQRT2));
      if (!fly(dt)) return;
      heli.state = 'lift';
      heli.z = Z.lift;
      heli.t = 0;
      return;
    }
    if (s === 'lift') {
      heli.t += dt;
      if (heli.t < LIFT_TIME - 1e-9) return;
      items.pickUp(heli.it.id);
      emit('craneLift', { itemId: heli.it.id });
      heli.state = 'outbound';
      heli.tx = h.drop.x + 0.5;
      heli.ty = h.drop.y + 0.5;
      return;
    }
    if (s === 'outbound') {
      if (!fly(dt)) return;
      const base = items.deliver(heli.it.id);
      const value = world.credit(base);
      emit('deliver', { item: heli.it, value, base, crewIds: [] });
      cooldown = CRANE_COOLDOWN;
      heli.state = 'exit';
      heli.z = Z.exit;
      heli.tx = h.drop.x + OFF;
      heli.ty = h.drop.y + OFF;
      return;
    }
    if (fly(dt)) heli = null;
  }

  const hangZ = () => (heli.state === 'lift' ? Z.lift - HANG * Math.min(1, heli.t / LIFT_TIME) : Z.outbound - HANG);

  return {
    start, update,
    has: (itemId) => !!heli && heli.state !== 'exit' && heli.it.id === itemId,
    snapshot: () => ({
      unlocked: !!modifiers.crane,
      state: heli ? heli.state : 'idle',
      x: heli ? heli.x : null,
      y: heli ? heli.y : null,
      z: heli ? heli.z : 0,
      itemId: heli && heli.state !== 'exit' ? heli.it.id : null,
      progress: heli?.state === 'lift' ? Math.min(1, heli.t / LIFT_TIME) : heli && heli.state !== 'inbound' ? 1 : 0,
      cooldown,
    }),
    carried: () => (heli && heli.state === 'outbound'
      ? [{ id: heli.it.id, kind: heli.it.kind, weight: heli.it.weight, x: heli.x, y: heli.y, z: hangZ() }]
      : []),
  };
}
