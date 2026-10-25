/** Prop kinds with default footprint and whether they block movement. */
export const KNOWN_PROPS = {
  desk: { w: 2, d: 1, blocks: true },
  cab: { w: 1, d: 1, blocks: true },
  chair: { w: 1, d: 1, blocks: true },
  monitor: { w: 1, d: 1, blocks: false },
  rack: { w: 1, d: 1, blocks: true },
  vend: { w: 1, d: 1, blocks: true },
  safe: { w: 1, d: 1, blocks: true },
  statue: { w: 1, d: 1, blocks: true },
  ceo: { w: 3, d: 2, blocks: true },
  plant: { w: 1, d: 1, blocks: true },
  copier: { w: 1, d: 1, blocks: true },
};

export const FLOOR_TYPES = ['carpetA', 'carpetB', 'carpetC', 'tile', 'asphalt', 'grass', 'void'];
export const EDGE_TYPES = ['none', 'wall', 'window', 'door'];
export const MATERIALS = ['drywall', 'brick', 'glass', 'steel'];

const key = (x, y, side) => `${x},${y},${side}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

/** Edge-based tile grid for one building level. */
export class Grid {
  /**
   * @param {object} level Level JSON (see level.js). Use loadLevel() for validated input.
   */
  constructor(level) {
    this.id = level.id ?? null;
    this.name = level.name ?? '';
    this.notes = level.notes ?? '';
    this.width = level.width;
    this.height = level.height;
    this.floors = level.floors ?? 1;
    this.legend = clone(level.legend);
    this.truck = level.truck ? { ...level.truck } : null;
    this.spawns = (level.spawns ?? []).map((s) => ({ x: s.x, y: s.y }));
    this.par = level.par;
    this.crewCap = level.crewCap;
    this.version = level.version ?? 0;
    /** Bumped on damage that changes how an edge looks without changing passability (render cache key). */
    this.stamp = 0;
    this.tiles = [];
    for (let y = 0; y < this.height; y++) {
      const fr = level.floor[y] ?? '';
      const rr = level.room?.[y] ?? '';
      for (let x = 0; x < this.width; x++) {
        const floor = this.legend.floor[fr[x]];
        const room = rr[x] === undefined ? null : this.legend.room?.[rr[x]] ?? null;
        this.tiles.push({ floor, room });
      }
    }
    this.edges = new Map();
    for (const w of level.walls ?? []) {
      const len = w.len ?? 1;
      for (let i = 0; i < len; i++) {
        const x = w.side === 'N' ? w.x + i : w.x;
        const y = w.side === 'W' ? w.y + i : w.y;
        const e = { type: w.type, material: w.material, maxHp: w.maxHp ?? w.hp, hp: w.hp ?? w.maxHp };
        if (w.type === 'door') e.locked = !!w.locked;
        if (w.broken) e.broken = true;
        if (w.rigged) e.rigged = true;
        this.edges.set(key(x, y, w.side), e);
      }
    }
    this.props = [];
    this.blockMap = new Map();
    for (const p of level.props ?? []) this._insertProp(p);
  }

  /** @returns {boolean} */
  inBounds(x, y) {
    return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} [z] floor index (only 0 for now)
   * @returns {{floor:string, room:string|null}|undefined}
   */
  tile(x, y, z = 0) {
    if (z !== 0 || !this.inBounds(x, y)) return undefined;
    return this.tiles[y * this.width + x];
  }

  /** @returns {object|null} edge object owned by tile (x,y) on side 'N'|'W'. */
  edge(x, y, side, z = 0) {
    if (z !== 0) return null;
    return this.edges.get(key(x, y, side)) ?? null;
  }

  /**
   * Set or clear (type 'none' / null) an edge.
   * @param {number} x
   * @param {number} y
   * @param {'N'|'W'} side
   * @param {object|null} spec {type, material, hp, maxHp, locked}
   */
  setEdge(x, y, side, spec) {
    const k = key(x, y, side);
    if (!spec || spec.type === 'none') this.edges.delete(k);
    else {
      const e = { type: spec.type, material: spec.material, maxHp: spec.maxHp ?? spec.hp, hp: spec.hp ?? spec.maxHp };
      if (spec.type === 'door') e.locked = !!spec.locked;
      if (spec.broken) e.broken = true;
      if (spec.rigged) e.rigged = true;
      this.edges.set(k, e);
    }
    this.version++;
  }

  /**
   * Damage an edge; at hp 0 it becomes broken (passable).
   * @returns {{hp:number, broken:boolean}}
   */
  damageEdge(x, y, side, amount) {
    const e = this.edge(x, y, side);
    if (!e) return { hp: 0, broken: false };
    if (e.broken) return { hp: 0, broken: true };
    e.hp = Math.max(0, e.hp - amount);
    this.stamp++;
    if (e.hp === 0) {
      e.broken = true;
      this.version++;
    }
    return { hp: e.hp, broken: !!e.broken };
  }

  /** Mark a window edge as rigged with a zip-line (still blocks walking); bumps version. @returns {boolean} */
  setRigged(x, y, side, on = true) {
    const e = this.edge(x, y, side);
    if (!e || e.type !== 'window') return false;
    if (on) e.rigged = true;
    else delete e.rigged;
    this.version++;
    return true;
  }

  /** @returns {boolean} true if the edge blocks movement. */
  isEdgeBlocked(x, y, side) {
    const e = this.edge(x, y, side);
    if (!e || e.broken) return false;
    if (e.type === 'door') return e.locked;
    return e.type === 'wall' || e.type === 'window';
  }

  /** @returns {boolean} */
  isWalkable(x, y, z = 0) {
    const t = this.tile(x, y, z);
    return !!t && t.floor !== 'void' && !this.blockMap.has(y * this.width + x);
  }

  /** Can a unit step between 4-neighbour tiles (both walkable, shared edge open)? */
  canStep(x, y, nx, ny) {
    const dx = nx - x;
    const dy = ny - y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
    if (!this.isWalkable(x, y) || !this.isWalkable(nx, ny)) return false;
    if (dx === 1) return !this.isEdgeBlocked(nx, ny, 'W');
    if (dx === -1) return !this.isEdgeBlocked(x, y, 'W');
    if (dy === 1) return !this.isEdgeBlocked(nx, ny, 'N');
    return !this.isEdgeBlocked(x, y, 'N');
  }

  /** @returns {{x:number,y:number}[]} reachable 4-neighbours. */
  neighbors(x, y) {
    const out = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (this.canStep(x, y, x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
    }
    return out;
  }

  _insertProp(p) {
    const def = KNOWN_PROPS[p.kind];
    const prop = { id: p.id, kind: p.kind, x: p.x, y: p.y, w: p.w ?? def?.w ?? 1, d: p.d ?? def?.d ?? 1 };
    this.props.push(prop);
    if (def?.blocks) {
      for (let j = 0; j < prop.d; j++) {
        for (let i = 0; i < prop.w; i++) this.blockMap.set((prop.y + j) * this.width + prop.x + i, prop.id);
      }
    }
    return prop;
  }

  /** Add a prop; bumps version. @returns {object} the stored prop */
  addProp(p) {
    if (this.props.some((q) => q.id === p.id)) throw new Error(`Duplicate prop id: ${p.id}`);
    const prop = this._insertProp(p);
    this.version++;
    return prop;
  }

  /** Remove a prop by id; bumps version. @returns {object|null} removed prop */
  removeProp(id) {
    const i = this.props.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const [prop] = this.props.splice(i, 1);
    for (const [k, v] of this.blockMap) if (v === id) this.blockMap.delete(k);
    this.version++;
    return prop;
  }

  /** @returns {object|null} blocking prop covering (x,y), else any prop there. */
  propAt(x, y) {
    if (!this.inBounds(x, y)) return null;
    const bid = this.blockMap.get(y * this.width + x);
    if (bid !== undefined) return this.props.find((p) => p.id === bid) ?? null;
    return this.props.find((p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.d) ?? null;
  }

  /** Serialize to level JSON format (explicit per-edge walls, current state). */
  toJSON() {
    const fRev = Object.fromEntries(Object.entries(this.legend.floor).map(([c, v]) => [v, c]));
    const rRev = Object.fromEntries(Object.entries(this.legend.room ?? {}).map(([c, v]) => [v, c]));
    const floor = [];
    const room = [];
    for (let y = 0; y < this.height; y++) {
      let fs = '';
      let rs = '';
      for (let x = 0; x < this.width; x++) {
        const t = this.tile(x, y);
        fs += fRev[t.floor];
        rs += t.room === null ? (rRev.null ?? '.') : rRev[t.room];
      }
      floor.push(fs);
      room.push(rs);
    }
    const walls = [...this.edges.entries()].map(([k, e]) => {
      const [x, y, side] = k.split(',');
      const w = { x: +x, y: +y, side, type: e.type, material: e.material, hp: e.hp, maxHp: e.maxHp };
      if (e.type === 'door') w.locked = e.locked;
      if (e.broken) w.broken = true;
      if (e.rigged) w.rigged = true;
      return w;
    });
    const extra = {};
    if (this.par !== undefined) extra.par = this.par;
    if (this.crewCap !== undefined) extra.crewCap = this.crewCap;
    return {
      ...extra,
      id: this.id,
      name: this.name,
      notes: this.notes,
      width: this.width,
      height: this.height,
      floors: this.floors,
      version: this.version,
      legend: clone(this.legend),
      floor,
      room,
      walls,
      props: this.props.map((p) => ({ ...p })),
      truck: this.truck ? { ...this.truck } : null,
      spawns: this.spawns.map((s) => ({ ...s })),
    };
  }

  /** @returns {Grid} */
  static fromJSON(obj) {
    return new Grid(obj);
  }
}
