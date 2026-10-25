// Dev servers (localhost) must never run from cache: this worker clears itself and every imi-* cache,
// so a previously installed worker upgrades to a no-op instead of serving stale code.
if (/^(localhost|127\.0\.0\.1)$/.test(self.location.hostname) && !/[?&]sw=1/.test(self.location.search)) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      for (const k of await caches.keys()) if (k.startsWith('imi-')) await caches.delete(k);
      await self.registration.unregister();
      for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
    })());
  });
} else {
const VERSION = 'v2';
const CACHE = `imi-${VERSION}`;
// Hand-maintained; tests/pwa.test.js checks it covers src/main.js's import graph.
const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './src/data/crew-roles.js',
  './src/data/economy.js',
  './src/data/items.js',
  './src/data/jobs.js',
  './src/data/levels/dunmore-pike.json',
  './src/data/levels/fairfax-credit-union.json',
  './src/data/levels/gilded-trust-tower.json',
  './src/data/prop-visuals.js',
  './src/data/upgrades.js',
  './src/debug.js',
  './src/loop.js',
  './src/main.js',
  './src/platform/gestures.js',
  './src/platform/input.js',
  './src/platform/save.js',
  './src/platform/stage.js',
  './src/render/atlas.js',
  './src/render/camera.js',
  './src/render/crane-art.js',
  './src/render/director.js',
  './src/render/fx.js',
  './src/render/iso.js',
  './src/render/lod.js',
  './src/render/occlusion.js',
  './src/render/plan-renderer.js',
  './src/render/world-atlas.js',
  './src/render/world-renderer.js',
  './src/sim/auto.js',
  './src/sim/breach.js',
  './src/sim/chain.js',
  './src/sim/crane.js',
  './src/sim/crew.js',
  './src/sim/decoy.js',
  './src/sim/grid.js',
  './src/sim/inspector.js',
  './src/sim/items.js',
  './src/sim/job.js',
  './src/sim/level.js',
  './src/sim/modifiers.js',
  './src/sim/path.js',
  './src/sim/rig.js',
  './src/sim/stress.js',
  './src/sim/whistle.js',
  './src/sim/world.js',
  './src/ui/card.js',
  './src/ui/crane-ui.js',
  './src/ui/flow.js',
  './src/ui/hud.css',
  './src/ui/hud.js',
  './src/ui/modebar.css',
  './src/ui/modebar.js',
  './src/ui/loot.js',
  './src/ui/nudges.js',
  './src/ui/pick.js',
  './src/ui/screens.css',
  './src/ui/screens.js',
  './src/ui/tutorial.css',
  './src/ui/tutorial.js',
  './src/ui/tray.js',
  './src/vendor/crew-art.js',
  './src/platform/pwa.js',
  './src/platform/audio.js',
];
// Anything under these prefixes is also served from cache at runtime.
const PREFIX_RULES = ['./src/data/levels/']; // eslint-disable-line no-unused-vars

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // All-or-nothing: a missing file fails install so a half-cached shell is never activated.
    await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('imi-') && k !== CACHE && k !== 'imi-fonts').map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, 'imi-fonts').catch(() => Response.error()));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(request);
        if (res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch {
        return (await cache.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  event.respondWith(cacheFirst(request, CACHE).catch(() => Response.error()));
});
}
