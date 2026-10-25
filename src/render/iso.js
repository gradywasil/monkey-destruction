import { LODS } from './lod.js';

/** Draw layers within an equal depth key. */
export const LAYER = { FLOOR: 0, BACK_WALL: 1, PROP: 2, CHARACTER: 3, FRONT_WALL: 4, EFFECT: 5 };

function lodOf(lod) {
  const l = LODS[lod];
  if (!l) throw new Error(`Unknown LOD: ${lod}`);
  return l;
}

/**
 * Project grid coords (gz in height units) to screen space relative to the grid origin.
 * @param {number} gx
 * @param {number} gy
 * @param {number} [gz]
 * @param {'lo'|'hi'} lod
 * @returns {{x:number,y:number}}
 */
export function gridToScreen(gx, gy, gz = 0, lod) {
  const l = lodOf(lod);
  return {
    x: (gx - gy) * l.tileW / 2,
    y: (gx + gy) * l.tileH / 2 - gz * l.heightPx
  };
}

/**
 * Inverse of gridToScreen on the plane z = gz. Returns fractional grid coords.
 * @param {number} sx
 * @param {number} sy
 * @param {'lo'|'hi'} lod
 * @param {number} [gz]
 * @returns {{x:number,y:number}}
 */
export function screenToGrid(sx, sy, lod, gz = 0) {
  const l = lodOf(lod);
  const a = sx / (l.tileW / 2);
  const b = (sy + gz * l.heightPx) / (l.tileH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/**
 * Integer tile containing a screen point on the plane z = gz.
 * @param {number} sx
 * @param {number} sy
 * @param {'lo'|'hi'} lod
 * @param {number} [gz]
 * @returns {{x:number,y:number}}
 */
export function tileAt(sx, sy, lod, gz = 0) {
  const g = screenToGrid(sx, sy, lod, gz);
  return { x: Math.floor(g.x), y: Math.floor(g.y) };
}

/**
 * Screen points [top, right, bottom, left] of tile (gx, gy) at z = 0.
 * @param {number} gx
 * @param {number} gy
 * @param {'lo'|'hi'} lod
 * @returns {{x:number,y:number}[]}
 */
export function tileDiamond(gx, gy, lod) {
  return [
    gridToScreen(gx, gy, 0, lod),
    gridToScreen(gx + 1, gy, 0, lod),
    gridToScreen(gx + 1, gy + 1, 0, lod),
    gridToScreen(gx, gy + 1, 0, lod)
  ];
}

/**
 * Sort key for a drawable {gx, gy, w, d, layer}: larger draws later.
 * @param {{gx:number,gy:number,w?:number,d?:number,layer?:number}} d
 * @returns {number}
 */
export function depthKey(d) {
  return (d.gx + (d.w || 0)) + (d.gy + (d.d || 0));
}

/**
 * Sort drawables back-to-front in place (key, layer, gx, gy, original order).
 * @param {object[]} list
 * @returns {object[]}
 */
export function sortDrawables(list) {
  const idx = new Map();
  list.forEach((d, i) => idx.set(d, i));
  return list.sort((a, b) =>
    depthKey(a) - depthKey(b) ||
    (a.layer || 0) - (b.layer || 0) ||
    a.gx - b.gx ||
    a.gy - b.gy ||
    idx.get(a) - idx.get(b));
}

/**
 * Screen-space bounding box of a width x height grid including wall height above.
 * @param {number} width
 * @param {number} height
 * @param {'lo'|'hi'} lod
 * @param {number} [maxHeightUnits]
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}}
 */
export function worldBounds(width, height, lod, maxHeightUnits = 2) {
  const l = lodOf(lod);
  return {
    minX: -height * l.tileW / 2,
    minY: -maxHeightUnits * l.heightPx,
    maxX: width * l.tileW / 2,
    maxY: (width + height) * l.tileH / 2
  };
}
