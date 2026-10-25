/** Plain-language copy per input mode; shared by the mode banner and the tutorial. */
export const MODE_COPY = {
  breach: 'BREACH: TAP A WALL OR DOOR TO SMASH IT (OPENS SHORTCUTS)',
  rig: 'RIG: TAP A WINDOW. HEAVY ITEMS CAN BE SHOVED OUT IT',
  whistle: 'WHISTLE: TAP ONE HEAVY ITEM. EVERY IDLE MONKEY RUSHES IT AND LIFTS TOGETHER.',
  crane: 'CRANE: TAP A HEAVY ITEM. THE HELICOPTER AIRLIFTS IT TO THE TRUCK',
  decoy: 'DECOY: TAP THE INSPECTOR TO STALL HIM'
};
export const CHAIN_COPY = [
  'CHAIN 1/2: TAP A SPOT DEEP INSIDE THE OFFICE. THAT IS THE FAR END OF THE LINE',
  'CHAIN 2/2: TAP THE SAME SPOT AGAIN TO BUILD IT. MONKEYS FORM A RELAY LINE TO THE TRUCK AND PASS SMALL ITEMS ALONG IT'
];

/**
 * Pure description of the current input mode.
 * @param {string} mode 'none' | 'breach' | 'chain' | 'rig' | 'whistle' | 'crane' | 'decoy'
 * @param {{ chainPicked?: boolean }} [flow] chainPicked: first chain tap already previewed
 * @returns {{ mode: string, step: number, total: number, text: string }}
 */
export function describeMode(mode, { chainPicked = false } = {}) {
  if (mode === 'chain') {
    const step = chainPicked ? 2 : 1;
    return { mode, step, total: 2, text: CHAIN_COPY[step - 1] };
  }
  const text = MODE_COPY[mode];
  return text ? { mode, step: 1, total: 1, text } : { mode: 'none', step: 0, total: 0, text: '' };
}

/**
 * Banner under the quota bar. Shown for any non-'none' mode unless `covered`.
 * @param {HTMLElement} parent
 * @param {{ canvas: HTMLElement, width: number, height: number, k: number, onResize: (fn: () => void) => () => void }} stage
 */
export function createModeBar(parent, stage) {
  const root = document.createElement('div');
  root.className = 'hud modebar-root';
  parent.appendChild(root);
  const bar = document.createElement('div');
  bar.className = 'modebar px';
  bar.hidden = true;
  const tag = document.createElement('small');
  const txt = document.createElement('b');
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'cancel px';
  cancel.textContent = 'CANCEL';
  bar.append(tag, txt, cancel);
  root.appendChild(bar);

  function layout() {
    root.style.left = stage.canvas.style.left;
    root.style.top = stage.canvas.style.top;
    root.style.width = `${stage.width}px`;
    root.style.height = `${stage.height}px`;
    root.style.transform = `scale(${stage.k})`;
  }
  layout();
  const offResize = stage.onResize(layout);

  const view = {
    onCancel: null,
    /** @param {ReturnType<typeof describeMode>} d @param {boolean} [covered] */
    render(d, covered = false) {
      const show = d.mode !== 'none' && !covered;
      bar.hidden = !show;
      if (!show) return;
      tag.textContent = d.total > 1 ? `STEP ${d.step}/${d.total}` : 'TAP MODE';
      txt.textContent = d.text;
    },
    destroy() {
      offResize();
      root.remove();
    }
  };
  cancel.addEventListener('click', () => view.onCancel?.());
  return view;
}
