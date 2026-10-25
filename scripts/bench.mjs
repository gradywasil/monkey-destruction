// Sim benchmark: 100 crew + ~150 items on gilded-trust-tower for 60 simulated seconds.
// Usage: node scripts/bench.mjs [seconds] [--auto]   (--auto: the automation brain drives instead of the scripted commands)
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';

import { stressGrid, createDriver, DT } from '../src/sim/stress.js';

/** Build the stress scenario. @returns {{world:object, drive:(k:number)=>void, grid:object}} */
export function buildScenario({ crew = 100, items = 150, profile = false, auto = false } = {}) {
  const raw = readFileSync(new URL('../src/data/levels/gilded-trust-tower.json', import.meta.url), 'utf8');
  const grid = loadLevel(JSON.parse(raw));
  const roles = stressGrid(grid, { crew, items });
  const world = createWorld({ grid, roles, duration: 3600, profile, auto });
  // auto mode drives itself
  return { world, drive: auto ? () => {} : createDriver(world, grid), grid };
}

const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];

export function runBench(seconds = 60, opts = {}) {
  const { world, drive } = buildScenario({ profile: true, ...opts });
  const times = [];
  let cmd = 0;
  let snap = 0;
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    const c0 = performance.now();
    drive(i);
    cmd += performance.now() - c0;
    const t0 = performance.now();
    world.tick(DT);
    times.push(performance.now() - t0);
    const s0 = performance.now();
    world.snapshot();
    snap += performance.now() - s0;
  }
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((s, v) => s + v, 0) / times.length;
  return { world, mean, p95: pct(sorted, 0.95), max: sorted[sorted.length - 1], steps, prof: { ...world.prof, 'commands (drive)': cmd, snapshot: snap } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const auto = process.argv.includes('--auto');
  const seconds = Number(process.argv.find((a) => /^\d+$/.test(a))) || 60;
  runBench(2, { auto }); // warm-up JIT
  const r = runBench(seconds, { auto });
  const w = r.world;
  console.log(`crew=${w.crew.length} items=${w.items.list().length} sim=${seconds}s ticks=${r.steps} delivered=${w.items.totals.count}`);
  console.log(`tick ms  mean ${r.mean.toFixed(3)}  p95 ${r.p95.toFixed(3)}  max ${r.max.toFixed(3)}`);
  const rows = Object.entries(r.prof ?? {}).map(([k, v]) => ({ system: k, 'mean ms/tick': +(v / r.steps).toFixed(4), 'total ms': +v.toFixed(1) }));
  rows.sort((a, b) => b['total ms'] - a['total ms']);
  console.table(rows);
}
