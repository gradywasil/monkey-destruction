export const WALK_SPEED = 2.4;
export const LIFT_TIME = 0.4;

/** @returns {number} tiles/s for a carrier of an item of this weight (0 = empty-handed). */
export function crewSpeed(weight = 0, n = weight, need = weight) {
  if (!weight) return WALK_SPEED;
  const base = weight === 1 ? 2.0 : 1.6;
  return base * Math.min(1.5, 1 + 0.12 * Math.max(0, n - need));
}

/**
 * New crew member standing in the centre of a tile.
 * @param {string} id
 * @param {string} role
 * @param {number} tileX
 * @param {number} tileY
 */
export function createCrew(id, role, tileX, tileY) {
  return {
    id, role,
    x: tileX + 0.5, y: tileY + 0.5,
    facing: 'right',
    state: 'idle',
    itemId: null,
    target: null,
    path: [],
  };
}

/** @returns {{x:number,y:number}} tile under the crew's feet. */
export function crewTile(c) {
  return { x: Math.floor(c.x), y: Math.floor(c.y) };
}

/** Face along a screen-space motion (dx,dy in tile units). */
export function faceToward(c, dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 1e-9) return;
  c.facing = dx - dy >= 0 ? 'right' : 'left';
}

/**
 * Walk along c.path (tile centres) for dt seconds.
 * @returns {boolean} true when the path is exhausted.
 */
export function stepCrew(c, dt, speed) {
  let left = speed * dt;
  while (left > 1e-9 && c.path.length) {
    const tx = c.path[0].x + 0.5;
    const ty = c.path[0].y + 0.5;
    const dx = tx - c.x;
    const dy = ty - c.y;
    const dist = Math.hypot(dx, dy);
    faceToward(c, dx, dy);
    if (dist <= left) {
      c.x = tx;
      c.y = ty;
      c.path.shift();
      left -= dist;
    } else {
      c.x += (dx / dist) * left;
      c.y += (dy / dist) * left;
      left = 0;
    }
  }
  return c.path.length === 0;
}

/** Reset a crew member to idle. */
export function idleCrew(c) {
  c.state = 'idle';
  c.itemId = null;
  c.target = null;
  c.path = [];
}

/** @returns {boolean} true if this role may be assigned to haul items. */
export function canHaul(role) {
  return role === 'hauler' || role === 'plain';
}
