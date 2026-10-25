// Scripted auto-mode playthrough: node scripts/auto-sim.mjs [level] [--boost]
import { readFileSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';
import { HIRE_ROLES } from '../src/data/economy.js';

const DT = 1 / 30;

/** Greedy policy: hire the cheapest useful role whenever affordable. */
export function makePolicy(world, { boosts = false } = {}) {
  const windows = [...world.grid.edges.values()].some((e) => e.type === 'window');
  const limit = { hauler: 8, breacher: 2, rigger: windows ? 1 : 0, decoy: Math.min(1, world.grid.inspectors?.length ?? 0) };
  return () => {
    const s = world.snapshot();
    const count = (r) => s.hire.roles[r].count;
    for (;;) {
      // sealed loot and no breacher yet: save for one instead of spending on cheaper hires
      const saving = s.hints.sealedValue > 0 && count('breacher') === 0 && count('hauler') >= 4;
      const useful = HIRE_ROLES.filter((r) => count(r) < limit[r] && (!saving || r === 'breacher')
        && (r !== 'breacher' || s.hints.sealedValue > 0)
        && (r !== 'rigger' || count('hauler') >= 4));
      useful.sort((a, b) => world.hireCost(a) - world.hireCost(b));
      const r = useful[0];
      if (!r || world.commands.hire(r).ok !== true) break;
      s.hire.roles[r].count++;
    }
    if (boosts) for (const id of ['speed', 'haggle']) while (world.commands.boost(id).ok) { /* spend */ }
  };
}

export function playLevel(file, { seconds = 1800, seed = 1, boosts = false, modifiers } = {}) {
  const grid = loadLevel(JSON.parse(readFileSync(new URL(`../src/data/levels/${file}.json`, import.meta.url), 'utf8')));
  const world = createWorld({ grid, auto: true, seed, modifiers });
  const policy = makePolicy(world, { boosts });
  let cleared = null;
  world.events.on('cleared', (e) => { cleared = e; });
  for (let i = 0, n = Math.round(seconds / DT); i < n && !cleared; i++) {
    if (i % 15 === 0) policy();
    world.tick(DT);
  }
  return { world, cleared };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv[2] && !process.argv[2].startsWith('--') ? [process.argv[2]] : ['dunmore-pike', 'fairfax-credit-union', 'gilded-trust-tower'];
  for (const f of files) {
    const { world, cleared } = playLevel(f, { boosts: process.argv.includes('--boost') });
    const s = world.snapshot();
    const crew = Object.fromEntries(Object.entries(s.hire.roles).map(([r, v]) => [r, v.count]));
    console.log(f, cleared ? `cleared ${(cleared.elapsed / 60).toFixed(1)} min stars ${cleared.stars} profit ${cleared.profit}` : `NOT cleared stripped ${s.economy.stripped.toFixed(2)}`, JSON.stringify(crew), 'fines', s.economy.fines, 'par', s.economy.par);
  }
}
