import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Grid } from '../src/sim/grid.js';
import { createCamera } from '../src/render/camera.js';
import { createPlanRenderer } from '../src/render/plan-renderer.js';

const level = JSON.parse(readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8'));

function stubCtx(log) {
  const fn = (name) => (...a) => log.push([name, ...a]);
  return new Proxy({ canvas: { width: 390, height: 844 } }, {
    get: (t, k) => (k in t ? t[k] : fn(k)),
    set: (t, k, v) => ((t[k] = v), true)
  });
}

test('plan renderer draws the layer rotated 90deg CCW and keeps sprites upright', () => {
  globalThis.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; this.ctx = stubCtx([]); } getContext() { return this.ctx; } };
  const grid = new Grid(level);
  const sprite = { canvas: {}, sx: 0, sy: 0, w: 10, h: 10, ax: 5, ay: 10 };
  const r = createPlanRenderer({ grid, crewAtlas: { get: () => sprite } });
  const camera = createCamera({ viewW: 390, viewH: 844, gridW: grid.width, gridH: grid.height });
  camera.setProjection('top');
  camera.fitPlan();
  const log = [];
  const ctx = stubCtx(log);
  r.draw(ctx, camera, [{ crew: { variant: 0, pose: 'idle' }, gx: 4, gy: 3, gz: 0 }]);
  const rot = log.findIndex((e) => e[0] === 'rotate');
  assert.ok(rot >= 0 && Math.abs(log[rot][1] + Math.PI / 2) < 1e-9);
  const drawn = log.filter((e) => e[0] === 'drawImage');
  assert.equal(drawn.length, 2);
  const after = log.slice(log.findIndex((e) => e[0] === 'restore', rot));
  assert.ok(!after.some((e) => e[0] === 'rotate'));
  const t = camera.transform();
  const p = camera.gridToScreen(4, 3);
  const [, , , , , , dx, dy] = drawn[1];
  assert.ok(Math.abs(t.originX + (dx + 5) * t.scale - p.x) <= 1);
  assert.ok(Math.abs(t.originY + (dy + 10 - Math.round(0.42 * 32)) * t.scale - p.y) <= 1);
  assert.deepEqual(r.pickTile(p.x, p.y, camera), { x: 4, y: 3 });
});
