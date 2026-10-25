/*
 * Level JSON schema
 * {
 *   id, name, notes,                 strings
 *   width, height, floors: 1,
 *   legend: { floor: {char: floorType}, room: {char: roomId|null} },
 *   floor: [row strings, length width, height rows]   floorType per char via legend.floor
 *   room:  [row strings]                              room id per char via legend.room (null = outdoors)
 *   walls: [{ x, y, side: 'N'|'W', len?, type: 'wall'|'window'|'door', material, hp, locked? }]
 *     Edge 'N' of (x,y) sits between (x,y-1) and (x,y); 'W' sits between (x-1,y) and (x,y).
 *     len (default 1) repeats the edge: along +x for 'N', along +y for 'W'.
 *     Saved grids also carry maxHp and broken.
 *   props: [{ id, kind, x, y, w?, d? }]   w along +x, d along +y; defaults from KNOWN_PROPS
 *   truck: { x, y, w, d, dropX, dropY }   flatbed footprint and delivery tile
 *   spawns: [{ x, y }]
 *   inspectors?: [{ id, path: [{ x, y }, ...], speed }]   patrol waypoints (looped), walkable tiles
 *   par?: seconds (auto mode star threshold; default total value / 12 clamped 240..900)
 *   crewCap?: max crew in auto mode (default 12)
 *   tutorial?: { breach?: {x,y,side}, chainStart?: {x,y}, heavy?: propId }   in-world arrow targets for the coach tutorial
 * }
 */
import { Grid, KNOWN_PROPS, FLOOR_TYPES, EDGE_TYPES, MATERIALS } from './grid.js';

const isInt = (n) => Number.isInteger(n);

function fail(msg) {
  throw new Error(`Invalid level: ${msg}`);
}

/**
 * Validate a level object (or JSON string).
 * @param {object|string} json
 * @returns {object} the validated level object
 */
export function parseLevel(json) {
  const lv = typeof json === 'string' ? JSON.parse(json) : json;
  if (!lv || typeof lv !== 'object') fail('not an object');
  const { width: W, height: H } = lv;
  if (!isInt(W) || !isInt(H) || W < 1 || H < 1) fail(`bad dimensions ${W}x${H}`);
  if ((lv.floors ?? 1) !== 1) fail('only floors: 1 is supported');
  if (!lv.legend?.floor) fail('missing legend.floor');
  for (const [c, f] of Object.entries(lv.legend.floor)) {
    if (!FLOOR_TYPES.includes(f)) fail(`legend.floor '${c}' has unknown floor type '${f}'`);
  }
  for (const [name, rows, map] of [['floor', lv.floor, lv.legend.floor], ['room', lv.room, lv.legend.room]]) {
    if (!Array.isArray(rows) || rows.length !== H) fail(`${name} must have ${H} rows`);
    rows.forEach((r, y) => {
      if (typeof r !== 'string' || r.length !== W) fail(`${name} row ${y} must be ${W} chars`);
      for (const c of r) if (!map || !(c in map)) fail(`${name} row ${y} has unknown char '${c}'`);
    });
  }

  const grid = new Grid(lv);
  const isFloor = (x, y) => grid.inBounds(x, y) && grid.tile(x, y).floor !== 'void';

  for (const [i, w] of (lv.walls ?? []).entries()) {
    const at = `walls[${i}]`;
    if (!isInt(w.x) || !isInt(w.y)) fail(`${at} bad coords`);
    if (w.side !== 'N' && w.side !== 'W') fail(`${at} side must be 'N' or 'W'`);
    if (!EDGE_TYPES.includes(w.type) || w.type === 'none') fail(`${at} bad type '${w.type}'`);
    if (!MATERIALS.includes(w.material)) fail(`${at} bad material '${w.material}'`);
    if (!(w.hp > 0 || w.maxHp > 0)) fail(`${at} needs hp`);
    const len = w.len ?? 1;
    if (!isInt(len) || len < 1) fail(`${at} bad len`);
    for (let k = 0; k < len; k++) {
      const x = w.side === 'N' ? w.x + k : w.x;
      const y = w.side === 'W' ? w.y + k : w.y;
      const ox = w.side === 'W' ? x - 1 : x;
      const oy = w.side === 'N' ? y - 1 : y;
      if (!grid.inBounds(x, y)) fail(`${at} edge (${x},${y},${w.side}) out of bounds`);
      if (!isFloor(x, y) && !isFloor(ox, oy)) fail(`${at} edge (${x},${y},${w.side}) borders no floor`);
      if ((w.type === 'door' || w.type === 'window') && !(isFloor(x, y) && isFloor(ox, oy))) {
        fail(`${at} ${w.type} at (${x},${y},${w.side}) must sit between two floor tiles`);
      }
    }
  }

  const seen = new Set();
  const covered = new Map();
  for (const p of lv.props ?? []) {
    const def = KNOWN_PROPS[p.kind];
    if (!def) fail(`prop ${p.id} has unknown kind '${p.kind}'`);
    if (p.id === undefined || seen.has(p.id)) fail(`prop id '${p.id}' missing or duplicate`);
    seen.add(p.id);
    const w = p.w ?? def.w;
    const d = p.d ?? def.d;
    for (let j = 0; j < d; j++) {
      for (let i = 0; i < w; i++) {
        const x = p.x + i;
        const y = p.y + j;
        if (!grid.inBounds(x, y)) fail(`prop ${p.id} out of bounds at (${x},${y})`);
        if (!isFloor(x, y)) fail(`prop ${p.id} on void tile (${x},${y})`);
        if (!def.blocks) continue;
        const k = `${x},${y}`;
        if (covered.has(k)) fail(`prop ${p.id} overlaps ${covered.get(k)} at (${x},${y})`);
        covered.set(k, p.id);
      }
    }
  }

  const t = lv.truck;
  if (!t) fail('missing truck');
  for (let j = 0; j < t.d; j++) {
    for (let i = 0; i < t.w; i++) if (!isFloor(t.x + i, t.y + j)) fail(`truck tile (${t.x + i},${t.y + j}) not on floor`);
  }
  if (!grid.isWalkable(t.dropX, t.dropY)) fail(`truck drop (${t.dropX},${t.dropY}) not walkable`);
  if (!Array.isArray(lv.spawns) || !lv.spawns.length) fail('missing spawns');
  for (const s of lv.spawns) if (!grid.isWalkable(s.x, s.y)) fail(`spawn (${s.x},${s.y}) not walkable`);
  const ids = new Set();
  for (const [i, insp] of (lv.inspectors ?? []).entries()) {
    const at = `inspectors[${i}]`;
    if (!insp.id || ids.has(insp.id)) fail(`${at} id missing or duplicate`);
    ids.add(insp.id);
    if (!(insp.speed > 0)) fail(`${at} needs speed > 0`);
    if (!Array.isArray(insp.path) || insp.path.length < 2) fail(`${at} needs at least 2 waypoints`);
    for (const w of insp.path) if (!grid.isWalkable(w.x, w.y)) fail(`${at} waypoint (${w.x},${w.y}) not walkable`);
  }
  if (lv.par !== undefined && !(lv.par > 0)) fail('par must be > 0');
  if (lv.crewCap !== undefined && (!isInt(lv.crewCap) || lv.crewCap < 1 || lv.crewCap > 60)) fail('crewCap must be an integer 1..60');
  if (lv.tutorial !== undefined) {
    const tu = lv.tutorial;
    if (!tu || typeof tu !== 'object') fail('tutorial must be an object');
    for (const k of ['breach', 'chainStart']) {
      if (tu[k] === undefined) continue;
      if (!isInt(tu[k].x) || !isInt(tu[k].y) || !grid.inBounds(tu[k].x, tu[k].y)) fail(`tutorial.${k} bad coords`);
      if (tu[k].side !== undefined && tu[k].side !== 'N' && tu[k].side !== 'W') fail(`tutorial.${k} side must be 'N' or 'W'`);
    }
    if (tu.heavy !== undefined && !seen.has(tu.heavy)) fail(`tutorial.heavy '${tu.heavy}' is not a prop id`);
  }
  return lv;
}

/**
 * Validate and build a Grid.
 * @param {object|string} json
 * @returns {Grid}
 */
export function loadLevel(json) {
  const lv = parseLevel(json);
  const grid = new Grid(lv);
  grid.inspectors = (lv.inspectors ?? []).map((i) => ({ id: i.id, speed: i.speed, path: i.path.map((w) => ({ x: w.x, y: w.y })) }));
  return grid;
}
