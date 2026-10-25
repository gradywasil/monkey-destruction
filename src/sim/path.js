const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const MAX_FIELDS = 8;

/**
 * Binary min-heap of (key, id) pairs on typed arrays; grows by doubling.
 * Keys are numbers (ties are the caller's job: fold a sequence number into the key).
 */
export class MinHeap {
  constructor(capacity = 256) {
    this.keys = new Float64Array(capacity);
    this.ids = new Int32Array(capacity);
    this.size = 0;
  }

  clear() {
    this.size = 0;
  }

  push(key, id) {
    if (this.size === this.keys.length) {
      const k = new Float64Array(this.size * 2);
      const v = new Int32Array(this.size * 2);
      k.set(this.keys);
      v.set(this.ids);
      this.keys = k;
      this.ids = v;
    }
    const { keys, ids } = this;
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      keys[i] = keys[p];
      ids[i] = ids[p];
      i = p;
    }
    keys[i] = key;
    ids[i] = id;
  }

  /** Remove and return the id with the smallest key (undefined state when empty: check size first). */
  pop() {
    const { keys, ids } = this;
    const top = ids[0];
    const n = --this.size;
    if (n > 0) {
      const key = keys[n];
      const id = ids[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= key) break;
        keys[i] = keys[c];
        ids[i] = ids[c];
        i = c;
      }
      keys[i] = key;
      ids[i] = id;
    }
    return top;
  }
}

/** Leaving (x,y) ignores whether (x,y) itself is walkable (lets blocked units escape). */
function stepOut(grid, x, y, nx, ny) {
  if (grid.isWalkable(x, y)) return grid.canStep(x, y, nx, ny);
  if (!grid.isWalkable(nx, ny)) return false;
  const dx = nx - x;
  const dy = ny - y;
  if (dx === 1) return !grid.isEdgeBlocked(nx, ny, 'W');
  if (dx === -1) return !grid.isEdgeBlocked(x, y, 'W');
  if (dy === 1) return !grid.isEdgeBlocked(nx, ny, 'N');
  return !grid.isEdgeBlocked(x, y, 'N');
}

/**
 * Pathfinding service over a Grid (4-neighbour, edge walls). Caches are keyed on grid.version.
 * @param {import('./grid.js').Grid} grid
 */
export function createPathService(grid) {
  const W = grid.width;
  const H = grid.height;
  const N = W * H;
  const stats = { searches: 0, expansions: 0, cacheHits: 0 };
  const fields = new Map();
  let fieldsVersion = -1;
  let reachVersion = -1;
  const reachCache = new Map();
  const gScore = new Int32Array(N);
  const parent = new Int32Array(N);
  const closed = new Uint8Array(N);

  const rebuild = (end) => {
    const path = [];
    let i = end;
    while (parent[i] !== -1) {
      path.push({ x: i % W, y: (i / W) | 0 });
      i = parent[i];
    }
    return path.reverse();
  };

  const open = new MinHeap(512);
  const goalMark = new Uint8Array(N);
  let gx = new Int32Array(16);
  let gy = new Int32Array(16);
  const SEQ = 4294967296;

  function search(sx, sy, goals) {
    stats.searches++;
    if (!grid.inBounds(sx, sy)) return null;
    let gn = 0;
    if (gx.length < goals.length) {
      gx = new Int32Array(goals.length);
      gy = new Int32Array(goals.length);
    }
    for (let k = 0; k < goals.length; k++) {
      const g = goals[k];
      if (!grid.inBounds(g.x, g.y) || goalMark[g.y * W + g.x]) continue;
      goalMark[g.y * W + g.x] = 1;
      gx[gn] = g.x;
      gy[gn++] = g.y;
    }
    if (!gn) return null;
    const heur = (x, y) => {
      let m = 1e9;
      for (let k = 0; k < gn; k++) {
        const d = Math.abs(gx[k] - x) + Math.abs(gy[k] - y);
        if (d < m) m = d;
      }
      return m;
    };
    let found = null;
    gScore.fill(-1);
    closed.fill(0);
    const s = sy * W + sx;
    gScore[s] = 0;
    parent[s] = -1;
    open.clear();
    let seq = 0;
    const h0 = heur(sx, sy);
    // key orders by f, then h, then insertion order (same tie-break as before)
    open.push((h0 * 1024 + h0) * SEQ + seq++, s);
    while (open.size) {
      const i = open.pop();
      if (closed[i]) continue;
      closed[i] = 1;
      stats.expansions++;
      if (goalMark[i]) { found = i; break; }
      const x = i % W;
      const y = (i / W) | 0;
      const g = gScore[i] + 1;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        if (gScore[ni] !== -1 && g >= gScore[ni]) continue;
        if (!(i === s ? stepOut(grid, x, y, nx, ny) : grid.canStep(x, y, nx, ny))) continue;
        gScore[ni] = g;
        parent[ni] = i;
        const hh = heur(nx, ny);
        open.push(((g + hh) * 1024 + hh) * SEQ + seq++, ni);
      }
    }
    for (let k = 0; k < gn; k++) goalMark[gy[k] * W + gx[k]] = 0;
    return found;
  }

  /** @returns {{x:number,y:number}[]|null} tiles after start through goal; [] if start === goal. */
  function findPath(sx, sy, gx, gy) {
    const end = search(sx, sy, [{ x: gx, y: gy }]);
    return end === null ? null : rebuild(end);
  }

  /** @returns {{path:{x:number,y:number}[], goal:{x:number,y:number}}|null} */
  function findPathToAny(sx, sy, goals) {
    const end = search(sx, sy, goals);
    if (end === null) return null;
    return { path: rebuild(end), goal: { x: end % W, y: (end / W) | 0 } };
  }

  /** BFS distance-to-nearest-goal field, cached per goals + grid.version. */
  function flowField(goals) {
    if (fieldsVersion !== grid.version) {
      fields.clear();
      fieldsVersion = grid.version;
    }
    const k = goals.map((g) => `${g.x},${g.y}`).sort().join(';');
    const hit = fields.get(k);
    if (hit) {
      stats.cacheHits++;
      fields.delete(k);
      fields.set(k, hit);
      return hit;
    }
    stats.searches++;
    const dist = N > 32767 ? new Int32Array(N).fill(-1) : new Int16Array(N).fill(-1);
    const q = new Int32Array(N);
    let qh = 0;
    let qt = 0;
    for (const g of goals) {
      if (!grid.isWalkable(g.x, g.y)) continue;
      const i = g.y * W + g.x;
      if (dist[i] === -1) {
        dist[i] = 0;
        q[qt++] = i;
      }
    }
    while (qh < qt) {
      const i = q[qh++];
      stats.expansions++;
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!grid.inBounds(nx, ny)) continue;
        const ni = ny * W + nx;
        if (dist[ni] !== -1 || !grid.canStep(nx, ny, x, y)) continue;
        dist[ni] = dist[i] + 1;
        q[qt++] = ni;
      }
    }
    const field = { dist, width: W, height: H, version: grid.version };
    fields.set(k, field);
    if (fields.size > MAX_FIELDS) fields.delete(fields.keys().next().value);
    return field;
  }

  /** @returns {{x:number,y:number}|null} next tile downhill on the field. */
  function flowNext(field, x, y) {
    if (!grid.inBounds(x, y)) return null;
    const d = field.dist[y * W + x];
    if (d <= 0) return null;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!grid.inBounds(nx, ny)) continue;
      const nd = field.dist[ny * W + nx];
      if (nd >= 0 && nd < d && stepOut(grid, x, y, nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  /** @returns {{x:number,y:number}[]} walkable tiles 4-adjacent to the footprint, sorted (y, x). */
  function adjacentTiles({ x, y, w = 1, d = 1 }) {
    const out = [];
    const seen = new Set();
    // (ex, ey, side) is the shared edge between the candidate tile and the footprint; a wall there means it cannot reach the item
    const add = (tx, ty, ex, ey, side) => {
      const k = ty * W + tx;
      if (seen.has(k) || !grid.isWalkable(tx, ty) || grid.isEdgeBlocked(ex, ey, side)) return;
      seen.add(k);
      out.push({ x: tx, y: ty });
    };
    for (let i = 0; i < w; i++) {
      add(x + i, y - 1, x + i, y, 'N');
      add(x + i, y + d, x + i, y + d, 'N');
    }
    for (let j = 0; j < d; j++) {
      add(x - 1, y + j, x, y + j, 'W');
      add(x + w, y + j, x + w, y + j, 'W');
    }
    return out.sort((a, b) => a.y - b.y || a.x - b.x);
  }

  /** @returns {Set<string>} "x,y" keys reachable from start. */
  function reachable(sx, sy) {
    if (reachVersion !== grid.version) {
      reachCache.clear();
      reachVersion = grid.version;
    }
    const sk = `${sx},${sy}`;
    const hit = reachCache.get(sk);
    if (hit) {
      stats.cacheHits++;
      return hit;
    }
    stats.searches++;
    const set = new Set();
    if (grid.inBounds(sx, sy)) {
      set.add(sk);
      const q = [[sx, sy]];
      for (let qi = 0; qi < q.length; qi++) {
        const [x, y] = q[qi];
        stats.expansions++;
        for (const [dx, dy] of DIRS) {
          const nx = x + dx;
          const ny = y + dy;
          const k = `${nx},${ny}`;
          if (set.has(k) || !grid.inBounds(nx, ny)) continue;
          if (!(qi === 0 ? stepOut(grid, x, y, nx, ny) : grid.canStep(x, y, nx, ny))) continue;
          set.add(k);
          q.push([nx, ny]);
        }
      }
    }
    if (reachCache.size >= MAX_FIELDS) reachCache.delete(reachCache.keys().next().value);
    reachCache.set(sk, set);
    return set;
  }

  return { findPath, findPathToAny, flowField, flowNext, adjacentTiles, reachable, stats };
}
