/**
 * Create a toggleable debug stats overlay.
 * @param {HTMLElement} parent
 * @param {() => object} getStats returns fps, updateMs, renderMs and any extra fields
 * @returns {{toggle: () => void, setVisible: (v: boolean) => void, destroy: () => void}}
 */
export function createDebugOverlay(parent, getStats) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed',
    'top:env(safe-area-inset-top,0px)',
    'left:env(safe-area-inset-left,0px)',
    'margin:4px',
    'padding:4px 6px',
    'font:10px monospace',
    'color:#fee761',
    'background:rgba(0,0,0,0.6)',
    'white-space:pre',
    'pointer-events:none',
    'z-index:1000',
    'display:none',
  ].join(';');
  parent.appendChild(el);

  const core = new Set(['fps', 'updateMs', 'renderMs']);
  let visible = false;

  function refresh() {
    if (!visible) return;
    const s = getStats() ?? {};
    const lines = [
      `fps ${(s.fps ?? 0).toFixed(1)}`,
      `sim ms ${(s.updateMs ?? 0).toFixed(2)}`,
      `render ms ${(s.renderMs ?? 0).toFixed(2)}`,
    ];
    for (const [k, v] of Object.entries(s)) {
      if (core.has(k)) continue;
      lines.push(`${k} ${typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(2) : v}`);
    }
    el.textContent = lines.join('\n');
  }

  function setVisible(v) {
    visible = !!v;
    el.style.display = visible ? 'block' : 'none';
    refresh();
  }

  const onKey = (e) => {
    if (e.key === '`') setVisible(!visible);
  };
  if (typeof window !== 'undefined') window.addEventListener('keydown', onKey);
  const timer = setInterval(refresh, 250);

  return {
    toggle: () => setVisible(!visible),
    setVisible,
    destroy() {
      clearInterval(timer);
      if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
      el.remove();
    },
  };
}
