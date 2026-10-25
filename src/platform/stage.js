const REF = { w: 390, h: 844 };
const MAX_ASPECT = 0.75;

/**
 * Pure layout computation for the pixel-perfect stage.
 * @param {{vw:number, vh:number, dpr:number, ref?:{w:number,h:number}, maxAspect?:number}} p
 * @returns {{k:number,width:number,height:number,cssWidth:number,cssHeight:number,offsetX:number,offsetY:number,backingWidth:number,backingHeight:number}}
 */
export function computeLayout({ vw, vh, dpr, ref = REF, maxAspect = MAX_ASPECT }) {
  const k = Math.max(1, Math.floor(Math.min(vw / ref.w, vh / ref.h)));
  let width = Math.floor(vw / k);
  const height = Math.floor(vh / k);
  if (width / height > maxAspect) width = Math.floor(height * maxAspect);
  const cssWidth = width * k;
  const cssHeight = height * k;
  return {
    k,
    width,
    height,
    cssWidth,
    cssHeight,
    offsetX: Math.floor((vw - cssWidth) / 2),
    offsetY: Math.floor((vh - cssHeight) / 2),
    backingWidth: Math.round(width * k * dpr),
    backingHeight: Math.round(height * k * dpr),
  };
}

function measureSafeArea(parent) {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:0;top:0;width:0;height:0;'
    + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
  parent.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v) => parseFloat(v) || 0;
  const area = {
    top: px(cs.paddingTop),
    right: px(cs.paddingRight),
    bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft),
  };
  probe.remove();
  return area;
}

/**
 * Creates a pixel-perfect canvas stage inside parent.
 * Drawing code uses logical art-pixel coordinates.
 * @param {HTMLElement} parent
 * @param {{ref?:{w:number,h:number}, maxAspect?:number}} [opts]
 */
export function createStage(parent, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.imageRendering = 'pixelated';
  canvas.style.touchAction = 'none';
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const listeners = new Set();
  const vv = window.visualViewport;
  let layout = null;
  let dpr = 1;
  let safeArea = { top: 0, right: 0, bottom: 0, left: 0 };
  let raf = 0;

  const stage = {
    canvas,
    ctx,
    get width() { return layout.width; },
    get height() { return layout.height; },
    get k() { return layout.k; },
    get dpr() { return dpr; },
    get safeArea() { return safeArea; },
    onResize(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    toLogical(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: (clientX - r.left) / layout.k, y: (clientY - r.top) / layout.k };
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      if (vv) vv.removeEventListener('resize', schedule);
      listeners.clear();
      canvas.remove();
    },
  };

  function apply() {
    raf = 0;
    dpr = window.devicePixelRatio || 1;
    const vw = vv ? vv.width : window.innerWidth;
    const vh = vv ? vv.height : window.innerHeight;
    layout = computeLayout({ vw, vh, dpr, ref: opts.ref, maxAspect: opts.maxAspect });
    canvas.style.left = `${layout.offsetX}px`;
    canvas.style.top = `${layout.offsetY}px`;
    canvas.style.width = `${layout.cssWidth}px`;
    canvas.style.height = `${layout.cssHeight}px`;
    canvas.width = layout.backingWidth;
    canvas.height = layout.backingHeight;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(layout.k * dpr, 0, 0, layout.k * dpr, 0, 0);
    safeArea = measureSafeArea(parent);
    for (const fn of [...listeners]) fn(stage);
  }

  function schedule() {
    if (!raf) raf = requestAnimationFrame(apply);
  }

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  if (vv) vv.addEventListener('resize', schedule);
  apply();
  return stage;
}
