/**
 * Pure pointer gesture state machine (tap, drag, long press, pinch). No DOM.
 * @param {{tapSlop?: number, longPressMs?: number, tapMaxMs?: number}} [opts]
 * @returns {{
 *   pointerDown: (id: *, x: number, y: number, t: number) => void,
 *   pointerMove: (id: *, x: number, y: number, t: number) => void,
 *   pointerUp: (id: *, x: number, y: number, t: number) => void,
 *   pointerCancel: (id: *) => void,
 *   tick: (t: number) => void,
 *   on: (type: string, fn: (e: object) => void) => () => void
 * }}
 */
export function createGestureRecognizer({ tapSlop = 8, longPressMs = 350, tapMaxMs = 300 } = {}) {
  const pointers = new Map();
  const handlers = new Map();
  // idle | pending | drag | long | pinch | dead (post-pinch, until all released)
  let mode = 'idle';
  let startT = 0;
  let lastX = 0;
  let lastY = 0;
  let pinchDist = 1;
  let prevDist = 1;
  let prevCx = 0;
  let prevCy = 0;

  function emit(type, payload) {
    const set = handlers.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }

  function on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => handlers.get(type).delete(fn);
  }

  function pair() {
    const [a, b] = [...pointers.values()];
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const dist = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1e-6);
    return { cx, cy, dist };
  }

  function endCurrent() {
    if (mode === 'drag') emit('dragend', { x: lastX, y: lastY });
    else if (mode === 'long') emit('longpressend', { x: lastX, y: lastY });
  }

  function startPinch() {
    endCurrent();
    const { cx, cy, dist } = pair();
    mode = 'pinch';
    pinchDist = prevDist = dist;
    prevCx = cx;
    prevCy = cy;
    emit('pinchstart', { cx, cy });
  }

  function leavePinch() {
    emit('pinchend', {});
    mode = pointers.size > 0 ? 'dead' : 'idle';
  }

  function pointerDown(id, x, y, t) {
    pointers.set(id, { x, y, sx: x, sy: y });
    if (pointers.size === 1) {
      mode = 'pending';
      startT = t;
      lastX = x;
      lastY = y;
    } else if (pointers.size === 2 && mode !== 'pinch') {
      startPinch();
    }
  }

  function pointerMove(id, x, y) {
    const p = pointers.get(id);
    if (!p) return;
    p.x = x;
    p.y = y;
    if (mode === 'pinch') {
      if (pointers.size < 2) return;
      const { cx, cy, dist } = pair();
      emit('pinch', {
        cx,
        cy,
        scale: dist / pinchDist,
        delta: dist / prevDist,
        dcx: cx - prevCx,
        dcy: cy - prevCy
      });
      prevDist = dist;
      prevCx = cx;
      prevCy = cy;
    } else if (mode === 'pending') {
      if (Math.hypot(x - p.sx, y - p.sy) > tapSlop) {
        mode = 'drag';
        emit('dragstart', { x: p.sx, y: p.sy });
        lastX = p.sx;
        lastY = p.sy;
        emit('drag', { x, y, dx: x - lastX, dy: y - lastY });
        lastX = x;
        lastY = y;
      }
    } else if (mode === 'drag') {
      emit('drag', { x, y, dx: x - lastX, dy: y - lastY });
      lastX = x;
      lastY = y;
    } else if (mode === 'long') {
      lastX = x;
      lastY = y;
      emit('longpressmove', { x, y });
    }
  }

  function release(id, x, y, t, cancelled) {
    const p = pointers.get(id);
    if (!p) return;
    if (x !== undefined) {
      p.x = x;
      p.y = y;
    }
    pointers.delete(id);
    if (mode === 'pinch') {
      if (pointers.size < 2) leavePinch();
      return;
    }
    if (mode === 'pending') {
      const withinSlop = Math.hypot(p.x - p.sx, p.y - p.sy) <= tapSlop;
      if (!cancelled && withinSlop && t - startT <= tapMaxMs) emit('tap', { x: p.x, y: p.y });
    } else if (mode === 'drag') {
      emit('dragend', { x: p.x, y: p.y });
    } else if (mode === 'long') {
      emit('longpressend', { x: p.x, y: p.y });
    }
    mode = pointers.size > 0 ? 'dead' : 'idle';
  }

  function pointerUp(id, x, y, t) {
    release(id, x, y, t, false);
  }

  function pointerCancel(id) {
    release(id, undefined, undefined, 0, true);
  }

  function tick(t) {
    if (mode === 'pending' && t - startT >= longPressMs) {
      mode = 'long';
      const p = [...pointers.values()][0];
      lastX = p.x;
      lastY = p.y;
      emit('longpressstart', { x: p.x, y: p.y });
    }
  }

  return { pointerDown, pointerMove, pointerUp, pointerCancel, tick, on };
}
