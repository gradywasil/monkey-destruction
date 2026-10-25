import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCamera, STOPS } from '../src/render/camera.js';
import { WALL_HEIGHT, LODS } from '../src/render/lod.js';

const make = (o = {}) => createCamera({ viewW: 390, viewH: 844, gridW: 16, gridH: 12, ...o });
const run = (cam, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) cam.update(dt); };

test('lod/scale math', () => {
  for (const [z, lod, scale] of [[1.6, 'hi', 1], [3.2, 'hi', 2], [1.1, 'lo', 1.1]]) {
    const cam = make({ initial: { z } });
    assert.equal(cam.state.lod, lod);
    assert.ok(Math.abs(cam.state.scale - scale) < 1e-12);
  }
});

test('zoomBy keeps point under cursor fixed', () => {
  const cam = make({ viewW: 1600, viewH: 1600, gridW: 200, gridH: 200, initial: { z: 1.05 } });
  for (const [f, px, py] of [[1.1, 700, 800], [1.15, 900, 700], [1.3, 820, 760], [0.8, 760, 820]]) {
    const before = cam.screenToGrid(px, py);
    cam.zoomBy(f, px, py);
    const z = cam.state.z;
    assert.ok(Math.abs(z - Math.round(z)) > 0.01 && Math.abs(cam.state.scale - Math.round(cam.state.scale)) > 0.01);
    const after = cam.screenToGrid(px, py);
    assert.ok(Math.abs(before.x - after.x) < 1e-6 && Math.abs(before.y - after.y) < 1e-6, `z=${z}`);
  }
});

test('endGesture snaps to a stop, pixel-aligned', () => {
  for (const z0 of [1.1, 1.4, 2.0, 2.9]) {
    const cam = make({ initial: { z: 1 } });
    cam.zoomBy(z0, 195, 422);
    cam.endGesture();
    assert.ok(cam.isBusy());
    run(cam, 0.5);
    assert.ok(!cam.isBusy());
    assert.ok(STOPS.includes(cam.state.z));
    const t = cam.transform();
    assert.equal(t.scale, Math.round(t.scale));
    assert.ok(Number.isInteger(t.originX) && Number.isInteger(t.originY));
    assert.equal(t.blend, 1);
  }
});

test('no tween when within 0.01 of a stop', () => {
  const cam = make({ initial: { z: 1.605 } });
  cam.endGesture();
  assert.ok(!cam.isBusy());
  assert.equal(cam.state.z, 1.6);
});

test('hysteresis around 1.25', () => {
  const cam = make({ initial: { z: 1.25 } });
  let switches = 0;
  cam.onLodChange(() => switches++);
  for (let i = 0; i < 50; i++) cam.zoomBy(i % 2 ? 1.03 : 1 / 1.03, 195, 422);
  assert.ok(switches <= 1);
  const t = cam.transform();
  assert.equal(t.blend, 1);
});

test('lod switch blends', () => {
  const cam = make({ initial: { z: 1.25 } });
  cam.zoomBy(1.1);
  const t = cam.transform();
  assert.equal(t.lod, 'hi');
  assert.equal(t.prevLod, 'lo');
  assert.equal(t.blend, 0);
  run(cam, 0.2);
  assert.equal(cam.transform().blend, 1);
  assert.equal(cam.transform().prevLod, 'hi');
});

test('panBy clamps and centres small levels', () => {
  const cam = make({ initial: { z: 3.2 } });
  cam.panBy(-1e5, -1e5);
  const a = cam.state;
  cam.panBy(-1e5, -1e5);
  assert.equal(cam.state.cx, a.cx);
  assert.equal(cam.state.cy, a.cy);
  cam.panBy(2e5, 2e5);
  assert.notEqual(cam.state.cx, a.cx);
  // At z=1 lo, the 16x12 level (560 px wide) is wider than 390 but shorter than 844.
  const small = make({ initial: { z: 1 } });
  small.panBy(0, 5000);
  const s1 = small.state;
  small.panBy(0, -5000);
  const t = small.transform();
  const midY = (-WALL_HEIGHT * LODS.lo.heightPx + 280) / 2;
  assert.ok(Math.abs(t.originY + midY - 422) <= 0.5);
  assert.ok(Math.abs(small.state.cx + small.state.cy - (s1.cx + s1.cy)) < 1e-9);
});

test('fling decays and stops', () => {
  const cam = make({ viewW: 200, viewH: 200, gridW: 64, gridH: 64, initial: { z: 1 } });
  const c0 = cam.state;
  cam.fling(300, 0);
  run(cam, 0.05);
  assert.ok(cam.isBusy());
  run(cam, 3);
  assert.ok(!cam.isBusy());
  assert.notEqual(cam.state.cx, c0.cx);
});

test('focus reaches target', () => {
  const cam = make({ viewW: 200, viewH: 200, gridW: 64, gridH: 64 });
  cam.focus(20, 30, { stop: 2 });
  run(cam, 0.6);
  assert.ok(!cam.isBusy());
  assert.equal(cam.state.cx, 20);
  assert.equal(cam.state.cy, 30);
  assert.equal(cam.state.z, 3.2);
});

test('visibleTileRect contains centre and stays in bounds', () => {
  for (const z of [1, 1.6, 3.2]) {
    const cam = make({ initial: { z, cx: 3, cy: 9 } });
    const r = cam.visibleTileRect();
    const c = cam.screenToGrid(195, 422);
    assert.ok(r.minX <= Math.floor(c.x) && Math.floor(c.x) <= r.maxX);
    assert.ok(r.minY <= Math.floor(c.y) && Math.floor(c.y) <= r.maxY);
    assert.ok(r.minX >= 0 && r.minY >= 0 && r.maxX <= 15 && r.maxY <= 11);
  }
});

test('screenToGrid inverts gridToScreen', () => {
  for (const z of [1, 1.17, 1.6, 2.4, 3.2]) {
    const cam = make({ initial: { z } });
    for (const [x, y, h] of [[0, 0, 0], [3.5, 7.25, 0], [15, 11, 2]]) {
      const s = cam.gridToScreen(x, y, h);
      const g = cam.screenToGrid(s.x, s.y, h);
      assert.ok(Math.abs(g.x - x) < 1e-9 && Math.abs(g.y - y) < 1e-9);
    }
  }
});

test('top projection: round-trip, orthographic axes, z lifts upward', () => {
  for (const z of [1, 1.6, 3.2, 2.2]) {
    const cam = make({ initial: { cx: 7, cy: 5, z } });
    cam.setProjection('top');
    assert.equal(cam.getProjection(), 'top');
    assert.equal(cam.state.projection, 'top');
    for (const [gx, gy] of [[3.5, 4.5], [10.2, 2.1], [7, 5]]) {
      const p = cam.gridToScreen(gx, gy);
      const g = cam.screenToGrid(p.x, p.y);
      assert.ok(Math.abs(g.x - gx) < 1e-6 && Math.abs(g.y - gy) < 1e-6);
      const lifted = cam.gridToScreen(gx, gy, 1);
      assert.ok(lifted.y < p.y && lifted.x === p.x);
      assert.ok(cam.gridToScreen(gx + 1, gy).y < p.y && cam.gridToScreen(gx, gy + 1).x > p.x);
      const g2 = cam.screenToGrid(lifted.x, lifted.y, 1);
      assert.ok(Math.abs(g2.x - gx) < 1e-6 && Math.abs(g2.y - gy) < 1e-6);
    }
    const a = cam.gridToScreen(4, 4);
    const b = cam.gridToScreen(5, 5);
    assert.ok(Math.abs((b.x - a.x) + (b.y - a.y)) < 1e-9);
  }
});

test('top projection tile sizes: 32 lo / 48 hi at stops', () => {
  const lo = make({ initial: { z: 1 } });
  lo.setProjection('top');
  assert.equal(Math.round(lo.gridToScreen(0, 1).x - lo.gridToScreen(0, 0).x), 32);
  const hi = make({ initial: { z: 1.6 } });
  hi.setProjection('top');
  assert.equal(hi.state.lod, 'hi');
  assert.equal(Math.round(hi.gridToScreen(0, 1).x - hi.gridToScreen(0, 0).x), 48);
});

test('setProjection keeps the focused world point at the same place', () => {
  const cam = make({ initial: { cx: 8, cy: 6, z: 1.6 } });
  const before = cam.state;
  cam.setProjection('top');
  assert.ok(Math.abs(cam.state.cx - before.cx) < 1e-6 && Math.abs(cam.state.cy - before.cy) < 1e-6);
  const c = cam.gridToScreen(8, 6);
  assert.ok(Math.abs(c.x - 195) <= 1 && Math.abs(c.y - 422) <= 1);
  cam.setProjection('iso');
  assert.equal(cam.getProjection(), 'iso');
  assert.throws(() => cam.setProjection('side'));
});

test('top projection: visibleTileRect covers the view and pan clamps to the grid', () => {
  const cam = make({ initial: { cx: 8, cy: 6, z: 1 } });
  cam.setProjection('top');
  const r = cam.visibleTileRect(0);
  assert.ok(r.minX <= 0 && r.maxX >= 15 && r.minY <= 0 && r.maxY >= 11);
  cam.panBy(-5000, -5000);
  assert.ok(cam.state.cx <= 16 && cam.state.cy <= 12 && cam.state.cx >= 0);
});

test('top rotated: truck side (gx=0) at bottom, bounds are h wide x w tall', () => {
  const cam = make({ initial: { cx: 8, cy: 6, z: 1 } });
  cam.setProjection('top');
  const a = cam.gridToScreen(0, 6);
  const b = cam.gridToScreen(16, 6);
  assert.ok(a.y > b.y);
  assert.equal(Math.round(a.y - b.y), 16 * 32);
  assert.equal(Math.round(cam.gridToScreen(0, 12).x - cam.gridToScreen(0, 0).x), 12 * 32);
  cam.panBy(-5000, 5000);
  const c = cam.gridToScreen(8, 6);
  assert.ok(c.x > -400 && c.x < 800 && c.y > -500 && c.y < 1500);
});

test('top rotated: round-trip at both LODs and several gz', () => {
  for (const z of [1, 1.6]) {
    const cam = make({ initial: { cx: 8, cy: 6, z } });
    cam.setProjection('top');
    for (const gz of [0, 0.5, 3, 9]) {
      for (const [gx, gy] of [[0, 0], [15.5, 11.5], [4.25, 7.75]]) {
        const p = cam.gridToScreen(gx, gy, gz);
        const g = cam.screenToGrid(p.x, p.y, gz);
        assert.ok(Math.abs(g.x - gx) < 1e-6 && Math.abs(g.y - gy) < 1e-6);
      }
    }
  }
});

test('insets: focus puts the point at the band centre; fitted floor is centred in band', () => {
  const cam = make({ initial: { z: 1 } });
  cam.setProjection('top');
  cam.setInsets({ top: 110, bottom: 170 });
  const mid = 110 + (844 - 280) / 2;
  assert.equal(cam.viewCenter().y, mid);
  cam.focus(8, 6, { stop: null, duration: 1e-6 });
  cam.update(1);
  const p = cam.gridToScreen(8, 6);
  assert.ok(Math.abs(p.x - 195) <= 1 && Math.abs(p.y - mid) <= 1);
  cam.fitPlan();
  assert.equal(cam.state.lod, 'lo');
  const t = cam.gridToScreen(0, 0).y;
  const bt = cam.gridToScreen(16, 0).y;
  assert.ok(Math.abs((t + bt) / 2 - mid) <= 1);
  assert.ok(Math.abs(cam.gridToScreen(0, 0).x - (195 - 6 * 32)) <= 1);
});
