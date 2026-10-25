import { LODS, E32, OUTLINE, WALL_HEIGHT, WALL_THICK } from './lod.js';
import { PROP_VISUALS, FLOOR_COLORS, PROP_COLORS } from '../data/prop-visuals.js';

const PAD = 1;
const ATLAS_W = 512;
const DRYWALL = '#ead4aa';
const WALL_KEYS = ['intact', 'damaged', 'broken', 'window', 'doorLocked', 'door', 'doorBroken'];

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PAL_RGB = E32.map(hexToRgb);

/**
 * Nearest Endesga-32 colour (by squared RGB distance).
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string} hex colour
 */
export function snapToPalette(r, g, b) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < PAL_RGB.length; i++) {
    const p = PAL_RGB[i];
    const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return E32[best];
}

/**
 * In-place: alpha < 128 becomes fully transparent, else opaque; colours snap to E32.
 * @param {Uint8ClampedArray|number[]} rgba
 * @returns {Uint8ClampedArray|number[]} the same array
 */
export function crispify(rgba) {
  const cache = new Map();
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) {
      rgba[i] = rgba[i + 1] = rgba[i + 2] = rgba[i + 3] = 0;
      continue;
    }
    const k = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    let c = cache.get(k);
    if (!c) {
      c = hexToRgb(snapToPalette(rgba[i], rgba[i + 1], rgba[i + 2]));
      cache.set(k, c);
    }
    rgba[i] = c[0];
    rgba[i + 1] = c[1];
    rgba[i + 2] = c[2];
    rgba[i + 3] = 255;
  }
  return rgba;
}

const lodOf = (lod) => (typeof lod === 'string' ? LODS[lod] : lod);

function proj(x, y, z, L) {
  return [(x - y) * L.tileW / 2, (x + y) * L.tileH / 2 - z * L.heightPx];
}

function boxAt(x, y, z, w, d, h, L) {
  const P = (px, py, pz) => proj(x + px, y + py, z + pz, L);
  return {
    top: [P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h)],
    left: [P(0, d, 0), P(w, d, 0), P(w, d, h), P(0, d, h)],
    right: [P(w, 0, 0), P(w, d, 0), P(w, d, h), P(w, 0, h)]
  };
}

/**
 * Screen polygons of a box's top/left/right faces relative to its origin corner (0,0).
 * Left/right faces are [bottom-a, bottom-b, top-b, top-a] (u runs along the first edge).
 * @param {number} w extent along +x (tiles)
 * @param {number} d extent along +y (tiles)
 * @param {number} h height (height units)
 * @param {'lo'|'hi'|object} lod
 * @returns {{top: number[][], left: number[][], right: number[][]}}
 */
export function boxPolygons(w, d, h, lod) {
  return boxAt(0, 0, 0, w, d, h, lodOf(lod));
}

function mix(hex, to, t) {
  const a = hexToRgb(hex);
  return `rgb(${a.map((v, i) => Math.round(v + (to[i] - v) * t)).join(',')})`;
}
const light = (c) => mix(c, [255, 255, 255], 0.3);
const dark = (c) => mix(c, [0, 0, 0], 0.3);

function poly(ctx, pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function line(ctx, a, b, col) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawBox(ctx, L, x, y, z, w, d, h, color, outline = OUTLINE) {
  const b = boxAt(x, y, z, w, d, h, L);
  poly(ctx, b.left, color, outline);
  poly(ctx, b.right, dark(color), outline);
  poly(ctx, b.top, light(color), outline);
  return b;
}

// bilinear point on a face quad [bl, br, tr, tl]
function fp(q, u, v) {
  const bx = q[0][0] + (q[1][0] - q[0][0]) * u;
  const by = q[0][1] + (q[1][1] - q[0][1]) * u;
  const tx = q[3][0] + (q[2][0] - q[3][0]) * u;
  const ty = q[3][1] + (q[2][1] - q[3][1]) * u;
  return [bx + (tx - bx) * v, by + (ty - by) * v];
}
const sub = (q, u0, v0, u1, v1) => [fp(q, u0, v0), fp(q, u1, v0), fp(q, u1, v1), fp(q, u0, v1)];

function boundsOf(polys, extra = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) {
    for (const [x, y] of p) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  x0 = Math.floor(x0 - PAD - extra);
  y0 = Math.floor(y0 - PAD - extra);
  return { ox: -x0, oy: -y0, w: Math.ceil(x1 + PAD + extra) - x0, h: Math.ceil(y1 + PAD + extra) - y0 };
}

function drawFloor(ctx, L, key) {
  const c = FLOOR_COLORS[key];
  const hw = L.tileW / 2;
  const hh = L.tileH / 2;
  const top = [0, 0];
  const r = [hw, hh];
  const bot = [0, L.tileH];
  const l = [-hw, hh];
  poly(ctx, [top, r, bot, l], c);
  const edge = mix(c, [0, 0, 0], 0.18);
  line(ctx, [hw, hh - 0.5], [0, L.tileH - 0.5], edge);
  line(ctx, [0, L.tileH - 0.5], [-hw, hh - 0.5], edge);
}

function wallSize(kind, key) {
  const h = key === 'broken' ? 0.25 : key === 'doorBroken' ? 0.5 : WALL_HEIGHT;
  return kind === 'wallN' ? { w: 1, d: WALL_THICK, h } : { w: WALL_THICK, d: 1, h };
}

function drawWall(ctx, L, kind, key) {
  const full = wallSize(kind, 'intact');
  const s = wallSize(kind, key);
  const isN = kind === 'wallN';
  let color = DRYWALL;
  if (key === 'doorLocked') color = '#a22633';
  else if (key === 'door') color = '#d77643';
  else if (key === 'doorBroken') color = '#733e39';
  const b = drawBox(ctx, L, 0, 0, 0, s.w, s.d, s.h, color);
  const face = isN ? b.left : b.right;
  const faceShade = isN ? color : dark(color);
  if (key === 'damaged') {
    const cr = OUTLINE;
    const pts = [[0.3, 0.95], [0.38, 0.7], [0.3, 0.55], [0.45, 0.35], [0.4, 0.1]];
    for (let i = 0; i < pts.length - 1; i++) line(ctx, fp(face, ...pts[i]), fp(face, ...pts[i + 1]), cr);
    line(ctx, fp(face, 0.38, 0.7), fp(face, 0.6, 0.62), cr);
    line(ctx, fp(face, 0.45, 0.35), fp(face, 0.7, 0.3), cr);
    line(ctx, fp(face, 0.75, 0.95), fp(face, 0.68, 0.8), cr);
  } else if (key === 'broken') {
    const rub = [['#c28569', 0.1], ['#8b9bb4', 0.55], ['#733e39', 0.8]];
    rub.forEach(([c, u], i) => {
      const e = isN ? [u, 0.0] : [0.0, u];
      drawBox(ctx, L, e[0], e[1] + (isN ? WALL_THICK : 0), 0.25 * (i % 2), 0.12, 0.12, 0.1, c);
    });
    const p = fp(face, 0.3, 0.5);
    ctx.fillStyle = '#ead4aa';
    ctx.fillRect(Math.round(p[0]), Math.round(p[1]), 2, 1);
  } else if (key === 'window') {
    const g = sub(face, 0.2, 0.4, 0.8, 0.85);
    poly(ctx, g, '#2ce8f5', OUTLINE);
    line(ctx, fp(g, 0.25, 0.15), fp(g, 0.5, 0.8), '#ffffff');
    line(ctx, fp(g, 0.5, 0.15), fp(g, 0.7, 0.55), '#ffffff');
  } else if (key === 'doorLocked' || key === 'door') {
    poly(ctx, sub(face, 0.12, 0, 0.88, 0.9), faceShade, OUTLINE);
    if (key === 'doorLocked') {
      poly(ctx, sub(face, 0.62, 0.38, 0.8, 0.58), '#feae34', OUTLINE);
      const k = fp(face, 0.71, 0.48);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(Math.round(k[0]), Math.round(k[1]), 1, 1);
    } else {
      const k = fp(face, 0.75, 0.45);
      ctx.fillStyle = '#feae34';
      ctx.fillRect(Math.round(k[0]), Math.round(k[1]), 2, 2);
    }
  } else if (key === 'doorBroken') {
    [[0.15, 0.45], [0.4, 0.8], [0.7, 0.55]].forEach(([u, hh]) => {
      const pts = [fp(face, u, 1), fp(face, u + 0.06, 1 + hh), fp(face, u + 0.12, 1)];
      poly(ctx, pts, faceShade, OUTLINE);
    });
  }
  return full;
}

function drawProp(ctx, L, kind) {
  const v = PROP_VISUALS[kind];
  const c = PROP_COLORS[v.colorKey];
  const { w, d, h } = v;
  const eye = (q, u, vv) => {
    const p = fp(q, u, vv);
    return [Math.round(p[0]), Math.round(p[1])];
  };
  const dot = (q, u, vv, col, n = 1) => {
    const [x, y] = eye(q, u, vv);
    ctx.fillStyle = col;
    ctx.fillRect(x, y, n, n);
  };
  if (kind === 'statue') {
    drawBox(ctx, L, 0.1, 0.1, 0, 0.8, 0.8, 0.3, '#8b9bb4');
    drawBox(ctx, L, 0.25, 0.25, 0.3, 0.5, 0.5, 0.5, c);
    drawBox(ctx, L, 0.35, 0.35, 0.8, 0.3, 0.3, 0.2, c);
    return;
  }
  if (kind === 'monitor') {
    drawBox(ctx, L, 0.3, 0.3, 0, 0.4, 0.4, 0.06, '#5a6988');
    const b = drawBox(ctx, L, 0.15, 0.4, 0.06, 0.7, 0.2, 0.24, c);
    poly(ctx, sub(b.left, 0.1, 0.15, 0.9, 0.85), '#2ce8f5', null);
    return;
  }
  if (kind === 'plant') {
    drawBox(ctx, L, 0.25, 0.25, 0, 0.5, 0.5, 0.3, '#b86f50');
    drawBox(ctx, L, 0.15, 0.15, 0.3, 0.7, 0.7, 0.35, '#3e8948');
    drawBox(ctx, L, 0.3, 0.3, 0.65, 0.4, 0.4, 0.25, '#63c74d');
    return;
  }
  if (kind === 'chair') {
    drawBox(ctx, L, 0.2, 0.2, 0, 0.6, 0.6, 0.25, c);
    drawBox(ctx, L, 0.2, 0.2, 0.25, 0.6, 0.12, 0.2, c);
    return;
  }
  const b = drawBox(ctx, L, 0, 0, 0, w, d, h, c);
  if (kind === 'rack') {
    ['#e43b44', '#63c74d', '#feae34', '#63c74d'].forEach((col, i) => {
      dot(b.left, 0.2 + i * 0.015, 0.25 + i * 0.17, col);
      dot(b.left, 0.8, 0.25 + i * 0.17, '#2ce8f5');
    });
  } else if (kind === 'vend') {
    poly(ctx, sub(b.left, 0.12, 0.3, 0.6, 0.85), '#2ce8f5', OUTLINE);
    poly(ctx, sub(b.left, 0.7, 0.3, 0.88, 0.5), '#181425', null);
    dot(b.left, 0.76, 0.7, '#fee761');
  } else if (kind === 'safe') {
    const dial = fp(b.left, 0.5, 0.5);
    ctx.beginPath();
    ctx.arc(dial[0], dial[1], Math.max(2, L.heightPx / 10), 0, Math.PI * 2);
    ctx.fillStyle = '#c0cbdc';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    dot(b.left, 0.5, 0.5, '#181425');
  } else if (kind === 'copier') {
    poly(ctx, sub(b.top, 0.1, 0.1, 0.9, 0.5), '#8b9bb4', null);
    dot(b.left, 0.75, 0.5, '#63c74d');
  } else if (kind === 'desk') {
    poly(ctx, sub(b.left, 0.55, 0.05, 0.9, 0.65), dark(c), OUTLINE);
  } else if (kind === 'cab') {
    line(ctx, fp(b.left, 0.08, 0.5), fp(b.left, 0.92, 0.5), OUTLINE);
    dot(b.left, 0.5, 0.25, '#181425');
    dot(b.left, 0.5, 0.75, '#181425');
  } else if (kind === 'ceo') {
    poly(ctx, sub(b.top, 0.1, 0.1, 0.9, 0.9), '#733e39', null);
    poly(ctx, sub(b.left, 0.4, 0.05, 0.6, 0.6), '#733e39', OUTLINE);
  }
}

const IMI_GLYPHS = { I: ['111', '010', '010', '010', '111'], M: ['10001', '11011', '10101', '10001', '10001'] };

function drawTruck(ctx, L) {
  const YEL = '#fee761';
  const RAIL = '#feae34';
  drawBox(ctx, L, 0, 0.1, 0.1, 4, 1.8, 0.25, '#3a4466');
  drawBox(ctx, L, 0, 0.1, 0.35, 1, 1.8, 1, YEL);
  const cab = boxAt(0, 0.1, 0.35, 1, 1.8, 1, L);
  poly(ctx, sub(cab.left, 0.15, 0.4, 0.85, 0.85), '#2ce8f5', OUTLINE);
  poly(ctx, sub(cab.right, 0.15, 0.4, 0.85, 0.85), '#2ce8f5', OUTLINE);
  const bed = drawBox(ctx, L, 1, 0.1, 0.35, 3, 1.8, 0.3, YEL);
  drawBox(ctx, L, 1, 0.1, 0.65, 3, 0.1, 0.2, RAIL);
  drawBox(ctx, L, 1, 0.1, 0.65, 0.1, 1.8, 0.2, RAIL);
  drawBox(ctx, L, 1, 1.8, 0.65, 3, 0.1, 0.2, RAIL);
  [0.3, 1.9, 3.1].forEach((x) => drawBox(ctx, L, x, 1.65, 0, 0.5, 0.25, 0.35, '#181425'));
  const start = fp(bed.left, 0.3, 0.9);
  let cx = Math.round(start[0]);
  for (const ch of 'IMI') {
    const g = IMI_GLYPHS[ch];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < g[r].length; c++) {
        if (g[r][c] === '1') {
          ctx.fillStyle = OUTLINE;
          ctx.fillRect(cx + c, Math.round(start[1]) + r + Math.floor((cx + c - Math.round(start[0])) / 2), 1, 1);
        }
      }
    }
    cx += g[0].length + 1;
  }
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function renderCell(bounds, drawFn) {
  const cv = makeCanvas(bounds.w, bounds.h);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.translate(bounds.ox, bounds.oy);
  drawFn(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, 0, bounds.w, bounds.h);
  crispify(img.data);
  ctx.putImageData(img, 0, 0);
  return cv;
}

function specsFor(L) {
  const specs = [];
  const diamond = [[[0, 0], [L.tileW / 2, L.tileH / 2], [0, L.tileH], [-L.tileW / 2, L.tileH / 2]]];
  for (const key of Object.keys(FLOOR_COLORS)) {
    specs.push({ kind: 'floor', key, bounds: boundsOf(diamond), draw: (ctx) => drawFloor(ctx, L, key) });
  }
  for (const kind of ['wallN', 'wallW']) {
    const f = wallSize(kind, 'intact');
    const bp = boxAt(0, 0, 0, f.w, f.d, f.h, L);
    for (const key of WALL_KEYS) {
      specs.push({ kind, key, bounds: boundsOf([bp.top, bp.left, bp.right]), draw: (ctx) => drawWall(ctx, L, kind, key) });
    }
  }
  for (const kind of Object.keys(PROP_VISUALS)) {
    const v = PROP_VISUALS[kind];
    const bp = boxAt(0, 0, 0, v.w, v.d, v.h, L);
    specs.push({ kind: 'prop', key: kind, bounds: boundsOf([bp.top, bp.left, bp.right]), draw: (ctx) => drawProp(ctx, L, kind) });
  }
  const tb = boxAt(0, 0, 0, 4, 2, 1.0, L);
  specs.push({ kind: 'truck', key: 'flatbed', bounds: boundsOf([tb.top, tb.left, tb.right]), draw: (ctx) => drawTruck(ctx, L) });
  return specs;
}

function buildLod(L) {
  const cells = specsFor(L).map((s) => ({ ...s, canvas: renderCell(s.bounds, s.draw) }));
  let x = 0, y = 0, rowH = 0;
  for (const c of cells) {
    if (x + c.bounds.w + PAD > ATLAS_W) {
      x = 0;
      y += rowH + PAD;
      rowH = 0;
    }
    c.sx = x + PAD > ATLAS_W ? 0 : x;
    c.sy = y;
    x += c.bounds.w + PAD;
    rowH = Math.max(rowH, c.bounds.h);
  }
  const atlas = makeCanvas(ATLAS_W, y + rowH + PAD);
  const actx = atlas.getContext('2d');
  const map = new Map();
  for (const c of cells) {
    actx.drawImage(c.canvas, c.sx, c.sy);
    map.set(`${c.kind}:${c.key}`, { canvas: atlas, sx: c.sx, sy: c.sy, w: c.bounds.w, h: c.bounds.h, ax: c.bounds.ox, ay: c.bounds.oy });
  }
  return { atlas, map };
}

/**
 * Builds the procedural world atlas (floors, wall pieces, props) for both LODs.
 * Browser/OffscreenCanvas only; call once at startup.
 * @returns {{get: function(string, string, string): ({canvas: object, sx: number, sy: number, w: number, h: number, ax: number, ay: number}|undefined), canvases: object, entries: function(string): string[][]}}
 */
export function buildWorldAtlas() {
  const built = { lo: buildLod(LODS.lo), hi: buildLod(LODS.hi) };
  return {
    get(kind, key, lod) {
      return built[lod]?.map.get(`${kind}:${key}`);
    },
    canvases: { lo: built.lo.atlas, hi: built.hi.atlas },
    entries(lod) {
      return [...built[lod].map.keys()].map((k) => k.split(':'));
    }
  };
}
