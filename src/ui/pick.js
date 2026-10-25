import { isFrontWall } from '../render/world-renderer.js';

const EDGE_HEIGHTS = [0.2, 0.6, 1.0, 1.4];
const EDGE_REACH = 0.45;
const ITEM_HEIGHTS = [0, 0.4, 0.8, 1.2];
const CREW_RADIUS = { lo: 14, hi: 22 };
const HEAD_Z = 0.5;
const INSPECTOR_RADIUS = { lo: 18, hi: 28 };
const TOP_ITEM_REACH = 0.9;
const TOP_UNIT_REACH = 0.8;

const isTop = (camera) => camera.getProjection?.() === 'top';

/** Distance from a point to an axis-aligned rect (0 inside). */
const rectDist = (px, py, x, y, w, h) => Math.hypot(Math.max(x - px, 0, px - (x + w)), Math.max(y - py, 0, py - (y + h)));

function nearestUnit(list, camera, sx, sy) {
  const g = camera.screenToGrid(sx, sy, 0);
  let best = null;
  let bd = TOP_UNIT_REACH;
  for (const u of list) {
    const d = Math.hypot(u.x - g.x, u.y - g.y);
    if (d <= bd) {
      best = u;
      bd = d;
    }
  }
  return best;
}

/**
 * Placed item under a screen point, preferring the one nearest the viewer.
 * @param {{itemAt:(x:number,y:number)=>object|null}} world
 * @param {{screenToGrid:(x:number,y:number,z:number)=>{x:number,y:number}}} camera
 * @param {number} sx
 * @param {number} sy
 * @returns {object|null}
 */
export function pickItem(world, camera, sx, sy) {
  if (isTop(camera)) {
    const g = camera.screenToGrid(sx, sy, 0);
    const hit = world.itemAt(Math.floor(g.x), Math.floor(g.y));
    if (hit) return hit;
    let near = null;
    let bd = TOP_ITEM_REACH;
    for (const it of world.items?.list?.() ?? []) {
      if (it.state !== 'placed' && it.state !== 'claimed') continue;
      const d = rectDist(g.x, g.y, it.x, it.y, it.w, it.d);
      if (d < bd || (d === bd && near && it.w * it.d < near.w * near.d)) {
        near = it;
        bd = d;
      }
    }
    return near;
  }
  let best = null;
  for (const gz of ITEM_HEIGHTS) {
    const g = camera.screenToGrid(sx, sy, gz);
    const it = world.itemAt(Math.floor(g.x), Math.floor(g.y));
    if (it && (!best || it.x + it.y > best.x + best.y)) best = it;
  }
  return best;
}

/**
 * Crew member whose head is within a tap radius of a screen point.
 * @param {{crew:object[]}} world
 * @param {{gridToScreen:(x:number,y:number,z:number)=>{x:number,y:number}, state:{lod:string}}} camera
 * @param {number} sx
 * @param {number} sy
 * @returns {object|null}
 */
export function pickCrew(world, camera, sx, sy) {
  if (isTop(camera)) return nearestUnit(world.crew, camera, sx, sy);
  const r = CREW_RADIUS[camera.state.lod];
  let best = null;
  let bd = r;
  for (const c of world.crew) {
    const p = camera.gridToScreen(c.x, c.y, HEAD_Z);
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d <= bd) {
      best = c;
      bd = d;
    }
  }
  return best;
}

/**
 * Inspector whose body is nearest a screen point within the tap radius.
 * @param {{inspectors?:object[]}} world
 * @param {{gridToScreen:(x:number,y:number,z:number)=>{x:number,y:number}, state:{lod:string}}} camera
 * @param {number} sx
 * @param {number} sy
 * @returns {object|null}
 */
export function pickInspector(world, camera, sx, sy) {
  if (isTop(camera)) return nearestUnit(world.inspectors ?? [], camera, sx, sy);
  let best = null;
  let bd = INSPECTOR_RADIUS[camera.state.lod];
  for (const i of world.inspectors ?? []) {
    const p = camera.gridToScreen(i.x, i.y, HEAD_Z);
    const d = Math.hypot(p.x - sx, p.y - sy);
    if (d <= bd) {
      best = i;
      bd = d;
    }
  }
  return best;
}

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
};

/**
 * Wall, door or window edge under a screen point; skips missing, broken and cut-away front edges.
 * @param {{grid:object}} world
 * @param {{screenToGrid:(x:number,y:number,z:number)=>{x:number,y:number}}} camera
 * @param {number} sx
 * @param {number} sy
 * @param {{types?:string[]}} [opts] limit to these edge types (e.g. ['window'])
 * @returns {{x:number,y:number,side:'N'|'W'}|null}
 */
export function pickEdge(world, camera, sx, sy, { types } = {}) {
  const { grid } = world;
  let best = null;
  let bd = EDGE_REACH;
  const top = isTop(camera);
  for (const gz of top ? [0] : EDGE_HEIGHTS) {
    const g = camera.screenToGrid(sx, sy, gz);
    const tx = Math.floor(g.x);
    const ty = Math.floor(g.y);
    for (let y = ty - 1; y <= ty + 1; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        for (const side of ['N', 'W']) {
          const e = grid.edge(x, y, side);
          if (!e || e.type === 'none' || e.broken || e.hp <= 0 || (types && !types.includes(e.type)) || (!top && isFrontWall(grid, x, y, side))) continue;
          const d = side === 'N' ? segDist(g.x, g.y, x, y, x + 1, y) : segDist(g.x, g.y, x, y, x, y + 1);
          if (d < bd) {
            bd = d;
            best = { x, y, side };
          }
        }
      }
    }
  }
  return best;
}
