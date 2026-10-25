import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
const listed = new Set([...sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
const prefixes = [...sw.match(/const PREFIX_RULES = \[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
const covered = (f) => listed.has(f) || prefixes.some((p) => f.startsWith(p));

function graph(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const src = readFileSync(entry, 'utf8');
  for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g)) {
    graph(resolve(dirname(entry), m[1] || m[2]), seen);
  }
  return seen;
}

test('precache covers main.js import graph, pwa.js, and shell files', () => {
  const files = [...graph(resolve(root, 'src/main.js'))].map((f) => relative(root, f));
  files.push('src/platform/pwa.js', 'index.html', 'manifest.webmanifest');
  for (const f of files) assert.ok(covered(f), `${f} missing from sw.js PRECACHE`);
});

test('every precache entry exists on disk', () => {
  for (const f of listed) assert.ok(existsSync(resolve(root, f)), `${f} listed but missing`);
});

test('level JSONs and css and manifest icons are precached', () => {
  for (const f of ['src/data/levels/dunmore-pike.json', 'src/data/levels/gilded-trust-tower.json', 'src/data/levels/fairfax-credit-union.json', 'src/ui/hud.css', 'src/ui/screens.css']) assert.ok(covered(f), f);
  const m = JSON.parse(readFileSync(resolve(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.orientation, 'portrait');
  assert.equal(m.theme_color, '#181425');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
  for (const i of m.icons) assert.ok(listed.has(i.src), i.src);
});
