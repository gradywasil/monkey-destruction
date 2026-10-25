import { LODS, WALL_HEIGHT } from './lod.js';
import { gridToScreen as isoToScreen, screenToGrid as isoToGrid, worldBounds } from './iso.js';

/** Pixel-perfect zoom stops in lo units: lo x1, hi x1, hi x2. */
export const STOPS = [1, 1.6, 3.2];
export const HI_RATIO = LODS.hi.tileW / LODS.lo.tileW;
const Z_MIN = 1;
const Z_MAX = 3.2;
const TO_HI = 1.3;
const TO_LO = 1.2;
const SNAP_TIME = 0.18;
const BLEND_TIME = 0.15;
const FLING_HALF_LIFE = 0.12;
const FLING_MIN = 5;

/** Orthographic 'top' projection: tile edge and pixels per height unit per LOD (art is swapped, not scaled). */
export const TOP_LODS = { lo: { tile: 32, zPx: 5 }, hi: { tile: 48, zPx: 7 } };

/** Plan view rotated 90deg CCW: truck side (gx=0) at the bottom, gy grows to the right. */
function topToScreen(gx, gy, gz, lod, gridW) {
  const l = TOP_LODS[lod];
  return { x: gy * l.tile, y: (gridW - gx) * l.tile - gz * l.zPx };
}

function topToGrid(sx, sy, lod, gz, gridW) {
  const l = TOP_LODS[lod];
  return { x: gridW - (sy + gz * l.zPx) / l.tile, y: sx / l.tile };
}

const clampZ = (z) => Math.min(Z_MAX, Math.max(Z_MIN, z));
const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * Nearest stop to z by log distance.
 * @param {number} z
 * @returns {number}
 */
export function nearestStop(z) {
  let best = STOPS[0];
  for (const s of STOPS) if (Math.abs(Math.log(z / s)) < Math.abs(Math.log(z / best))) best = s;
  return best;
}

/**
 * Isometric camera with continuous zoom Z (lo units) and a hysteresis lo/hi LOD switch.
 * @param {{viewW:number,viewH:number,gridW:number,gridH:number,marginTiles?:number,
 *   initial?:{cx?:number,cy?:number,z?:number}}} opts
 */
export function createCamera({ viewW, viewH, gridW, gridH, marginTiles = 2, initial = {} }) {
  let cx = initial.cx ?? gridW / 2;
  let cy = initial.cy ?? gridH / 2;
  let z = clampZ(initial.z ?? 1);
  let projection = 'iso';
  let insetTop = 0;
  let insetBottom = 0;
  const midY = () => insetTop + (viewH - insetTop - insetBottom) / 2;
  const bandH = () => Math.max(1, viewH - insetTop - insetBottom);
  let lod = z >= TO_HI ? 'hi' : 'lo';
  let prevLod = lod;
  let blendT = BLEND_TIME;
  let gesturing = false;
  let tween = null;
  let vx = 0;
  let vy = 0;
  const listeners = new Set();

  const isTop = () => projection === 'top';
  const toScr = (gx, gy, gz, l) => (isTop() ? topToScreen(gx, gy, gz, l, gridW) : isoToScreen(gx, gy, gz, l));
  const toGrd = (sx, sy, l, gz) => (isTop() ? topToGrid(sx, sy, l, gz, gridW) : isoToGrid(sx, sy, l, gz));
  const boundsOf = (l) => {
    if (!isTop()) return worldBounds(gridW, gridH, l, WALL_HEIGHT);
    const t = TOP_LODS[l].tile;
    return { minX: 0, minY: 0, maxX: gridH * t, maxY: gridW * t };
  };
  const tileOf = (l) => (isTop() ? TOP_LODS[l].tile : LODS[l].tileW);

  const scaleOf = () => (lod === 'hi' ? z / HI_RATIO : z);

  function setZ(nz) {
    z = clampZ(nz);
    const next = lod === 'lo' ? (z >= TO_HI ? 'hi' : 'lo') : (z < TO_LO ? 'lo' : 'hi');
    if (next !== lod) {
      prevLod = lod;
      lod = next;
      blendT = 0;
      for (const fn of listeners) fn(lod, prevLod);
    }
  }

  function centerScreen() {
    const p = toScr(cx, cy, 0, lod);
    const s = scaleOf();
    return { x: p.x * s, y: p.y * s };
  }

  function setCenterScreen(x, y) {
    const s = scaleOf();
    const g = toGrd(x / s, y / s, lod, 0);
    cx = g.x;
    cy = g.y;
  }

  /** Clamp centre to bounds; returns which axes were clamped. */
  function clamp() {
    const s = scaleOf();
    const b = boundsOf(lod);
    const m = marginTiles * tileOf(lod) * s;
    const c = centerScreen();
    const axis = (v, lo, hi, half) => {
      const a = lo * s - m + half;
      const bb = hi * s + m - half;
      if (a > bb || (isTop() && (hi - lo) * s <= 2 * half)) return (lo + hi) / 2 * s;
      return Math.min(bb, Math.max(a, v));
    };
    const nx = axis(c.x, b.minX, b.maxX, viewW / 2);
    const ny = axis(c.y, b.minY, b.maxY, bandH() / 2);
    const hitX = Math.abs(nx - c.x) > 1e-9;
    const hitY = Math.abs(ny - c.y) > 1e-9;
    if (hitX || hitY) setCenterScreen(nx, ny);
    return { hitX, hitY };
  }

  function rawTransform() {
    const s = scaleOf();
    const c = centerScreen();
    return { s, ox: viewW / 2 - c.x, oy: midY() - c.y };
  }

  function transform() {
    const { s, ox, oy } = rawTransform();
    const snap = Math.abs(s - Math.round(s)) < 0.001 || STOPS.some((st) => Math.abs(z - st) < 0.001);
    return {
      lod,
      projection,
      scale: s,
      originX: snap ? Math.round(ox) : ox,
      originY: snap ? Math.round(oy) : oy,
      prevLod: blendT < BLEND_TIME ? prevLod : lod,
      blend: Math.min(1, blendT / BLEND_TIME)
    };
  }

  function toScreen(gx, gy, gz = 0, t = transform()) {
    const p = toScr(gx, gy, gz, t.lod);
    return { x: t.originX + p.x * t.scale, y: t.originY + p.y * t.scale };
  }

  function toGrid(sx, sy, gz = 0, t = transform()) {
    return toGrd((sx - t.originX) / t.scale, (sy - t.originY) / t.scale, t.lod, gz);
  }

  function rawToGrid(sx, sy) {
    const { s, ox, oy } = rawTransform();
    return toGrd((sx - ox) / s, (sy - oy) / s, lod, 0);
  }

  function zoomTo(nz, px, py) {
    const g = rawToGrid(px, py);
    setZ(nz);
    const p = toScr(g.x, g.y, 0, lod);
    const s = scaleOf();
    setCenterScreen(p.x * s - (px - viewW / 2), p.y * s - (py - midY()));
    clamp();
  }

  return {
    resize(w, h) {
      viewW = w;
      viewH = h;
      clamp();
    },
    /** Logical px reserved by HUD at the top/bottom; the view centre becomes the band centre. */
    setInsets({ top = 0, bottom = 0 } = {}) {
      insetTop = top;
      insetBottom = bottom;
      clamp();
    },
    /** Pick the largest discrete top tile size whose rotated floor fits the view width, and centre the floor. */
    fitPlan() {
      const fitsHi = gridH * TOP_LODS.hi.tile <= viewW;
      tween = null;
      vx = vy = 0;
      cx = gridW / 2;
      cy = gridH / 2;
      setZ(fitsHi ? STOPS[1] : STOPS[0]);
      blendT = BLEND_TIME;
      clamp();
      return lod;
    },
    /** Screen point that focus()/centering targets: the middle of the band between the insets. */
    viewCenter: () => ({ x: viewW / 2, y: midY() }),
    panBy(dx, dy) {
      const c = centerScreen();
      setCenterScreen(c.x - dx, c.y - dy);
      return clamp();
    },
    zoomBy(factor, px = viewW / 2, py = midY()) {
      gesturing = true;
      tween = null;
      vx = vy = 0;
      zoomTo(z * factor, px, py);
    },
    endGesture() {
      gesturing = false;
      const target = nearestStop(z);
      if (Math.abs(z - target) < 0.01) {
        setZ(target);
        clamp();
        return;
      }
      tween = { t: 0, dur: SNAP_TIME, z0: z, z1: target, c0: null };
    },
    fling(fx, fy) {
      tween = null;
      vx = fx;
      vy = fy;
    },
    focus(gx, gy, { stop = null, duration = 0.45 } = {}) {
      vx = vy = 0;
      let z1 = z;
      if (stop != null) z1 = Number.isInteger(stop) && stop < STOPS.length ? STOPS[stop] : clampZ(stop);
      tween = { t: 0, dur: Math.max(1e-6, duration), z0: z, z1, c0: { x: cx, y: cy }, c1: { x: gx, y: gy } };
    },
    /** Swap between the isometric and orthographic top-down projection, keeping the focus point. */
    setProjection(next) {
      if (next !== 'iso' && next !== 'top') throw new Error(`Unknown projection: ${next}`);
      if (next === projection) return;
      projection = next;
      tween = null;
      vx = vy = 0;
      blendT = BLEND_TIME;
      clamp();
    },
    getProjection: () => projection,
    isBusy() {
      return gesturing || !!tween || vx !== 0 || vy !== 0;
    },
    update(dt) {
      if (blendT < BLEND_TIME) blendT = Math.min(BLEND_TIME, blendT + dt);
      if (tween) {
        tween.t = Math.min(tween.dur, tween.t + dt);
        const k = tween.t >= tween.dur ? 1 : easeOut(tween.t / tween.dur);
        setZ(k === 1 ? tween.z1 : tween.z0 * (tween.z1 / tween.z0) ** k);
        if (tween.c0) {
          cx = tween.c0.x + (tween.c1.x - tween.c0.x) * k;
          cy = tween.c0.y + (tween.c1.y - tween.c0.y) * k;
        }
        clamp();
        if (k === 1) tween = null;
      }
      if (vx || vy) {
        const hit = this.panBy(vx * dt, vy * dt);
        const decay = 0.5 ** (dt / FLING_HALF_LIFE);
        vx = hit.hitX ? 0 : vx * decay;
        vy = hit.hitY ? 0 : vy * decay;
        if (Math.hypot(vx, vy) < FLING_MIN) vx = vy = 0;
      }
    },
    transform,
    gridToScreen: (gx, gy, gz = 0) => toScreen(gx, gy, gz),
    screenToGrid: (sx, sy, gz = 0) => toGrid(sx, sy, gz),
    visibleTileRect(padTiles = 1) {
      const t = transform();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [sx, sy] of [[0, 0], [viewW, 0], [0, viewH], [viewW, viewH]]) {
        for (const gz of [0, WALL_HEIGHT]) {
          const g = toGrid(sx, sy, gz, t);
          minX = Math.min(minX, g.x); maxX = Math.max(maxX, g.x);
          minY = Math.min(minY, g.y); maxY = Math.max(maxY, g.y);
        }
      }
      const cl = (v, n) => Math.min(n - 1, Math.max(0, v));
      return {
        minX: cl(Math.floor(minX) - padTiles, gridW),
        minY: cl(Math.floor(minY) - padTiles, gridH),
        maxX: cl(Math.ceil(maxX) + padTiles, gridW),
        maxY: cl(Math.ceil(maxY) + padTiles, gridH)
      };
    },
    get state() {
      return { cx, cy, z, lod, projection, scale: scaleOf(), gesturing };
    },
    onLodChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
