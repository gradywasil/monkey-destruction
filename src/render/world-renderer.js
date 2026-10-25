import { LAYER, gridToScreen, worldBounds, sortDrawables, depthKey } from './iso.js';
import { HI_RATIO } from './camera.js';
import { drawCrewSprite } from './atlas.js';
import { LODS, WALL_HEIGHT } from './lod.js';
import { boxOverlap, occluders } from './occlusion.js';
import { PROP_VISUALS } from '../data/prop-visuals.js';

const DESK_HEIGHT = PROP_VISUALS.desk.h;

const RING_SIZE = { lo: [12, 5], hi: [20, 8] };

function drawRing(ctx, lod, cx, cy) {
  const [w, h] = RING_SIZE[lod];
  const rx = w / 2;
  const ry = h / 2;
  ctx.fillStyle = '#fee761';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * rx - 0.5), Math.round(cy + Math.sin(a) * ry - 0.5), 1, 1);
  }
}

const BAR_W = 16;
const BAR_H = 3;
const RING_DOTS = 28;

function diamond(ctx, camera, x, y, inset) {
  const a = inset;
  const b = 1 - inset;
  const pts = [[x + a, y + a], [x + b, y + a], [x + b, y + b], [x + a, y + b]].map(([gx, gy]) => camera.gridToScreen(gx, gy, 0));
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

const CONE_SEGMENTS = 12;
const BAR_Z = 1.15;

const isTop = (camera) => camera.getProjection?.() === 'top';
/** Pixels per grid unit along +x (iso: half a tile width). */
const unitPx = (camera) => {
  const a = camera.gridToScreen(0, 0, 0);
  const b = camera.gridToScreen(1, 0, 0);
  return (isTop(camera) ? Math.hypot(b.x - a.x, b.y - a.y) : Math.abs(b.x - a.x)) || 1;
};
/** Vertical squash of ground circles (iso foreshortens, plan does not). */
const squash = (camera) => (isTop(camera) ? 1 : 0.5);
/** Height units that put a bar above a crew sprite's head. */
const barZ = (camera) => (isTop(camera) ? (camera.transform().lod === 'hi' ? 9.5 : 6.5) : BAR_Z);

function drawBar(ctx, p, frac, color) {
  const bx = Math.round(p.x - BAR_W / 2);
  const by = Math.round(p.y);
  ctx.fillStyle = '#181425';
  ctx.fillRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2);
  ctx.fillStyle = color;
  ctx.fillRect(bx, by, Math.max(1, Math.round(BAR_W * Math.min(1, frac))), BAR_H);
}

function drawText(ctx, text, x, y, color, size) {
  ctx.font = `${size}px Silkscreen, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#181425';
  ctx.fillText(text, Math.round(x) + 1, Math.round(y) + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

function drawInspector(ctx, camera, i, fined, lod) {
  const heat = Math.min(1, i.meter / 100);
  const base = Math.atan2(i.hy, i.hx);
  const o = camera.gridToScreen(i.x, i.y, 0);
  const pts = [];
  for (let k = 0; k <= CONE_SEGMENTS; k++) {
    const a = base - i.halfAngle + (2 * i.halfAngle * k) / CONE_SEGMENTS;
    pts.push(camera.gridToScreen(i.x + Math.cos(a) * i.range, i.y + Math.sin(a) * i.range, 0));
  }
  ctx.beginPath();
  ctx.moveTo(o.x, o.y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.closePath();
  ctx.fillStyle = `rgba(228,59,68,${(0.18 + 0.17 * heat).toFixed(3)})`;
  ctx.fill();
  ctx.strokeStyle = '#e43b44';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  ctx.lineTo(o.x, o.y);
  ctx.lineTo(pts[CONE_SEGMENTS].x, pts[CONE_SEGMENTS].y);
  ctx.stroke();
  const head = camera.gridToScreen(i.x, i.y, barZ(camera));
  const size = lod === 'hi' ? 10 : 7;
  if (i.meter > 0) drawBar(ctx, { x: head.x, y: head.y - BAR_H - 6 }, heat, '#e43b44');
  if (fined) drawText(ctx, 'FINED', head.x, head.y - BAR_H - 14, '#e43b44', size);
  else if (i.state === 'stalled') drawText(ctx, '...', head.x, head.y - BAR_H - 14, '#ead4aa', size);
  else if (i.meter > 40) drawText(ctx, '!', head.x, head.y - BAR_H - 14, '#fee761', size + 3);
}

const edgeMid = (e) => ({ x: e.side === 'N' ? e.x + 0.5 : e.x, y: e.side === 'N' ? e.y : e.y + 0.5 });

function drawZip(ctx, camera, z) {
  const m = edgeMid(z.edge);
  const a = camera.gridToScreen(m.x, m.y, 1.1);
  const b = camera.gridToScreen(z.net.x + 0.5, z.net.y + 0.5, 0.35);
  const sag = Math.max(3, Math.abs(b.x - a.x) * 0.08);
  ctx.fillStyle = '#733e39';
  for (let k = 0; k <= 16; k++) {
    if (k % 3 === 2) continue;
    const f = k / 16;
    ctx.fillRect(Math.round(a.x + (b.x - a.x) * f), Math.round(a.y + (b.y - a.y) * f + Math.sin(f * Math.PI) * sag), 1, 1);
  }
  ctx.strokeStyle = '#63c74d';
  diamond(ctx, camera, z.net.x, z.net.y, 0.15);
  ctx.stroke();
  const n = camera.gridToScreen(z.net.x + 0.5, z.net.y + 0.5, 0);
  const rx = unitPx(camera) * 0.35 * 0.5;
  const ry = rx * squash(camera);
  ctx.beginPath();
  ctx.moveTo(n.x - rx, n.y);
  ctx.lineTo(n.x + rx, n.y);
  ctx.moveTo(n.x, n.y - ry);
  ctx.lineTo(n.x, n.y + ry);
  ctx.stroke();
}

function drawDecoy(ctx, camera, c, d) {
  const head = camera.gridToScreen(c.x, c.y, barZ(camera));
  drawBar(ctx, { x: head.x, y: head.y - BAR_H - 4 }, d.stamina / 10, '#fee761');
  if (d.state !== 'engaged') return;
  const o = camera.gridToScreen(c.x, c.y, 0);
  const r = unitPx(camera) * 0.7;
  ctx.fillStyle = '#fee76188';
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    ctx.fillRect(Math.round(o.x + Math.cos(a) * r), Math.round(o.y + Math.sin(a) * r * squash(camera)), 1, 1);
  }
}

/**
 * Screen-space overlays: chain preview/active routes, whistle rings, breach hp bars,
 * inspector cones, zip-lines, rigging and decoy bars.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} camera
 * @param {{snapshot?:object, world?:object, chainPreview?:{pathTiles:object[],stations:object[]}|null, finedIds?:Set<string>}} data
 */
export function drawOverlays(ctx, camera, { snapshot, world, chainPreview, finedIds }) {
  const t = camera.transform();
  ctx.save();
  ctx.lineWidth = 1;
  const stations = (list, alpha, numbered) => {
    ctx.globalAlpha = alpha;
    list.forEach((s, i) => {
      diamond(ctx, camera, s.x, s.y, 0.2);
      ctx.fillStyle = '#fee761';
      ctx.fill();
      if (numbered) {
        const p = camera.gridToScreen(s.x + 0.5, s.y + 0.5, 0);
        ctx.fillStyle = '#181425';
        ctx.font = `${t.lod === 'hi' ? 10 : 7}px Silkscreen, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), Math.round(p.x), Math.round(p.y) + 1);
      }
    });
    ctx.globalAlpha = 1;
  };
  if (chainPreview) {
    ctx.strokeStyle = '#fee761';
    for (const p of chainPreview.pathTiles) {
      diamond(ctx, camera, p.x, p.y, 0.3);
      ctx.stroke();
    }
    stations(chainPreview.stations, 1, true);
  }
  for (const ch of snapshot?.chains ?? []) stations(ch.stations, 0.5, false);
  for (const w of snapshot?.whistles ?? []) {
    const it = world?.items.get(w.itemId);
    if (!it || (w.phase !== 'heave' && w.phase !== 'converge')) continue;
    const c = camera.gridToScreen(it.x + it.w / 2, it.y + it.d / 2, 0.3);
    const r = 0.9 * unitPx(camera);
    const heave = w.phase === 'heave';
    const lit = heave ? Math.round(RING_DOTS * w.progress) : 0;
    for (let i = 0; i < RING_DOTS; i++) {
      if (!heave && i % 2) continue;
      const a = -Math.PI / 2 + (i / RING_DOTS) * Math.PI * 2;
      ctx.fillStyle = i < lit ? '#fee761' : '#fee76155';
      ctx.fillRect(Math.round(c.x + Math.cos(a) * r - 1), Math.round(c.y + Math.sin(a) * r * squash(camera) - 1), 2, 2);
    }
  }
  for (const b of snapshot?.breaches ?? []) {
    const { x, y, side } = b.edge;
    const p = camera.gridToScreen(side === 'N' ? x + 0.5 : x, side === 'N' ? y : y + 0.5, WALL_HEIGHT + 0.2);
    const bx = Math.round(p.x - BAR_W / 2);
    const by = Math.round(p.y - BAR_H);
    ctx.fillStyle = '#181425';
    ctx.fillRect(bx - 1, by - 1, BAR_W + 2, BAR_H + 2);
    ctx.fillStyle = '#e43b44';
    ctx.fillRect(bx, by, Math.max(1, Math.round(BAR_W * b.hp / b.maxHp)), BAR_H);
  }
  const crewById = new Map((snapshot?.crew ?? []).map((c) => [c.id, c]));
  for (const z of snapshot?.zips ?? []) drawZip(ctx, camera, z);
  for (const i of snapshot?.inspectors ?? []) drawInspector(ctx, camera, i, finedIds?.has(i.id), t.lod);
  for (const r of snapshot?.rigs ?? []) {
    const c = crewById.get(r.crewId);
    if (!c || r.progress <= 0) continue;
    const head = camera.gridToScreen(c.x, c.y, barZ(camera));
    drawBar(ctx, { x: head.x, y: head.y - BAR_H - 4 }, r.progress, '#2ce8f5');
  }
  for (const d of snapshot?.decoys ?? []) {
    const c = crewById.get(d.crewId);
    if (c && (d.state === 'chase' || d.state === 'engaged')) drawDecoy(ctx, camera, c, d);
  }
  ctx.restore();
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const isInterior = (grid, x, y) => {
  const t = grid.tile(x, y);
  return !!t && t.floor !== 'void' && t.room != null;
};

/**
 * True when a wall edge faces the viewer from outside: viewer-side tile is not interior, tile behind it is.
 * @param {object} grid
 * @param {number} x
 * @param {number} y
 * @param {'N'|'W'} side
 * @returns {boolean}
 */
export function isFrontWall(grid, x, y, side) {
  const bx = side === 'W' ? x - 1 : x;
  const by = side === 'N' ? y - 1 : y;
  return !isInterior(grid, x, y) && isInterior(grid, bx, by);
}

/**
 * Wall atlas key for an edge's current state.
 * @param {{type:string,hp:number,maxHp:number,locked?:boolean,broken?:boolean}} edge
 * @returns {string}
 */
export function edgeSpriteKey(edge) {
  const dead = edge.broken || edge.hp <= 0;
  if (edge.type === 'door') return dead ? 'doorBroken' : edge.locked ? 'doorLocked' : 'door';
  if (edge.type === 'window') return dead ? 'broken' : 'window';
  if (dead) return 'broken';
  return edge.hp < edge.maxHp * 0.5 ? 'damaged' : 'intact';
}

const inRect = (r, x, y) => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY;

/**
 * Sortable drawables for visible, non-front wall edges.
 * @param {object} grid
 * @param {{minX:number,minY:number,maxX:number,maxY:number}} rect
 * @returns {object[]}
 */
export function collectWallDrawables(grid, rect) {
  const out = [];
  for (let y = rect.minY; y <= rect.maxY; y++) {
    for (let x = rect.minX; x <= rect.maxX; x++) {
      for (const side of ['N', 'W']) {
        const edge = grid.edge(x, y, side);
        if (!edge || isFrontWall(grid, x, y, side)) continue;
        out.push({
          gx: x, gy: y, w: side === 'N' ? 1 : 0, d: side === 'W' ? 1 : 0, gz: 0,
          layer: LAYER.BACK_WALL, kind: side === 'N' ? 'wallN' : 'wallW', key: edgeSpriteKey(edge)
        });
      }
    }
  }
  return out;
}

/**
 * Sortable drawables for props with any footprint tile inside rect; monitors sit on desks.
 * @param {object} grid
 * @param {{minX:number,minY:number,maxX:number,maxY:number}} rect
 * @returns {object[]}
 */
export function collectPropDrawables(grid, rect) {
  const out = [];
  const desks = grid.props.filter((p) => p.kind === 'desk');
  for (const p of grid.props) {
    let seen = false;
    for (let j = 0; j < p.d && !seen; j++) {
      for (let i = 0; i < p.w && !seen; i++) seen = inRect(rect, p.x + i, p.y + j);
    }
    if (!seen) continue;
    const onDesk = p.kind === 'monitor'
      && desks.some((k) => p.x >= k.x && p.x < k.x + k.w && p.y >= k.y && p.y < k.y + k.d);
    out.push({
      gx: p.x, gy: p.y, w: p.w, d: p.d, gz: onDesk ? DESK_HEIGHT : 0,
      layer: LAYER.PROP, kind: 'prop', key: p.kind
    });
  }
  return out;
}

/**
 * Isometric level renderer with cached floor layers and depth-sorted dynamic drawables.
 * @param {{grid:object, worldAtlas:object, crewAtlas:object}} deps
 */
export function createWorldRenderer({ grid, worldAtlas, crewAtlas }) {
  const floors = { lo: null, hi: null };

  function buildFloor(lod) {
    const b = worldBounds(grid.width, grid.height, lod, 0);
    const w = Math.ceil(b.maxX - b.minX);
    const h = Math.ceil(b.maxY - b.minY);
    const canvas = makeCanvas(w, h);
    const fctx = canvas.getContext('2d');
    fctx.imageSmoothingEnabled = false;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const t = grid.tile(x, y);
        if (t.floor === 'void') continue;
        const s = worldAtlas.get('floor', t.floor, lod);
        if (!s) continue;
        const p = gridToScreen(x, y, 0, lod);
        fctx.drawImage(s.canvas, s.sx, s.sy, s.w, s.h, Math.round(p.x - b.minX - s.ax), Math.round(p.y - b.minY - s.ay), s.w, s.h);
      }
    }
    return { canvas, ox: b.minX, oy: b.minY, w, h };
  }

  function drawFloor(ctx, lod, scale, originX, originY, viewW, viewH) {
    const f = floors[lod] ?? (floors[lod] = buildFloor(lod));
    const sx = Math.max(0, Math.floor((-originX) / scale - f.ox));
    const sy = Math.max(0, Math.floor((-originY) / scale - f.oy));
    const ex = Math.min(f.w, Math.ceil((viewW - originX) / scale - f.ox));
    const ey = Math.min(f.h, Math.ceil((viewH - originY) / scale - f.oy));
    if (ex <= sx || ey <= sy) return;
    ctx.drawImage(f.canvas, sx, sy, ex - sx, ey - sy, f.ox + sx, f.oy + sy, ex - sx, ey - sy);
  }

  function drawOne(ctx, d, lod) {
    if (d.prop) {
      const v = PROP_VISUALS[d.prop.kind];
      const q = gridToScreen(d.gx - (v?.w ?? 1) / 2, d.gy - (v?.d ?? 1) / 2, d.gz ?? 0, lod);
      const ps = worldAtlas.get('prop', d.prop.kind, lod);
      if (ps) ctx.drawImage(ps.canvas, ps.sx, ps.sy, ps.w, ps.h, Math.round(q.x - ps.ax), Math.round(q.y - ps.ay), ps.w, ps.h);
      return;
    }
    const p = gridToScreen(d.gx, d.gy, d.gz ?? 0, lod);
    if (d.crew) {
      if (d.ring) drawRing(ctx, lod, Math.round(p.x), Math.round(p.y));
      drawCrewSprite(ctx, crewAtlas, d.crew.variant, d.crew.pose, lod, d.crew.facing ?? 'right', p.x, p.y);
      return;
    }
    const s = worldAtlas.get(d.kind, d.key, lod);
    if (!s) return;
    ctx.drawImage(s.canvas, s.sx, s.sy, s.w, s.h, Math.round(p.x - s.ax), Math.round(p.y - s.ay), s.w, s.h);
  }

  const xray = { sil: null, mask: null };

  function scratch(key, w, h) {
    let c = xray[key];
    if (!c || c.width < w || c.height < h) {
      c = makeCanvas(Math.max(w, c?.width ?? 0, 64), Math.max(h, c?.height ?? 0, 64));
      xray[key] = c;
    }
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    x.clearRect(0, 0, w, h);
    return { c, x };
  }

  // per-scene sprite boxes (screen space, current lod); reused across frames
  let bx = new Float64Array(512);
  let by = new Float64Array(512);
  let bw = new Float64Array(512);
  let bh = new Float64Array(512);
  let blocks = new Uint8Array(512);

  /** Fill the box arrays for list; bw<0 marks "no box". Blocks[i]=1 when the entry can occlude crew. */
  function computeBoxes(list, lod) {
    if (list.length > bx.length) {
      const n = Math.max(list.length, bx.length * 2);
      bx = new Float64Array(n);
      by = new Float64Array(n);
      bw = new Float64Array(n);
      bh = new Float64Array(n);
      blocks = new Uint8Array(n);
    }
    const l = LODS[lod];
    const hw = l.tileW / 2;
    const hh = l.tileH / 2;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      const gz = d.gz ?? 0;
      const px = (d.gx - d.gy) * hw;
      const py = (d.gx + d.gy) * hh - gz * l.heightPx;
      blocks[i] = 0;
      if (d.crew) {
        const s = crewAtlas.get(d.crew.variant, d.crew.pose, lod, d.crew.facing ?? 'right');
        if (!s) { bw[i] = -1; continue; }
        bx[i] = Math.round(px) - s.ax;
        by[i] = Math.round(py) - s.ay;
        bw[i] = s.w;
        bh[i] = s.h;
      } else if (d.prop) {
        const v = PROP_VISUALS[d.prop.kind];
        const ps = worldAtlas.get('prop', d.prop.kind, lod);
        if (!ps) { bw[i] = -1; continue; }
        const q = gridToScreen(d.gx - (v?.w ?? 1) / 2, d.gy - (v?.d ?? 1) / 2, gz, lod);
        bx[i] = Math.round(q.x - ps.ax);
        by[i] = Math.round(q.y - ps.ay);
        bw[i] = ps.w;
        bh[i] = ps.h;
      } else {
        const s = worldAtlas.get(d.kind, d.key, lod);
        if (!s) { bw[i] = -1; continue; }
        bx[i] = Math.round(px - s.ax);
        by[i] = Math.round(py - s.ay);
        bw[i] = s.w;
        bh[i] = s.h;
        blocks[i] = 1;
      }
    }
  }

  function drawXray(ctx, list, lod, scale, originX, originY, viewW, viewH) {
    const vx = -originX / scale;
    const vy = -originY / scale;
    const vw = viewW / scale;
    const vh = viewH / scale;
    const occ = [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (!d.crew || d.noXray || bw[i] < 0) continue;
      const x = bx[i], y = by[i], w = bw[i], h = bh[i];
      if (!(x < vx + vw && vx < x + w && y < vy + vh && vy < y + h)) continue;
      occ.length = 0;
      for (let j = i + 1; j < list.length; j++) {
        if (blocks[j] && bw[j] >= 0 && x < bx[j] + bw[j] && bx[j] < x + w && y < by[j] + bh[j] && by[j] < y + h) occ.push(j);
      }
      if (!occ.length) continue;
      const b = { x, y, w, h };
      const s = crewAtlas.get(d.crew.variant, d.crew.pose, lod, d.crew.facing ?? 'right');
      const sil = scratch('sil', b.w, b.h);
      sil.x.drawImage(s.canvas, s.sx, s.sy, s.w, s.h, 0, 0, s.w, s.h);
      sil.x.globalCompositeOperation = 'source-in';
      sil.x.fillStyle = d.tint ?? '#fee761';
      sil.x.fillRect(0, 0, b.w, b.h);
      const mask = scratch('mask', b.w, b.h);
      mask.x.translate(-b.x, -b.y);
      for (const j of occ) drawOne(mask.x, list[j], lod);
      sil.x.globalCompositeOperation = 'destination-in';
      sil.x.setTransform(1, 0, 0, 1, 0, 0);
      sil.x.drawImage(mask.c, 0, 0, b.w, b.h, 0, 0, b.w, b.h);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(sil.c, 0, 0, b.w, b.h, b.x, b.y, b.w, b.h);
      ctx.globalAlpha = 1;
    }
  }

  function drawScene(ctx, list, lod, scale, originX, originY, viewW, viewH) {
    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(scale, scale);
    drawFloor(ctx, lod, scale, originX, originY, viewW, viewH);
    computeBoxes(list, lod);
    const vx = -originX / scale;
    const vy = -originY / scale;
    const vw = viewW / scale;
    const vh = viewH / scale;
    for (let i = 0; i < list.length; i++) {
      // cull sprites entirely outside the viewport (entries without a box still go through drawOne)
      if (bw[i] >= 0 && !(bx[i] < vx + vw && vx < bx[i] + bw[i] && by[i] < vy + vh && vy < by[i] + bh[i])) continue;
      drawOne(ctx, list[i], lod);
    }
    drawXray(ctx, list, lod, scale, originX, originY, viewW, viewH);
    ctx.restore();
  }

  // Static (wall/prop/truck) drawables, pre-sorted; rebuilt only when the grid changes or the visible rect does.
  let staticKey = null;
  let staticList = [];

  function staticFor(rect) {
    const key = `${grid.version}:${grid.stamp ?? 0}:${rect.minX},${rect.minY},${rect.maxX},${rect.maxY}:${grid.props.length}`;
    if (key === staticKey) return staticList;
    staticKey = key;
    staticList = sortDrawables([
      ...collectWallDrawables(grid, rect),
      ...collectPropDrawables(grid, rect),
      ...(grid.truck ? [{ gx: grid.truck.x, gy: grid.truck.y, w: grid.truck.w, d: grid.truck.d, gz: 0, layer: LAYER.PROP, kind: 'truck', key: 'flatbed' }] : [])
    ]);
    return staticList;
  }

  const before = (a, b) =>
    depthKey(a) - depthKey(b) || (a.layer || 0) - (b.layer || 0) || a.gx - b.gx || a.gy - b.gy;

  /** Merge two sorted lists; on a full tie the static entry (earlier in the original order) wins. */
  function merge(st, dyn) {
    const out = new Array(st.length + dyn.length);
    let i = 0, j = 0, k = 0;
    while (i < st.length && j < dyn.length) out[k++] = before(dyn[j], st[i]) < 0 ? dyn[j++] : st[i++];
    while (i < st.length) out[k++] = st[i++];
    while (j < dyn.length) out[k++] = dyn[j++];
    return out;
  }

  return {
    /**
     * Draw the level and drawables (caller clears the canvas).
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} camera
     * @param {object[]} [drawables]
     * @param {{viewW?:number,viewH?:number,overlay?:(ctx:CanvasRenderingContext2D,camera:object)=>void}} [opts]
     *   overlay runs after the sorted pass in untransformed screen space; call camera.gridToScreen for coordinates.
     */
    draw(ctx, camera, drawables = [], opts = {}) {
      const t = camera.transform();
      const viewW = opts.viewW ?? ctx.canvas.width;
      const viewH = opts.viewH ?? ctx.canvas.height;
      const rect = camera.visibleTileRect();
      const dyn = sortDrawables(drawables.map((d) => ({ w: 0, d: 0, gz: 0, layer: LAYER.CHARACTER, ...d })));
      const list = merge(staticFor(rect), dyn);
      ctx.imageSmoothingEnabled = false;
      if (t.blend < 1 && t.prevLod !== t.lod) {
        const { cx, cy } = camera.state;
        const scalePrev = t.prevLod === 'lo' ? t.scale * HI_RATIO : t.scale / HI_RATIO;
        const c = gridToScreen(cx, cy, 0, t.prevLod);
        drawScene(ctx, list, t.prevLod, scalePrev, viewW / 2 - c.x * scalePrev, viewH / 2 - c.y * scalePrev, viewW, viewH);
        ctx.save();
        ctx.globalAlpha = t.blend;
        drawScene(ctx, list, t.lod, t.scale, t.originX, t.originY, viewW, viewH);
        ctx.restore();
      } else {
        drawScene(ctx, list, t.lod, t.scale, t.originX, t.originY, viewW, viewH);
      }
      opts.overlay?.(ctx, camera);
    },
    invalidateFloor() {
      floors.lo = null;
      floors.hi = null;
      staticKey = null;
    },
    /**
     * Tile under a screen point, or null when outside the grid.
     * @returns {{x:number,y:number}|null}
     */
    pickTile(sx, sy, camera) {
      const g = camera.screenToGrid(sx, sy);
      const x = Math.floor(g.x);
      const y = Math.floor(g.y);
      return grid.inBounds(x, y) ? { x, y } : null;
    }
  };
}
