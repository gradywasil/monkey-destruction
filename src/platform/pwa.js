// PWA glue: service worker registration, update banner, install button, iOS hint.
const CSS = `
.pwa-ui{position:fixed;z-index:60;font-family:Silkscreen,ui-monospace,monospace;font-size:10px;line-height:1;color:#ead4aa}
.pwa-ui button{font:inherit;color:inherit;background:#262b44;border:3px solid #181425;box-shadow:inset 0 3px 0 #3a4466,inset 0 -3px 0 #181425;padding:10px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pwa-ui button:active{transform:translateY(2px)}
.pwa-install{top:calc(8px + env(safe-area-inset-top));right:calc(8px + env(safe-area-inset-right));color:#fee761}
.pwa-banner{left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));display:flex;gap:6px;align-items:stretch;max-width:92vw}
.pwa-banner .msg{background:#3a4466;color:#fff;padding:10px 12px;border:3px solid #181425;text-align:center}
.pwa-banner .x{color:#8b9bb4}
`;

const el = (cls, tag = 'div') => {
  const n = document.createElement(tag);
  n.className = `pwa-ui ${cls}`;
  return n;
};
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIosSafari = () => {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
};

function banner(text, actionLabel, onAction, onClose) {
  const b = el('pwa-banner');
  b.setAttribute('role', 'status');
  const msg = document.createElement(onAction ? 'button' : 'div');
  msg.className = 'msg';
  msg.textContent = text;
  if (onAction) msg.addEventListener('click', onAction);
  b.append(msg);
  if (onClose) {
    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = 'X';
    x.setAttribute('aria-label', 'Dismiss');
    x.addEventListener('click', () => { b.remove(); onClose(); });
    b.append(x);
  }
  document.body.append(b);
  return b;
}

// HUD/screens are CSS-scaled by the stage's integer k, so env() insets (device px) must be divided by k.
function trackScale() {
  const sync = () => {
    const m = /scale\(([\d.]+)\)/.exec(document.querySelector('.hud')?.style.transform || '');
    if (m) document.documentElement.style.setProperty('--k', m[1]);
  };
  new MutationObserver(sync).observe(document.getElementById('app') || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  sync();
}

export function initPwa({ swUrl = 'sw.js', storage = localStorage } = {}) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  trackScale();

  // Install button (Chrome/Android/desktop)
  let deferred = null;
  let btn = null;
  const syncBtn = () => {
    if (deferred && !isStandalone()) {
      if (!btn) {
        btn = el('pwa-install', 'button');
        btn.textContent = 'INSTALL';
        btn.addEventListener('click', async () => {
          if (!deferred) return;
          const ev = deferred;
          deferred = null;
          syncBtn();
          ev.prompt();
          await ev.userChoice?.catch(() => {});
        });
      }
      if (!btn.isConnected) document.body.append(btn);
    } else if (btn) btn.remove();
  };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; syncBtn(); });
  window.addEventListener('appinstalled', () => { deferred = null; syncBtn(); });

  // iOS hint
  const HINT_KEY = 'imi.iosHintSeen';
  if (isIosSafari() && !isStandalone() && !storage.getItem(HINT_KEY)) {
    banner('SHARE → ADD TO HOME SCREEN', null, null, () => storage.setItem(HINT_KEY, '1'));
  }

  // Service worker
  const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const secure = location.protocol === 'https:' && !local;
  if (!('serviceWorker' in navigator)) return;
  if (!secure && !(local && /[?&]sw=1/.test(location.search))) {
    // dev server: a cached service worker would serve stale code, so clear any left over
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    caches?.keys().then((ks) => ks.filter((k) => k.startsWith('imi-')).forEach((k) => caches.delete(k)));
    return;
  }
  navigator.serviceWorker.register(swUrl).then((reg) => {
    let shown = false;
    const offer = (worker) => {
      if (shown || !worker) return;
      shown = true;
      banner('UPDATE READY — TAP TO RELOAD', null, () => {
        navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
        worker.postMessage('SKIP_WAITING');
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch((err) => console.warn('SW registration failed', err));
}
