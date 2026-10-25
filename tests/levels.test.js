import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadLevel } from '../src/sim/level.js';
import { createWorld } from '../src/sim/world.js';
import { JOBS } from '../src/data/jobs.js';

const dir = new URL('../src/data/levels/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const make = (f, open) => {
  const grid = loadLevel(JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
  if (open) {
    for (const [k, e] of [...grid.edges]) {
      if (e.type === 'wall' || e.type === 'door') e.broken = true;
    }
    grid.version++;
  }
  return createWorld({ grid, seed: 1 });
};

test('every job has a level file and every level file has a job', () => {
  assert.deepEqual(JOBS.map((j) => j.id).sort(), files.map((f) => f.replace('.json', '')).sort());
});

for (const f of files) {
  test(`${f}: quota is reachable and every item can be delivered once walls are open`, () => {
    const w0 = make(f, false);
    const total = w0.items.list().reduce((s, i) => s + i.value, 0);
    assert.ok(w0.job.quota <= total * 0.8, `quota ${w0.job.quota} vs total ${total}`);
    assert.ok(w0.snapshot().crew.length >= 8);
    const nearWindow = (it) => [[it.x, it.y, 'N'], [it.x, it.y, 'W'], [it.x + 1, it.y, 'W'], [it.x, it.y + 1, 'N']].some(([x, y, s]) => w0.grid.edge(x, y, s)?.type === 'window');
    for (const it of w0.items.list()) {
      const w = make(f, true);
      // boxed-in items beside a window are the intended rigger-only loot
      if (!w.path.adjacentTiles(it).length && nearWindow(it)) continue;
      let r = w.commands.haul(it.id);
      if (!r.ok) r = w.commands.whistle(it.id);
      assert.ok(r.ok, `${it.id} (${it.kind ?? it.type}): ${r.reason}`);
      for (let i = 0; i < 200 * 30 && w.items.get(it.id).state !== 'delivered'; i++) w.tick(1 / 30);
      assert.equal(w.items.get(it.id).state, 'delivered', `${it.id} not delivered`);
    }
  });
}
