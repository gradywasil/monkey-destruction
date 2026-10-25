import { formatMoney } from './screens.js';
import { createCard } from './card.js';
import { createTray } from './tray.js';
import { recommendRole } from './loot.js';

const ROLE_COLORS = { breacher: '#f77622', hauler: '#63c74d', rigger: '#0099db', decoy: '#b55088' };
const HIRE_ORDER = ['hauler', 'breacher', 'rigger', 'decoy'];
const ROLE_INFO = {
  hauler: 'CARRIES LOOT TO THE TRUCK',
  breacher: 'SMASHES WALLS TO OPEN SEALED ROOMS',
  rigger: 'SHOVES LOOT OUT OF WINDOWS',
  decoy: 'STALLS INSPECTORS SO YOU DODGE FINES'
};
const BOOST_INFO = {
  speed: { name: 'SPEED', desc: 'MONKEYS WALK AND WORK FASTER' },
  haggle: { name: 'HAGGLE', desc: 'LOOT SELLS FOR MORE CASH' }
};
/** Logical px the top and bottom HUD bars take, so the card and the camera keep to the band between them. */
export const TOP_BAND = 128;
export const BOTTOM_BAND = 142;
const TOAST_MS = 2000;
const POP_MS = 400;
const READY_MS = 1800;
const FOCUS_CLASS = 'hint';

const el = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

/** @returns {string} mm:ss, rounding down (a running clock). */
export const runClock = (s) => {
  const t = Math.floor(Math.max(0, Number(s) || 0));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

/** @returns {number} next displayed cash value, easing toward `target` and landing exactly. */
export const tweenCash = (shown, target, dt = 1 / 30) => {
  const d = target - shown;
  if (Math.abs(d) < 1) return target;
  return shown + d * Math.min(1, dt * 9);
};

/**
 * DOM HUD overlay that follows the stage's canvas rectangle and integer scale.
 * @param {HTMLElement} parent
 * @param {{canvas:HTMLCanvasElement,width:number,height:number,k:number,onResize:(fn:Function)=>Function}} stage
 */
export function createHud(parent, stage) {
  const root = el('div', 'hud', parent);
  const top = el('div', 'top', root);
  const cashBox = el('div', 'cashbox', top);
  const jobName = el('small', '', cashBox, '');
  const cashEl = el('b', 'cash', cashBox, '$0');
  const timer = el('div', 'timer px', top);
  const tm = el('span', 'tm', timer, '00:00');
  const parEl = el('small', '', timer, 'PAR 10:00');
  const pauseBtn = el('button', 'pause px', root);
  pauseBtn.type = 'button';
  pauseBtn.setAttribute('aria-label', 'Pause');
  el('i', '', pauseBtn);
  el('i', '', pauseBtn);

  const objective = el('div', 'objective', root);
  const orow = el('div', 'orow', objective);
  el('span', '', orow, 'BUILDING STRIPPED');
  const pct = el('b', '', orow, '0%');
  const bar = el('div', 'bar', objective);
  const fill = el('i', '', bar);
  const fines = el('div', 'fines', objective);

  const toasts = el('div', 'toasts', root);

  const card = createCard(root, stage, { top: () => TOP_BAND + (stage.safeArea?.top ?? 0) / stage.k, bottom: () => stage.height - BOTTOM_BAND - (stage.safeArea?.bottom ?? 0) / stage.k });
  const bot = el('div', 'bot', root);
  let onTrayPick = () => {};
  const tray = createTray(bot, { onPick: (g) => onTrayPick(g) });
  const acts = el('div', 'acts', bot);
  const hireBtn = el('button', 'hirebtn px', acts);
  hireBtn.type = 'button';
  el('b', 't', hireBtn, 'HIRE');
  const hireSub = el('span', 's', hireBtn, '');
  const hireCnt = el('em', 'n', hireBtn, '0/12');
  const hireDot = el('u', 'dot', hireBtn);
  const boostBtn = el('button', 'boostbtn px', acts);
  boostBtn.type = 'button';
  el('span', 'bi', boostBtn);
  el('span', 't', boostBtn, 'BOOST');
  const boostDot = el('u', 'dot', boostBtn);

  let onPause = () => {};
  let onHire = () => {};
  let onBoost = () => {};
  const focused = new Map();
  const cache = {};
  const queue = [];
  let showing = false;
  let shownCash = 0;
  let targetCash = 0;
  let lastAt = 0;
  let popTimer = 0;

  const set = (key, node, value) => {
    if (cache[key] === value) return;
    cache[key] = value;
    node.textContent = value;
  };
  const flag = (key, node, cls, on) => {
    if (cache[key] === on) return;
    cache[key] = on;
    node.classList.toggle(cls, on);
  };

  function layout() {
    root.style.left = stage.canvas.style.left;
    root.style.top = stage.canvas.style.top;
    root.style.width = `${stage.width}px`;
    root.style.height = `${stage.height}px`;
    root.style.transform = `scale(${stage.k})`;
  }
  layout();
  const offResize = stage.onResize(layout);
  pauseBtn.addEventListener('click', () => onPause());

  /** Bottom sheet with a header, shared by the hire and boost lists. */
  const makeSheet = (name) => {
    const sheet = el('div', 'sheet', root);
    sheet.hidden = true;
    const backdrop = el('div', 'backdrop', sheet);
    const panel = el('div', 'panel px', sheet);
    const phead = el('div', 'phead', panel);
    el('b', '', phead, name);
    const closeBtn = el('button', 'close px', phead, 'CLOSE');
    closeBtn.type = 'button';
    const api = {
      sheet,
      panel,
      open: (on = sheet.hidden) => {
        sheet.hidden = !on;
        api.onToggle?.(on);
        root.classList.toggle('sheet-open', sheets.some((sh) => sh.isOpen()));
      },
      isOpen: () => !sheet.hidden
    };
    backdrop.addEventListener('click', () => api.open(false));
    closeBtn.addEventListener('click', () => api.open(false));
    return api;
  };

  const hireSheet = makeSheet('HIRE A MONKEY');
  const hires = new Map();
  for (const role of HIRE_ORDER) {
    const r = el('div', 'brow hrow', hireSheet.panel);
    r.dataset.role = role;
    el('i', 'sw', r).style.background = ROLE_COLORS[role];
    const info = el('div', 'binfo', r);
    const name = el('b', '', info, role.toUpperCase());
    const cnt = el('em', '', name, ' x0');
    const star = el('u', 'best', name, ' BEST NOW');
    star.hidden = true;
    el('span', '', info, ROLE_INFO[role]);
    const buy = el('button', 'buy px', r, '$0');
    buy.type = 'button';
    buy.addEventListener('click', () => onHire(role));
    hires.set(role, { row: r, cost: buy, cnt, star, buy, afforded: false, readyTimer: 0 });
  }
  const crewTag = el('div', 'crewtag', hireSheet.panel, 'CREW 0/12');

  const boostSheet = makeSheet('BOOSTS');
  const rows = new Map();
  for (const id of Object.keys(BOOST_INFO)) {
    const r = el('div', 'brow', boostSheet.panel);
    const info = el('div', 'binfo', r);
    const name = el('b', '', info, BOOST_INFO[id].name);
    const lvl = el('em', '', name, ' 0/8');
    el('span', '', info, BOOST_INFO[id].desc);
    const buy = el('button', 'buy px', r, 'BUY');
    buy.type = 'button';
    buy.addEventListener('click', () => onBoost(id));
    rows.set(id, { lvl, buy });
  }
  const sheets = [hireSheet, boostSheet];
  const openOnly = (which, on) => {
    for (const sh of sheets) if (sh !== which) sh.open(false);
    which.open(on);
  };
  hireSheet.onToggle = (on) => hireBtn.classList.toggle('sel', on);
  boostSheet.onToggle = (on) => boostBtn.classList.toggle('sel', on);
  hireBtn.addEventListener('click', () => openOnly(hireSheet, hireSheet.isOpen() ? false : true));
  boostBtn.addEventListener('click', () => openOnly(boostSheet, boostSheet.isOpen() ? false : true));

  function nextToast() {
    const next = queue.shift();
    if (!next) {
      showing = false;
      return;
    }
    showing = true;
    const t = el('div', `toast px ${next.kind === 'warn' ? 'warn' : ''}`, toasts, next.text);
    setTimeout(() => {
      t.remove();
      nextToast();
    }, TOAST_MS);
  }

  const focusTarget = (focus) => {
    if (!focus) return null;
    if (focus === 'boost') return boostBtn;
    if (focus === 'objective') return objective;
    if (focus === 'tray') return tray.el;
    if (focus.startsWith('hire:')) return hireSheet.isOpen() ? hires.get(focus.slice(5))?.row ?? null : hireBtn;
    return null;
  };

  return {
    root,

    /** Pause button handler. @param {Function} fn */
    set onPause(fn) {
      onPause = fn ?? (() => {});
    },

    /**
     * Pulse one HUD element. Slots let the tutorial and a nudge pulse at the same time.
     * @param {string|null} focus 'hire:<role>' | 'boost' | 'objective' | 'tray' | null
     * @param {string} [slot]
     */
    setFocus(focus, slot = 'tut') {
      focused.get(slot)?.classList.remove(FOCUS_CLASS);
      const node = focusTarget(focus);
      if (node) {
        focused.set(slot, node);
        node.classList.add(FOCUS_CLASS);
      } else {
        focused.delete(slot);
      }
    },

    /**
     * Refresh readouts from a world snapshot; only changed values touch the DOM.
     * @param {object} snapshot
     * @param {{levelName?:string, jobNum?:number}} [extra]
     */
    update(snapshot, extra = {}) {
      if (extra.levelName != null) set('level', jobName, extra.jobNum != null ? `JOB ${String(extra.jobNum).padStart(2, '0')} ${extra.levelName}` : extra.levelName);
      const eco = snapshot.economy;
      if (!eco) return;
      const now = performance.now();
      const dt = lastAt ? Math.min(0.25, (now - lastAt) / 1000) : 1 / 30;
      lastAt = now;
      if (eco.cash > targetCash + 0.5) {
        cashEl.classList.remove('pop');
        void cashEl.offsetWidth;
        cashEl.classList.add('pop');
        clearTimeout(popTimer);
        popTimer = setTimeout(() => cashEl.classList.remove('pop'), POP_MS);
      }
      targetCash = eco.cash;
      shownCash = tweenCash(shownCash, targetCash, dt);
      set('cash', cashEl, formatMoney(Math.round(shownCash)));

      set('time', tm, runClock(eco.elapsed));
      set('par', parEl, `PAR ${runClock(eco.par)}`);
      flag('late', timer, 'late', eco.elapsed > eco.par && !eco.cleared);

      const p = Math.min(100, Math.floor(eco.stripped * 100));
      set('pct', pct, `${p}%`);
      const w = `${(Math.min(1, eco.stripped) * 100).toFixed(1)}%`;
      if (cache.fill !== w) {
        cache.fill = w;
        fill.style.width = w;
      }
      set('fines', fines, eco.fines > 0 ? `FINES -${formatMoney(eco.fines)}` : '');

      const h = snapshot.hire;
      if (h) {
        const full = h.count >= h.cap;
        set('crew', crewTag, `CREW ${h.count}/${h.cap}`);
        flag('capfull', crewTag, 'full', full);
        set('hirecnt', hireCnt, `${h.count}/${h.cap}`);
        const rec = recommendRole(snapshot);
        let anyAfford = false;
        for (const [role, v] of hires) {
          const r = h.roles[role];
          if (!r) continue;
          set(`cost${role}`, v.cost, full ? 'FULL' : formatMoney(r.cost));
          set(`cnt${role}`, v.cnt, ` x${r.count}`);
          flag(`poor${role}`, v.buy, 'poor', !r.canAfford);
          v.star.hidden = !(rec && rec.role === role);
          if (r.canAfford) anyAfford = true;
          if (r.canAfford && !v.afforded) {
            v.afforded = true;
            v.row.classList.add('ready');
            clearTimeout(v.readyTimer);
            v.readyTimer = setTimeout(() => v.row.classList.remove('ready'), READY_MS);
          }
        }
        set('hiresub', hireSub, full ? 'CREW FULL' : rec ? `${rec.role.toUpperCase()} ${formatMoney(rec.cost)}` : '');
        flag('hirepoor', hireBtn, 'poor', !anyAfford);
        flag('hiredot', hireDot, 'on', anyAfford);
      }

      let anyBoost = false;
      for (const b of snapshot.boosts ?? []) {
        const row = rows.get(b.id);
        if (!row) continue;
        const maxed = b.cost === null;
        set(`lv${b.id}`, row.lvl, ` ${b.level}/${b.max}`);
        set(`buy${b.id}`, row.buy, maxed ? 'MAX' : formatMoney(b.cost));
        flag(`bp${b.id}`, row.buy, 'poor', !b.canAfford);
        if (b.canAfford) anyBoost = true;
      }
      flag('bdot', boostDot, 'on', anyBoost);
    },

    /** Hire button handler. @param {(role:string)=>void} fn */
    onHire(fn) {
      onHire = fn;
    },

    /** Boost buy handler. @param {(id:string)=>void} fn */
    onBoost(fn) {
      onBoost = fn;
    },

    card,
    tray,

    /** Loot chip handler. @param {(group:object)=>void} fn */
    onTrayPick(fn) {
      onTrayPick = fn ?? (() => {});
    },

    openHire: () => openOnly(hireSheet, true),
    closeHire: () => hireSheet.open(false),
    hireOpen: () => hireSheet.isOpen(),
    openBoosts: () => openOnly(boostSheet, true),
    closeBoosts: () => boostSheet.open(false),
    boostsOpen: () => boostSheet.isOpen(),
    /** True while any sheet covers the map (taps on the map should be ignored). */
    sheetOpen: () => sheets.some((sh) => sh.isOpen()),

    /** New run: forget one-shot flashes and snap the cash readout. */
    reset() {
      shownCash = 0;
      targetCash = 0;
      for (const v of hires.values()) {
        v.afforded = false;
        v.row.classList.remove('ready');
      }
      for (const k of Object.keys(cache)) delete cache[k];
      for (const sh of sheets) sh.open(false);
      card.hide();
    },

    /** Queue a 2 s toast. @param {string} text @param {'info'|'warn'} [kind] */
    toast(text, kind = 'info') {
      queue.push({ text, kind });
      if (!showing) nextToast();
    },

    /** Floating text at logical stage coordinates. */
    floatText(text, sx, sy, cls = '') {
      const f = el('div', `float ${cls}`, root, text);
      f.style.left = `${sx}px`;
      f.style.top = `${sy}px`;
      setTimeout(() => f.remove(), 1000);
    },

    destroy() {
      offResize();
      root.remove();
    }
  };
}
