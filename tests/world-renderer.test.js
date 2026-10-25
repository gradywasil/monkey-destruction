import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Grid } from '../src/sim/grid.js';
import { LAYER, sortDrawables } from '../src/render/iso.js';
import {
  isFrontWall, edgeSpriteKey, collectWallDrawables, collectPropDrawables
} from '../src/render/world-renderer.js';

const level = JSON.parse(readFileSync(new URL('../src/data/levels/dunmore-pike.json', import.meta.url), 'utf8'));
const grid = new Grid(level);
const all = { minX: 0, minY: 0, maxX: grid.width - 1, maxY: grid.height - 1 };

test('isFrontWall classifies outer walls', () => {
  for (let x = 4; x <= 14; x++) assert.equal(isFrontWall(grid, x, 10, 'N'), true, `south ${x}`);
  for (let y = 2; y <= 9; y++) assert.equal(isFrontWall(grid, 15, y, 'W'), true, `east ${y}`);
  for (let x = 4; x <= 14; x++) assert.equal(isFrontWall(grid, x, 2, 'N'), false, `north ${x}`);
  for (let y = 2; y <= 7; y++) assert.equal(isFrontWall(grid, 4, y, 'W'), false, `west ${y}`);
});

test('edgeSpriteKey maps edge state to atlas keys', () => {
  const wall = (hp) => ({ type: 'wall', hp, maxHp: 100 });
  assert.equal(edgeSpriteKey(wall(100)), 'intact');
  assert.equal(edgeSpriteKey(wall(49)), 'damaged');
  assert.equal(edgeSpriteKey(wall(0)), 'broken');
  assert.equal(edgeSpriteKey({ type: 'window', hp: 30, maxHp: 30 }), 'window');
  assert.equal(edgeSpriteKey({ type: 'window', hp: 0, maxHp: 30 }), 'broken');
  assert.equal(edgeSpriteKey({ type: 'door', hp: 40, maxHp: 40, locked: true }), 'doorLocked');
  assert.equal(edgeSpriteKey({ type: 'door', hp: 40, maxHp: 40, locked: false }), 'door');
  assert.equal(edgeSpriteKey({ type: 'door', hp: 0, maxHp: 40, locked: true, broken: true }), 'doorBroken');
});

test('collectWallDrawables excludes front walls', () => {
  const walls = collectWallDrawables(grid, all);
  assert.ok(walls.length > 0);
  assert.ok(!walls.some((w) => w.kind === 'wallN' && w.gy === 10));
  assert.ok(!walls.some((w) => w.kind === 'wallW' && w.gx === 15));
  assert.ok(walls.some((w) => w.kind === 'wallN' && w.gy === 2));
});

test('monitors sit on desks', () => {
  const props = collectPropDrawables(grid, all);
  const mon = props.find((p) => p.key === 'monitor' && p.gx === 7 && p.gy === 2);
  assert.equal(mon.gz, 0.5);
  assert.ok(props.filter((p) => p.key !== 'monitor').every((p) => p.gz === 0));
});

test('depth sort places a monkey after its back wall and before a prop ahead', () => {
  const wall = { gx: 6, gy: 5, w: 1, d: 0, layer: LAYER.BACK_WALL, kind: 'wallN', key: 'intact' };
  const prop = { gx: 7, gy: 5, w: 1, d: 1, layer: LAYER.PROP, kind: 'prop', key: 'cab' };
  const monkey = { gx: 6.5, gy: 5.5, w: 0, d: 0, layer: LAYER.CHARACTER };
  const sorted = sortDrawables([prop, monkey, wall]);
  assert.deepEqual(sorted, [wall, monkey, prop]);
});
