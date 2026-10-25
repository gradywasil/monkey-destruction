import { ROLES, POSES } from '../data/crew-roles.js';

const LODS = { hi: { size: 64, ax: 32, ay: 56, shadow: [28, 22, 14] }, lo: { size: 32, ax: 16, ay: 28, shadow: [16, 12] } };
const FACINGS = ['right', 'left'];

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Halve an RGBA image: per 2x2 block pick the most frequent opaque colour (ties -> darkest).
 * @param {Uint8ClampedArray|Uint8Array} rgba
 * @param {number} w
 * @param {number} h
 * @returns {Uint8ClampedArray}
 */
export function downsample2x(rgba, w, h) {
  const ow = w >> 1;
  const oh = h >> 1;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const cnt = new Map();
      let n = 0;
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const p = ((y * 2 + j) * w + x * 2 + i) * 4;
          if (rgba[p + 3] > 110) {
            const key = (rgba[p] << 16) | (rgba[p + 1] << 8) | rgba[p + 2];
            cnt.set(key, (cnt.get(key) || 0) + 1);
            n++;
          }
        }
      }
      if (!n) continue;
      let best = -1;
      let bc = 0;
      let bl = 1e9;
      cnt.forEach((c, key) => {
        const l = ((key >> 16) & 255) * 0.3 + ((key >> 8) & 255) * 0.59 + (key & 255) * 0.11;
        if (c > bc || (c === bc && l < bl)) {
          best = key;
          bc = c;
          bl = l;
        }
      });
      const q = (y * ow + x) * 4;
      out[q] = (best >> 16) & 255;
      out[q + 1] = (best >> 8) & 255;
      out[q + 2] = best & 255;
      out[q + 3] = 255;
    }
  }
  return out;
}

/**
 * Build packed crew atlases (hi 64px, lo 32px) for every role variant, pose and facing.
 * @param {object} [CrewArtApi]
 */
export function buildCrewAtlas(CrewArtApi = globalThis.CrewArt) {
  const variants = [...new Set(Object.values(ROLES).flatMap((r) => r.variants))];
  const cells = [];
  variants.forEach((v) => POSES.forEach((p) => FACINGS.forEach((f) => cells.push([v, p, f]))));
  const readCanvas = makeCanvas(64, 64);
  const readCtx = readCanvas.getContext('2d', { willReadFrequently: true });
  const cols = 8;
  const rows = Math.ceil(cells.length / cols);
  const index = new Map();
  const sheets = {};
  for (const [lod, cfg] of Object.entries(LODS)) {
    const s = cfg.size;
    const canvas = makeCanvas(cols * s, rows * s);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const tmp = makeCanvas(s, s);
    const tctx = tmp.getContext('2d');
    cells.forEach(([v, p, f], i) => {
      const src = CrewArtApi.pose(v, p);
      let cell = src;
      if (lod === 'lo') {
        readCtx.clearRect(0, 0, 64, 64);
        readCtx.drawImage(src, 0, 0);
        const d = readCtx.getImageData(0, 0, 64, 64);
        const img = tctx.createImageData(32, 32);
        img.data.set(downsample2x(d.data, 64, 64));
        tctx.clearRect(0, 0, s, s);
        tctx.putImageData(img, 0, 0);
        cell = tmp;
      }
      const sx = (i % cols) * s;
      const sy = Math.floor(i / cols) * s;
      ctx.save();
      if (f === 'left') {
        ctx.translate(sx + s, sy);
        ctx.scale(-1, 1);
        ctx.drawImage(cell, 0, 0);
      } else {
        ctx.drawImage(cell, sx, sy);
      }
      ctx.restore();
      index.set(`${v}|${p}|${lod}|${f}`, { canvas, sx, sy, w: s, h: s, ax: f === 'left' ? s - cfg.ax : cfg.ax, ay: cfg.ay });
    });
    sheets[lod] = canvas;
  }
  return {
    sheets,
    get(variant, pose, lod, facing) {
      return index.get(`${variant}|${pose}|${lod}|${facing}`);
    },
    variantFor(role, seed) {
      const vs = (ROLES[role] || ROLES.plain).variants;
      return vs[Math.abs(Math.trunc(seed)) % vs.length];
    },
    poseFor(role) {
      return (ROLES[role] || ROLES.plain).pose;
    }
  };
}

/**
 * Draw a crew sprite with its feet anchor at (x, y), with a ground shadow.
 */
export function drawCrewSprite(ctx, atlas, variant, pose, lod, facing, x, y) {
  const c = atlas.get(variant, pose, lod, facing);
  if (!c) return;
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = 'rgba(24,20,37,0.34)';
  LODS[lod].shadow.forEach((w, i) => ctx.fillRect(px - w / 2, py - 1 + i, w, 1));
  ctx.drawImage(c.canvas, c.sx, c.sy, c.w, c.h, px - c.ax, py - c.ay, c.w, c.h);
}
