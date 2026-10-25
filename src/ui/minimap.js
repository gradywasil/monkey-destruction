import { ITEM_DEFS } from '../data/items.js';

const FLOOR = {
  carpetA: '#c0cbdc', carpetB: '#5a6988', carpetC: '#b55088', tile: '#e8b796', asphalt: '#3a4466', grass: '#63c74d',
};
const ROLE = { breacher: '#f77622', hauler: '#63c74d', rigger: '#0099db', decoy: '#b55088' };
const MAX_W = 80;
const MAX_H = 62;
const PAD = 2;
const HEAVY = 4;

/**
 * Pixels per tile so the level fits the panel.
 * @param {number} width
 * @param {number} height
 * @returns {number}
 */
export function miniScale(width, height) {
  return Math.max(2, Math.floor(Math.min(MAX_W / width, MAX_H / height)));
}

/** @returns {{x:number,y:number}} minimap pixel for a grid coordinate. */
export function gridToMini(x, y, scale) {
  return { x: x * scale, y: y * scale };
}

/**
 * Inverse of gridToMini, clamped to the grid.
 * @param {number} px
 * @param {number} py
 * @param {number} scale
 * @param {{width:number,height:number}} [grid] clamp bounds; omit to skip clamping
 * @returns {{x:number,y:number}}
 */
export function miniToGrid(px, py, scale, grid) {
  const x = px / scale;
  const y = py / scale;
  if (!grid) return { x, y };
  return { x: Math.min(grid.width, Math.max(0, x)), y: Math.min(grid.height, Math.max(0, y)) };
}

/** @returns {string} colour for a crew role (grey fallback). */
export function roleColor(role) {
  return ROLE[role] ?? '#ead4aa';
}

/**
 * Bounding rect (grid units, clamped) of the camera's view projected onto z 0.
 * @param {{screenToGrid:Function,state?:object,viewW?:number,viewH?:number}} camera
 * @param {{width:number,height:number}} grid
 * @param {{w:number,h:number}} [view] screen size override
 * @returns {{x0:number,y0:number,x1:number,y1:number}}
 */
export function viewportQuad(camera, grid, view) {
  const w = view?.w ?? camera.state?.viewW ?? camera.viewW ?? 390;
  const h = view?.h ?? camera.state?.viewH ?? camera.viewH ?? 844;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [sx, sy] of [[0, 0], [w, 0], [w, h], [0, h]]) {
    const g = camera.screenToGrid(sx, sy, 0);
    x0 = Math.min(x0, g.x); x1 = Math.max(x1, g.x);
    y0 = Math.min(y0, g.y); y1 = Math.max(y1, g.y);
  }
  const cx = (v, n) => Math.min(n, Math.max(0, v));
  return { x0: cx(x0, grid.width), y0: cx(y0, grid.height), x1: cx(x1, grid.width), y1: cx(y1, grid.height) };
}

function drawStatic(ctx, grid, s) {
  ctx.clearRect(0, 0, grid.width * s, grid.height * s);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const c = FLOOR[grid.tile(x, y)?.floor];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * s, y * s, s, s);
    }
  }
  for (const [k, e] of grid.edges) {
    if (e.broken) continue;
    const [xs, ys, side] = k.split(',');
    const x = +xs * s;
    const y = +ys * s;
    ctx.fillStyle = e.type === 'door' ? (e.locked ? '#a22633' : '#ead4aa')
      : e.type === 'window' ? (e.rigged ? '#feae34' : '#2ce8f5') : '#ead4aa';
    if (e.type === 'door' && !e.locked) continue;
    if (side === 'N') ctx.fillRect(x, y, s, 1);
    else ctx.fillRect(x, y, 1, s);
  }
}

/**
 * Top-down minimap panel.
 * @param {HTMLElement} parent
 * @param {{grid:import('../sim/grid.js').Grid, onFocus?:(gx:number,gy:number)=>void, view?:{w:number,h:number}}} opts
 * @returns {{el:HTMLElement, update:(snapshot:object, camera:object, view?:{w:number,h:number})=>void, destroy:()=>void}}
 */
export function createMinimap(parent, { grid, onFocus, view }) {
  const s = miniScale(grid.width, grid.height);
  const W = grid.width * s;
  const H = grid.height * s;
  const el = document.createElement('div');
  el.className = 'mini px';
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  el.appendChild(canvas);
  parent.appendChild(el);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const lctx = layer.getContext('2d');
  let drawnVersion = null;

  function focusAt(ev) {
    const r = canvas.getBoundingClientRect();
    const g = miniToGrid((ev.clientX - r.left) * (W / r.width), (ev.clientY - r.top) * (H / r.height), s, grid);
    onFocus?.(g.x, g.y);
  }
  let dragging = false;
  const down = (ev) => {
    dragging = true;
    el.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
    focusAt(ev);
  };
  const move = (ev) => {
    if (!dragging) return;
    ev.preventDefault();
    focusAt(ev);
  };
  const up = (ev) => {
    dragging = false;
    el.releasePointerCapture?.(ev.pointerId);
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  const dot = (x, y, n, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * s - n / 2), Math.round(y * s - n / 2), n, n);
  };

  function update(snapshot, camera, v = view) {
    if (drawnVersion !== grid.version) {
      drawStatic(lctx, grid, s);
      drawnVersion = grid.version;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(layer, 0, 0);

    const t = grid.truck;
    if (t) {
      ctx.strokeStyle = '#fee761';
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x * s + 0.5, t.y * s + 0.5, t.w * s - 1, t.d * s - 1);
    }

    const items = snapshot?.items
      ?? grid.props.filter((p) => ITEM_DEFS[p.kind]).map((p) => ({ ...p, weight: ITEM_DEFS[p.kind].weight, state: 'placed' }));
    for (const it of items) {
      if (it.state && it.state !== 'placed') continue;
      const cx = it.x + (it.w ?? 1) / 2;
      const cy = it.y + (it.d ?? 1) / 2;
      if ((it.weight ?? 1) >= HEAVY) dot(cx, cy, 2, '#feae34');
      else dot(cx, cy, 1, '#fee761');
    }

    for (const ch of snapshot?.chains ?? []) {
      for (const st of ch.stations) dot(st.x + 0.5, st.y + 0.5, 2, '#ffffff');
    }

    for (const i of snapshot?.inspectors ?? []) {
      if (i.hx !== undefined && i.range) {
        const a = Math.atan2(i.hy, i.hx);
        const r = i.range * s;
        const ha = i.halfAngle ?? 0.5;
        const px = i.x * s;
        const py = i.y * s;
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#e43b44';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a - ha) * r, py + Math.sin(a - ha) * r);
        ctx.lineTo(px + Math.cos(a + ha) * r, py + Math.sin(a + ha) * r);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      dot(i.x, i.y, 3, '#e43b44');
    }

    for (const c of snapshot?.crew ?? []) dot(c.x, c.y, 2, roleColor(c.role));

    if (camera) {
      const q = viewportQuad(camera, grid, v);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      const x = Math.round(q.x0 * s);
      const y = Math.round(q.y0 * s);
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, Math.round(q.x1 * s) - x - 1), Math.max(1, Math.round(q.y1 * s) - y - 1));
    }
  }

  return {
    el,
    update,
    destroy() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.remove();
    },
  };
}
