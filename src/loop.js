/**
 * Create a fixed-step game loop.
 * @param {object} opts
 * @param {(dt: number) => void} opts.update fixed-step sim update (dt in seconds)
 * @param {(alpha: number, frameMs: number) => void} opts.render once per frame
 * @param {number} [opts.hz] sim rate
 * @param {number} [opts.maxFrameMs] frame time clamp
 * @param {number} [opts.maxSteps] max updates per frame
 * @param {{request: Function, cancel: Function}|Function} [opts.raf] injectable rAF
 * @param {() => number} [opts.now] injectable clock (ms)
 * @returns {{start: () => void, stop: () => void, isRunning: () => boolean, stats: object}}
 */
export function createLoop({ update, render, hz = 30, maxFrameMs = 250, maxSteps = 5, raf, now } = {}) {
  const request = raf?.request ?? raf ?? ((cb) => globalThis.requestAnimationFrame(cb));
  const cancel = raf?.cancel ?? ((id) => globalThis.cancelAnimationFrame?.(id));
  const clock = now ?? (() => performance.now());
  const step = 1000 / hz;
  const dt = 1 / hz;
  const stats = { fps: 0, updateMs: 0, renderMs: 0, steps: 0, frame: 0 };

  let running = false;
  let handle = null;
  let last = 0;
  let acc = 0;

  function tick() {
    if (!running) return;
    const t = clock();
    const frameMs = Math.min(Math.max(t - last, 0), maxFrameMs);
    last = t;
    acc += frameMs;

    const u0 = clock();
    let steps = 0;
    while (acc >= step - 1e-6 && steps < maxSteps) {
      update(dt);
      acc -= step;
      steps++;
    }
    if (acc >= step - 1e-6) acc = 0;
    if (acc < 0) acc = 0;
    const u1 = clock();

    render(acc / step, frameMs);
    const r1 = clock();

    stats.steps = steps;
    stats.updateMs = u1 - u0;
    stats.renderMs = r1 - u1;
    stats.frame++;
    if (frameMs > 0) {
      const inst = 1000 / frameMs;
      stats.fps = stats.fps ? stats.fps * 0.9 + inst * 0.1 : inst;
    }
    if (running) handle = request(tick);
  }

  function onVisibility() {
    if (document.hidden) {
      if (running && handle !== null) {
        cancel(handle);
        handle = null;
      }
    } else if (running && handle === null) {
      last = clock();
      handle = request(tick);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = clock();
      acc = 0;
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
      if (typeof document === 'undefined' || !document.hidden) handle = request(tick);
    },
    stop() {
      running = false;
      if (handle !== null) cancel(handle);
      handle = null;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    },
    isRunning: () => running,
    stats,
  };
}
