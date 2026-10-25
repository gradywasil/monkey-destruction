export const FOCUS_CLASS = 'hint';

/**
 * focus: HUD element to pulse ('hire:<role>' | 'whistle' | 'objective'). target: what the in-world arrow points at
 * ('item' | 'truck' | key of the level's `tutorial` object). until: event name (or list) that completes the step.
 * afterS: the step completes on its own after this many seconds, so the player is never stuck on it.
 * silent: no bubble (a nudge banner explains it).
 */
export const TUTORIAL_STEPS = [
  { id: 'pick', text: 'TAP A PIECE OF LOOT', target: 'item', until: 'card' },
  { id: 'pin', text: 'TAP HAUL NEXT. MONKEYS GO THERE FIRST', target: 'item', until: 'pin', afterS: 25 },
  { id: 'hire', text: 'LOOT SELLS FOR CASH. TAP HIRE FOR A NEW MONKEY', focus: 'hire:hauler', until: 'hire', afterS: 120 },
  { id: 'work', text: 'HIRED MONKEYS WORK ALONE. WATCH THE STRIPPED % GROW', focus: 'objective', until: 'never', afterS: 8 },
  { id: 'breacher', silent: true, until: 'nudge:sealed' }
];

/**
 * Pure tutorial step machine.
 * @param {{ steps?: typeof TUTORIAL_STEPS, startAt?: number }} [opts]
 */
export function createTutorial({ steps = TUTORIAL_STEPS, startAt = 0 } = {}) {
  let i = Math.max(0, startAt);
  let ended = i >= steps.length;
  let waited = 0;
  const subs = new Set();
  const current = () => (ended ? null : steps[i]);
  const emit = () => subs.forEach((fn) => fn(current(), i));
  const finish = () => {
    ended = true;
    i = steps.length;
    emit();
  };
  const advance = () => {
    waited = 0;
    i += 1;
    if (i >= steps.length) finish();
    else emit();
  };
  const matches = (step, type) => (Array.isArray(step.until) ? step.until.includes(type) : step.until === type);
  return {
    start() {
      emit();
    },
    feed(type) {
      if (ended || !matches(steps[i], type)) return;
      advance();
    },
    /** Time passes; steps with `afterS` complete by themselves. */
    tick(dt) {
      if (ended || !steps[i].afterS) return;
      waited += dt;
      if (waited >= steps[i].afterS) advance();
    },
    /** Step back one. */
    back() {
      if (ended || i === 0) return;
      i -= 1;
      waited = 0;
      emit();
    },
    current,
    index: () => i,
    skip() {
      if (!ended) finish();
    },
    done: () => ended,
    onChange(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

/**
 * Coach bubble positioned by step.focus, inside a root scaled like the HUD.
 * @param {HTMLElement} parent
 * @param {{ canvas: HTMLElement, width: number, height: number, k: number, onResize: (fn: () => void) => () => void }} stage
 */
export function createTutorialView(parent, stage) {
  const root = document.createElement('div');
  root.className = 'hud tut';
  parent.appendChild(root);

  function layout() {
    root.style.left = stage.canvas.style.left;
    root.style.top = stage.canvas.style.top;
    root.style.width = `${stage.width}px`;
    root.style.height = `${stage.height}px`;
    root.style.transform = `scale(${stage.k})`;
  }
  layout();
  const offResize = stage.onResize(layout);

  const view = { onSkip: null };
  let bubble = null;
  let txt = null;

  let side = null;
  /** Move the bubble to the screen half away from the arrow target. @param {'high'|'low'} next */
  view.place = (next) => {
    side = next;
    if (bubble) bubble.className = `coach px ${side}`;
  };
  view.show = (step) => {
    view.hide();
    side = null;
    if (!step || step.silent) return;
    const low = /^(hire:|tray)/.test(step.focus ?? '');
    bubble = document.createElement('div');
    bubble.className = `coach px ${side ?? (low ? 'low' : 'high')}`;
    const idx = Math.max(0, TUTORIAL_STEPS.findIndex((s) => s.id === step.id));
    const tag = document.createElement('small');
    tag.textContent = `STEP ${idx + 1}/${TUTORIAL_STEPS.length}`;
    txt = document.createElement('b');
    txt.textContent = step.text;
    const skip = document.createElement('button');
    skip.className = 'skip px';
    skip.textContent = 'SKIP';
    skip.onclick = () => view.onSkip && view.onSkip();
    const arrow = document.createElement('i');
    arrow.className = 'arrow';
    bubble.append(tag, txt, skip, arrow);
    root.appendChild(bubble);
  };
  /** Live copy for a step whose wording depends on game state (e.g. HIRE: SAVE UP vs TAP). @param {string} text */
  view.setText = (text) => {
    if (txt && txt.textContent !== text) txt.textContent = text;
  };
  view.hide = () => {
    if (bubble) bubble.remove();
    bubble = null;
    txt = null;
  };
  view.destroy = () => {
    offResize();
    root.remove();
  };
  return view;
}
