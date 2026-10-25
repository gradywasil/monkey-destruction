import { createGestureRecognizer } from './gestures.js';

/**
 * Binds pointer and wheel events on a DOM target to a gesture recognizer.
 * @param {HTMLElement} target
 * @param {{toLogical?: (cx: number, cy: number) => {x: number, y: number}}} [opts]
 * @returns {{on: (type: string, fn: (e: object) => void) => () => void, destroy: () => void}}
 */
export function createInput(target, { toLogical = (x, y) => ({ x, y }), ...gestureOpts } = {}) {
  const rec = createGestureRecognizer(gestureOpts);
  const wheelHandlers = new Set();
  const down = new Set();
  let raf = 0;

  target.style.touchAction = 'none';

  function loop() {
    rec.tick(performance.now());
    raf = down.size > 0 ? requestAnimationFrame(loop) : 0;
  }

  function onDown(e) {
    const { x, y } = toLogical(e.clientX, e.clientY);
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // pointer may already be gone
    }
    down.add(e.pointerId);
    rec.pointerDown(e.pointerId, x, y, e.timeStamp);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function onMove(e) {
    if (!down.has(e.pointerId)) return;
    const { x, y } = toLogical(e.clientX, e.clientY);
    rec.pointerMove(e.pointerId, x, y, e.timeStamp);
  }

  function onUp(e) {
    if (!down.delete(e.pointerId)) return;
    const { x, y } = toLogical(e.clientX, e.clientY);
    rec.pointerUp(e.pointerId, x, y, e.timeStamp);
  }

  function onCancel(e) {
    if (!down.delete(e.pointerId)) return;
    rec.pointerCancel(e.pointerId);
  }

  function onWheel(e) {
    e.preventDefault();
    const { x, y } = toLogical(e.clientX, e.clientY);
    const payload = { x, y, deltaY: e.deltaY, scale: Math.exp(-e.deltaY * 0.0015) };
    for (const fn of [...wheelHandlers]) fn(payload);
  }

  function onContext(e) {
    e.preventDefault();
  }

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', onUp);
  target.addEventListener('pointercancel', onCancel);
  target.addEventListener('wheel', onWheel, { passive: false });
  target.addEventListener('contextmenu', onContext);

  return {
    on(type, fn) {
      if (type !== 'wheel') return rec.on(type, fn);
      wheelHandlers.add(fn);
      return () => wheelHandlers.delete(fn);
    },
    destroy() {
      target.removeEventListener('pointerdown', onDown);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onCancel);
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('contextmenu', onContext);
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      wheelHandlers.clear();
      down.clear();
    }
  };
}
