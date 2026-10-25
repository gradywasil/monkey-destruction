// Stress scenario shared by scripts/bench.mjs, tests/perf.test.js and the browser debug hook (window.__imi.stress).
const DT = 1 / 30;

/**
 * Pad a grid in place to `items` props (non-blocking duplicates) and `crew` spawns.
 * Call before createWorld. @returns {string[]} roles for createWorld
 */
export function stressGrid(grid, { crew = 100, items = 150 } = {}) {
  const free = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
    if (grid.isWalkable(x, y) && grid.tile(x, y).room !== null && !grid.props.some((p) => p.x === x && p.y === y)) free.push({ x, y });
  }
  for (let n = 0; grid.props.length < items; n++) {
    const t = free[(n * 7) % free.length];
    grid.addProp({ id: `dup${n}`, kind: n % 3 ? 'monitor' : 'copier', x: t.x, y: t.y });
  }
  const base = grid.spawns.slice();
  while (grid.spawns.length < crew) grid.spawns.push({ ...base[grid.spawns.length % base.length] });
  return Array.from({ length: crew }, (_, i) => (i < 8 ? 'breacher' : i < 12 ? 'rigger' : i < 14 ? 'decoy' : 'hauler'));
}

/** Command driver that keeps the crew busy; call drive(tickIndex) before each world.tick. */
export function createDriver(world, grid) {
  const edges = [...grid.edges].filter(([, e]) => e.type === 'window' || e.type === 'door').map(([k]) => {
    const [x, y, side] = k.split(',');
    return { x: +x, y: +y, side };
  });
  let chains = 0;
  return (k) => {
    if (k % 15 !== 0) return; // twice a second at 30 Hz
    const placed = world.items.placed();
    if (k === 0) for (const e of edges.slice(0, 8)) world.commands.breach(e);
    if (k % 60 === 0 && chains < 3) {
      const m = placed.find((it) => it.weight === 1);
      if (m && world.commands.chain.create({ x: m.x, y: m.y }).ok) chains++;
    }
    for (const it of placed.slice(0, 12)) {
      if (it.weight >= 4 && k % 240 === 0) world.commands.whistle(it.id);
      else world.commands.haul(it.id);
    }
  };
}

export { DT };
