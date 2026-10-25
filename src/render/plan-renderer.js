import { HI_RATIO, TOP_LODS } from './camera.js';
import { OUTLINE } from './lod.js';
import { PROP_VISUALS, FLOOR_COLORS } from '../data/prop-visuals.js';
import { ITEM_DEFS } from '../data/items.js';

const BG = '#262b44';
const ITEM_RING = '#fee761';
const GRID_LINE = 'rgba(24,20,37,0.10)';
const ROOM_TINT = {
  reception: '#0099db', cubicles: '#ffffff', server: '#124e89', manager: '#b55088', ceo: '#e43b44', break: '#63c74d'
};
const WALL_FILL = { drywall: '#ead4aa', brick: '#be4a2f', steel: '#8b9bb4', glass: '#2ce8f5' };
const WALL_SHADE = { drywall: '#c28569', brick: '#733e39', steel: '#5a6988', glass: '#0099db' };
const DOOR_LEAF = { steel: '#8b9bb4' };
const DESIGN_TILE = 24;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Deterministic 0..1 hash of two ints. */
function hash(a, b) {
  let h = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1274126177, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Pixel painter in 24px design units scaled to tile size T, origin (ox, oy) in pixels. */
function painter(ctx, ox, oy, T) {
  const f = T / DESIGN_TILE;
  const ol = Math.max(1, Math.round(f));
  const X = (v) => Math.round(ox + v * f);
  const Y = (v) => Math.round(oy + v * f);
  const api = {
    f, ol, X, Y,
    r(x, y, w, h, c) {
      ctx.fillStyle = c;
      const x0 = X(x);
      const y0 = Y(y);
      ctx.fillRect(x0, y0, Math.max(1, X(x + w) - x0), Math.max(1, Y(y + h) - y0));
    },
    /** Dark-outlined filled box. */
    box(x, y, w, h, c) {
      const x0 = X(x);
      const y0 = Y(y);
      const x1 = X(x + w);
      const y1 = Y(y + h);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = c;
      ctx.fillRect(x0 + ol, y0 + ol, Math.max(1, x1 - x0 - 2 * ol), Math.max(1, y1 - y0 - 2 * ol));
    },
    circle(cx, cy, rad, c, outline = true) {
      const px = X(cx);
      const py = Y(cy);
      const R = Math.max(1, Math.round(rad * f));
      const disc = (rr, col) => {
        ctx.fillStyle = col;
        for (let dy = -rr; dy <= rr; dy++) {
          const hw = Math.round(Math.sqrt(rr * rr - dy * dy + 0.25));
          ctx.fillRect(px - hw, py + dy, hw * 2 + (hw ? 0 : 1), 1);
        }
      };
      if (outline) disc(R, OUTLINE);
      disc(outline ? Math.max(1, R - ol) : R, c);
    }
  };
  return api;
}

/** Top-down procedural icon for a prop kind, drawn into its footprint W x D tiles at pixel (ox, oy). */
function drawPropIcon(ctx, kind, ox, oy, w, d, T) {
  const P = painter(ctx, ox, oy, T);
  const W = w * DESIGN_TILE;
  const D = d * DESIGN_TILE;
  const m = 2;
  switch (kind) {
    case 'desk': {
      P.box(m, m + 1, W - 2 * m, D - 2 * m - 2, '#d77643');
      P.r(m + 2, m + 3, W - 2 * m - 4, 1, '#feae34');
      P.r(m + 3, D - 9, 6, 4, '#ead4aa'); // paper
      P.r(m + 4, D - 8, 4, 1, '#8b9bb4');
      P.r(W - 12, D - 9, 8, 3, '#3a4466'); // keyboard
      P.r(W - 11, D - 8, 6, 1, '#8b9bb4');
      P.r(W / 2 - 1, m + 2, 2, D - 2 * m - 3, '#b86f50');
      break;
    }
    case 'ceo': {
      P.box(m, m + 1, W - 2 * m, D - 2 * m - 2, '#be4a2f');
      P.r(m + 2, m + 3, W - 2 * m - 4, D - 2 * m - 6, '#a22633');
      P.box(W / 2 - 14, D / 2 - 6, 28, 14, '#3e2731'); // blotter
      P.r(W / 2 - 12, D / 2 - 4, 24, 10, '#733e39');
      P.box(W - 14, 8, 8, 8, '#2ce8f5'); // monitor
      P.r(W - 12, 10, 4, 3, '#ffffff');
      P.circle(10, 10, 4, '#fee761'); // desk lamp
      P.r(W / 2 - 6, D - 11, 12, 1, '#feae34');
      break;
    }
    case 'cab': {
      P.box(m + 1, m + 1, 20, 20, '#8b9bb4');
      P.r(m + 3, m + 3, 16, 2, '#c0cbdc');
      for (const yy of [m + 8, m + 13, m + 18]) {
        P.r(m + 3, yy, 16, 1, '#5a6988');
        P.r(m + 9, yy - 2, 4, 1, '#262b44');
      }
      break;
    }
    case 'chair': {
      P.circle(12, 13, 8, '#68386c');
      P.circle(12, 13, 5, '#b55088', false);
      P.r(5, 4, 14, 4, '#3e2731'); // backrest
      P.r(6, 5, 12, 2, '#68386c');
      P.r(3, 12, 2, 4, '#3e2731');
      P.r(19, 12, 2, 4, '#3e2731');
      break;
    }
    case 'monitor': {
      P.box(4, 5, 16, 11, '#3a4466');
      P.r(6, 7, 12, 7, '#2ce8f5');
      P.r(7, 8, 4, 1, '#ffffff');
      P.r(9, 16, 6, 3, '#262b44');
      P.r(7, 19, 10, 2, '#181425');
      break;
    }
    case 'rack': {
      P.box(m + 1, m, 20, 20, '#262b44');
      for (let k = 0; k < 4; k++) {
        const yy = m + 3 + k * 4;
        P.r(m + 3, yy, 12, 2, '#3a4466');
        P.r(m + 16, yy, 2, 2, k % 2 ? '#63c74d' : '#e43b44');
        P.r(m + 19, yy, 1, 2, '#feae34');
      }
      break;
    }
    case 'vend': {
      P.box(m + 1, m, 20, 20, '#e43b44');
      P.r(m + 3, m + 2, 10, 14, '#181425');
      P.r(m + 4, m + 3, 8, 12, '#2ce8f5');
      P.r(m + 5, m + 4, 3, 10, '#ffffff');
      P.r(m + 15, m + 3, 4, 3, '#fee761');
      P.r(m + 15, m + 8, 4, 2, '#ead4aa');
      P.r(m + 4, m + 17, 14, 2, '#a22633');
      break;
    }
    case 'safe': {
      P.box(m, m, 20, 20, '#5a6988');
      P.r(m + 2, m + 2, 16, 2, '#8b9bb4');
      P.circle(12, 12, 6, '#3a4466');
      P.circle(12, 12, 3, '#fee761');
      P.r(11, 6, 2, 3, '#181425');
      P.r(m + 15, 11, 3, 4, '#c0cbdc');
      break;
    }
    case 'statue': {
      P.box(m, m, 20, 20, '#b86f50');
      P.circle(12, 13, 7, '#feae34');
      P.circle(12, 12, 4, '#fee761', false);
      P.circle(12, 10, 2, '#ead4aa', false);
      P.r(11, 17, 2, 2, '#733e39');
      break;
    }
    case 'plant': {
      P.circle(12, 12, 10, '#265c42');
      P.circle(8, 9, 4, '#3e8948', false);
      P.circle(16, 9, 4, '#63c74d', false);
      P.circle(12, 16, 4, '#3e8948', false);
      P.circle(12, 12, 3, '#b86f50');
      P.r(4, 6, 2, 2, '#63c74d');
      break;
    }
    case 'copier': {
      P.box(m, m + 2, 20, 18, '#c0cbdc');
      P.r(m + 2, m + 4, 16, 8, '#8b9bb4');
      P.r(m + 3, m + 5, 14, 6, '#ead4aa');
      P.r(m + 2, m + 14, 6, 3, '#3a4466');
      P.r(m + 11, m + 14, 2, 2, '#63c74d');
      P.r(m + 14, m + 14, 2, 2, '#e43b44');
      break;
    }
    default: {
      P.box(m, m, W - 2 * m, D - 2 * m, '#8b9bb4');
    }
  }
}

/** Bright 1px item ring around a footprint (inset by one pixel). */
function itemRing(ctx, x, y, w, h, T) {
  const t = T >= 40 ? 2 : 1;
  ctx.fillStyle = ITEM_RING;
  ctx.fillRect(x + 1, y + 1, w - 2, t);
  ctx.fillRect(x + 1, y + h - 1 - t, w - 2, t);
  ctx.fillRect(x + 1, y + 1, t, h - 2);
  ctx.fillRect(x + w - 1 - t, y + 1, t, h - 2);
}

function drawFloorTile(ctx, t, x, y, T) {
  const px = x * T;
  const py = y * T;
  const base = FLOOR_COLORS[t.floor] ?? '#8b9bb4';
  ctx.fillStyle = base;
  ctx.fillRect(px, py, T, T);
  if (t.floor === 'tile') {
    if ((x + y) % 2) {
      ctx.fillStyle = '#e4a672';
      ctx.fillRect(px, py, T, T);
    }
  } else if (t.floor === 'carpetA' || t.floor === 'carpetB' || t.floor === 'carpetC') {
    ctx.fillStyle = t.floor === 'carpetA' ? '#8b9bb4' : t.floor === 'carpetB' ? '#3a4466' : '#68386c';
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(px + Math.floor(hash(x * 7 + k, y) * (T - 2)), py + Math.floor(hash(x, y * 5 + k + 9) * (T - 2)), 1, 1);
    }
  } else if (t.floor === 'asphalt') {
    ctx.fillStyle = '#262b44';
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(px + Math.floor(hash(x * 3 + k, y + 4) * (T - 2)), py + Math.floor(hash(x + 2, y * 3 + k) * (T - 2)), 2, 1);
    }
  } else if (t.floor === 'grass') {
    ctx.fillStyle = '#3e8948';
    for (let k = 0; k < 3; k++) {
      const gx = px + 2 + Math.floor(hash(x * 3 + k, y + 1) * (T - 6));
      const gy = py + 3 + Math.floor(hash(x + 6, y * 3 + k) * (T - 7));
      ctx.fillRect(gx, gy, 1, 2);
      ctx.fillRect(gx + 2, gy + 1, 1, 2);
    }
  }
  const tint = ROOM_TINT[t.room];
  if (tint) {
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = tint;
    ctx.fillRect(px, py, T, T);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = GRID_LINE;
  ctx.fillRect(px + T - 1, py, 1, T);
  ctx.fillRect(px, py + T - 1, T, 1);
}

const isDead = (e) => e.broken || e.hp <= 0;

/** Segment geometry for an edge: bar rectangle (x,y,w,h in px) plus the along-axis direction. */
function edgeBar(x, y, side, T, th, ext = true) {
  const e = ext ? Math.floor(th / 2) : 0;
  const half = Math.floor(th / 2);
  return side === 'N'
    ? { x: x * T - e, y: y * T - half, w: T + 2 * e + (ext ? (th % 2) : 0), h: th }
    : { x: x * T - half, y: y * T - e, w: th, h: T + 2 * e + (ext ? (th % 2) : 0) };
}

function crack(ctx, bar, side, seed, T) {
  ctx.fillStyle = OUTLINE;
  const n = 3;
  for (let k = 0; k < n; k++) {
    const along = Math.floor(hash(seed, k) * (T - 6)) + 3;
    for (let s = 0; s < bar.h + bar.w - Math.min(bar.w, bar.h) - 2 && s < 6; s++) {
      const a = side === 'N' ? along + s : Math.floor(bar.w / 2);
      const b = side === 'N' ? Math.floor(bar.h / 2) : along + s;
      const jitter = (s % 2) - (side === 'N' ? 0 : 0);
      const px = bar.x + (side === 'N' ? a : a + jitter);
      const py = bar.y + (side === 'N' ? b + jitter : b);
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

function drawEdges(ctx, grid, T) {
  const th = Math.max(4, Math.round(T * 0.2));
  const list = [];
  for (const [k, e] of grid.edges) {
    const [xs, ys, side] = k.split(',');
    list.push({ e, x: +xs, y: +ys, side });
  }
  // pass 1: dark outlines + door posts + rubble for broken edges
  ctx.fillStyle = OUTLINE;
  for (const { e, x, y, side } of list) {
    if (e.type === 'none') continue;
    if (e.type === 'door' || isDead(e)) {
      if (e.type !== 'door') continue;
      const b = edgeBar(x, y, side, T, th, false);
      const p = side === 'N' ? [[b.x - 1, b.y, th, th], [b.x + T - th + 1, b.y, th, th]] : [[b.x, b.y - 1, th, th], [b.x, b.y + T - th + 1, th, th]];
      for (const q of p) ctx.fillRect(...q);
      continue;
    }
    const b = edgeBar(x, y, side, T, th);
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  // pass 2: fills, details
  for (const { e, x, y, side } of list) {
    if (e.type === 'none') continue;
    const seed = x * 31 + y * 17 + (side === 'N' ? 1 : 2);
    const horiz = side === 'N';
    const bar = edgeBar(x, y, side, T, th);
    const mat = e.material;
    if (e.type === 'door') {
      const gap = edgeBar(x, y, side, T, th, false);
      const posts = horiz ? [[gap.x - 1, gap.y], [gap.x + T - th + 1, gap.y]] : [[gap.x, gap.y - 1], [gap.x, gap.y + T - th + 1]];
      for (const [qx, qy] of posts) {
        ctx.fillStyle = '#8b9bb4';
        ctx.fillRect(qx + 1, qy + 1, th - 2, th - 2);
      }
      const leaf = DOOR_LEAF[mat] ?? '#b86f50';
      if (isDead(e)) {
        ctx.fillStyle = '#733e39';
        for (let k = 0; k < 4; k++) {
          const a = 3 + Math.floor(hash(seed, k) * (T - 9));
          const o = Math.floor(hash(seed + 5, k) * (th - 2));
          if (horiz) ctx.fillRect(gap.x + a, gap.y + o, 3, 2);
          else ctx.fillRect(gap.x + o, gap.y + a, 2, 3);
        }
        continue;
      }
      if (e.locked) {
        const lx = gap.x + (horiz ? 1 : 0);
        const ly = gap.y + (horiz ? 0 : 1);
        const lw = horiz ? T - 2 : th;
        const lh = horiz ? th : T - 2;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(lx, ly, lw, lh);
        ctx.fillStyle = leaf;
        ctx.fillRect(lx + 1, ly + 1, lw - 2, lh - 2);
        const cx = gap.x + (horiz ? Math.floor(T / 2) : Math.floor(th / 2));
        const cy = gap.y + (horiz ? Math.floor(th / 2) : Math.floor(T / 2));
        const s = T >= 40 ? 4 : 3;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(cx - s, cy - s + 1, s * 2 + 1, s * 2);
        ctx.fillRect(cx - s + 1, cy - s - 1, 1, 2);
        ctx.fillRect(cx + s - 1, cy - s - 1, 1, 2);
        ctx.fillRect(cx - s + 1, cy - s - 2, s * 2 - 1, 1);
        ctx.fillStyle = '#e43b44';
        ctx.fillRect(cx - s + 1, cy - s + 2, s * 2 - 1, s * 2 - 2);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(cx, cy, 1, 2);
      } else {
        // open leaf swung 90 degrees from the hinge end
        const L = Math.round(T * 0.8);
        const lt = Math.max(2, th - 2);
        const hx = horiz ? gap.x : gap.x + 1;
        const hy = horiz ? gap.y + 1 : gap.y;
        const rx = horiz ? hx : hx;
        const ry = horiz ? hy : hy;
        const lw = horiz ? lt : L;
        const lh = horiz ? L : lt;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(rx - 1, ry - 1, lw + 2, lh + 2);
        ctx.fillStyle = leaf;
        ctx.fillRect(rx, ry, lw, lh);
        ctx.fillStyle = '#feae34';
        ctx.fillRect(rx + (horiz ? 0 : L - 2), ry + (horiz ? L - 2 : 0), 2, 2);
      }
      continue;
    }
    if (isDead(e)) {
      ctx.fillStyle = WALL_FILL[mat] ?? '#c0cbdc';
      for (let k = 0; k < 5; k++) {
        const a = 2 + Math.floor(hash(seed, k) * (T - 6));
        const o = Math.floor(hash(seed + 3, k) * (th + 2)) - 1;
        if (horiz) ctx.fillRect(x * T + a, y * T - Math.floor(th / 2) + o, 2, 2);
        else ctx.fillRect(x * T - Math.floor(th / 2) + o, y * T + a, 2, 2);
      }
      continue;
    }
    const inset = 1;
    const fx = bar.x + inset;
    const fy = bar.y + inset;
    const fw = bar.w - 2 * inset;
    const fh = bar.h - 2 * inset;
    ctx.fillStyle = WALL_FILL[mat] ?? '#ead4aa';
    ctx.fillRect(fx, fy, fw, fh);
    const shade = WALL_SHADE[mat] ?? '#c28569';
    ctx.fillStyle = shade;
    if (horiz) ctx.fillRect(fx, fy + Math.ceil(fh / 2), fw, Math.floor(fh / 2));
    else ctx.fillRect(fx + Math.ceil(fw / 2), fy, Math.floor(fw / 2), fh);
    if (mat === 'brick') {
      ctx.fillStyle = '#3e2731';
      const step = T >= 40 ? 6 : 4;
      for (let a = (x + y) % 2 ? 2 : 0; a < T + th; a += step) {
        if (horiz) ctx.fillRect(fx + a, fy, 1, fh);
        else ctx.fillRect(fx, fy + a, fw, 1);
      }
    } else if (mat === 'steel') {
      ctx.fillStyle = '#c0cbdc';
      for (let a = 3; a < T; a += 6) {
        if (horiz) ctx.fillRect(fx + a, fy, 1, 1);
        else ctx.fillRect(fx, fy + a, 1, 1);
      }
    }
    if (e.type === 'window') {
      ctx.fillStyle = '#2ce8f5';
      if (horiz) ctx.fillRect(fx + 2, fy, fw - 4, fh);
      else ctx.fillRect(fx, fy + 2, fw, fh - 4);
      ctx.fillStyle = '#ffffff';
      if (horiz) {
        ctx.fillRect(fx + 3, fy, Math.floor(T * 0.3), 1);
        ctx.fillRect(fx + Math.floor(T * 0.6), fy, 2, 1);
      } else {
        ctx.fillRect(fx, fy + 3, 1, Math.floor(T * 0.3));
        ctx.fillRect(fx, fy + Math.floor(T * 0.6), 1, 2);
      }
      if (e.rigged) {
        const mx = x * T + (horiz ? Math.floor(T / 2) : 0);
        const my = y * T + (horiz ? 0 : Math.floor(T / 2));
        const s = T >= 40 ? 4 : 3;
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(mx - s - 1, my - s - 1, s * 2 + 2, s * 2 + 2);
        ctx.fillStyle = '#feae34';
        ctx.fillRect(mx - s, my - s, s * 2, s * 2);
        ctx.fillStyle = OUTLINE;
        ctx.fillRect(mx - 1, my - s + 1, 2, s * 2 - 2);
      }
    }
    if (e.hp < e.maxHp * 0.5) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(fx, fy, fw, fh);
      ctx.globalAlpha = 1;
      crack(ctx, bar, side, seed, T);
    } else if (e.hp < e.maxHp) {
      crack(ctx, { ...bar }, side, seed, T);
    }
  }
}

function drawTruck(ctx, truck, T) {
  const P = painter(ctx, truck.x * T, truck.y * T, T);
  const W = truck.w * DESIGN_TILE;
  const D = truck.d * DESIGN_TILE;
  // wheels poke out above and below the frame
  for (const wx of [8, 22, W - 22, W - 12]) {
    P.box(wx, 1, 8, 4, '#181425');
    P.box(wx, D - 5, 8, 4, '#181425');
  }
  P.box(2, 4, W - 4, D - 8, '#3a4466'); // chassis
  const cabW = 24;
  P.box(2, 5, cabW, D - 10, '#124e89'); // cab
  P.r(4, 7, cabW - 8, D - 14, '#0099db');
  P.r(cabW - 7, 8, 5, D - 16, '#2ce8f5'); // windscreen
  P.r(cabW - 7, 8, 5, 2, '#ffffff');
  P.r(5, 9, 6, D - 18, '#124e89'); // roof
  P.box(cabW + 3, 6, W - cabW - 7, D - 12, '#733e39'); // flatbed
  for (let x = cabW + 7; x < W - 6; x += 6) P.r(x, 8, 1, D - 16, '#3e2731');
  P.r(cabW + 5, 8, W - cabW - 11, 2, '#b86f50');
  P.r(cabW + 5, D - 10, W - cabW - 11, 2, '#b86f50');
  P.r(W - 5, 10, 2, D - 20, '#feae34'); // tail light bar
}

const ASPECT = (p) => p.w * p.d;

/**
 * Orthographic top-down renderer with the same draw() contract as the isometric one.
 * @param {{grid:object, crewAtlas:object}} deps
 */
export function createPlanRenderer({ grid, crewAtlas }) {
  const layers = { lo: null, hi: null };
  let layerKey = null;

  function build(lod) {
    const T = TOP_LODS[lod].tile;
    const canvas = makeCanvas(grid.width * T, grid.height * T);
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const t = grid.tile(x, y);
        if (t.floor !== 'void') drawFloorTile(c, t, x, y, T);
      }
    }
    if (grid.truck) drawTruck(c, grid.truck, T);
    const props = [...grid.props].sort((a, b) => (a.kind === 'monitor') - (b.kind === 'monitor') || ASPECT(b) - ASPECT(a));
    for (const p of props) {
      const px = p.x * T;
      const py = p.y * T;
      drawPropIcon(c, p.kind, px, py, p.w, p.d, T);
      if (ITEM_DEFS[p.kind]) itemRing(c, px, py, p.w * T, p.d * T, T);
    }
    drawEdges(c, grid, T);
    return canvas;
  }

  function layerFor(lod) {
    const key = `${grid.version}:${grid.stamp ?? 0}:${grid.props.length}`;
    if (key !== layerKey) {
      layerKey = key;
      layers.lo = layers.hi = null;
    }
    return layers[lod] ?? (layers[lod] = build(lod));
  }

  function drawScene(ctx, list, lod, scale, originX, originY) {
    const T = TOP_LODS[lod].tile;
    const zPx = TOP_LODS[lod].zPx;
    const gw = grid.width;
    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);
    const L = layerFor(lod);
    // floor layer is built unrotated and blitted rotated 90deg CCW: (px,py) -> (py, W - px)
    ctx.save();
    ctx.translate(0, L.width);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(L, 0, 0);
    ctx.restore();
    const spr = lod;
    const lift = Math.round(T * 0.42);
    for (const d of list) {
      const px = Math.round(d.gy * T);
      const ground = Math.round((gw - d.gx) * T);
      if (d.crew) {
        const feet = ground + lift;
        if (d.ring) {
          ctx.fillStyle = '#fee761';
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            ctx.fillRect(Math.round(px + Math.cos(a) * T * 0.55 - 0.5), Math.round(feet - T * 0.1 + Math.sin(a) * T * 0.3 - 0.5), 1, 1);
          }
        }
        ctx.fillStyle = 'rgba(24,20,37,0.34)';
        const sw = Math.round(T * 0.5);
        const sx0 = px - Math.floor(sw / 2);
        ctx.fillRect(sx0, feet - 1, sw, 2);
        ctx.fillRect(sx0 + 2, feet - 2, sw - 4, 1);
        ctx.fillRect(sx0 + 2, feet + 1, sw - 4, 1);
        const s = crewAtlas.get(d.crew.variant, d.crew.pose, spr, d.crew.facing ?? 'right');
        if (s) ctx.drawImage(s.canvas, s.sx, s.sy, s.w, s.h, px - s.ax, feet - s.ay, s.w, s.h);
      } else if (d.prop) {
        const v = PROP_VISUALS[d.prop.kind] ?? { w: 1, d: 1 };
        const sx = Math.round(d.gy * T - (v.w * T) / 2);
        const sy = Math.round((gw - d.gx) * T - (v.d * T) / 2);
        ctx.fillStyle = 'rgba(24,20,37,0.3)';
        ctx.fillRect(sx + 3, sy + 3, v.w * T - 6, v.d * T - 6);
        const ly = Math.round(sy - (d.gz ?? 0) * zPx);
        drawPropIcon(ctx, d.prop.kind, sx, ly, v.w, v.d, T);
        itemRing(ctx, sx, ly, v.w * T, v.d * T, T);
      }
    }
    ctx.restore();
  }

  return {
    /**
     * Draw the level and drawables (caller clears the canvas).
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} camera
     * @param {object[]} [drawables]
     * @param {{viewW?:number,viewH?:number,overlay?:(ctx:CanvasRenderingContext2D,camera:object)=>void}} [opts]
     */
    draw(ctx, camera, drawables = [], opts = {}) {
      const t = camera.transform();
      const viewW = opts.viewW ?? ctx.canvas.width;
      const viewH = opts.viewH ?? ctx.canvas.height;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, viewW, viewH);
      const list = drawables
        .slice()
        .sort((a, b) => (a.prop ? 1 : 0) - (b.prop ? 1 : 0) || b.gx - a.gx);
      if (t.blend < 1 && t.prevLod !== t.lod) {
        const { cx, cy } = camera.state;
        const scalePrev = t.prevLod === 'lo' ? t.scale * HI_RATIO : t.scale / HI_RATIO;
        const T0 = TOP_LODS[t.prevLod].tile;
        const vc = camera.viewCenter?.() ?? { x: viewW / 2, y: viewH / 2 };
        drawScene(ctx, list, t.prevLod, scalePrev, vc.x - cy * T0 * scalePrev, vc.y - (grid.width - cx) * T0 * scalePrev);
        ctx.save();
        ctx.globalAlpha = t.blend;
        drawScene(ctx, list, t.lod, t.scale, t.originX, t.originY);
        ctx.restore();
      } else {
        drawScene(ctx, list, t.lod, t.scale, t.originX, t.originY);
      }
      opts.overlay?.(ctx, camera);
    },
    invalidateFloor() {
      layerKey = null;
    },
    /** Tile under a screen point, or null when outside the grid. */
    pickTile(sx, sy, camera) {
      const g = camera.screenToGrid(sx, sy);
      const x = Math.floor(g.x);
      const y = Math.floor(g.y);
      return grid.inBounds(x, y) ? { x, y } : null;
    }
  };
}
