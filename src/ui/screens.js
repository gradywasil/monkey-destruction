import { canBuy, UPGRADES } from '../data/upgrades.js';
import { JOBS } from '../data/jobs.js';
const ROLE_COLORS = { breacher: '#f77622', hauler: '#63c74d', rigger: '#0099db', decoy: '#b55088' };
const ROLE_NAMES = { breacher: 'BREACH', hauler: 'HAUL', rigger: 'RIG', decoy: 'DECOY' };
const ROLE_ORDER = ['breacher', 'hauler', 'rigger', 'decoy'];
const noop = () => {};

/**
 * @param {{id:string,cost:number,requires:string[]}} job
 * @param {Iterable<string>} owned owned building ids
 * @param {number} bank
 * @returns {{state:'play'|'locked'|'buy'|'poor', missing:string[]}}
 */
export function jobState(job, owned, bank) {
  const have = new Set(owned);
  if (have.has(job.id)) return { state: 'play', missing: [] };
  const missing = job.requires.filter((r) => !have.has(r));
  if (missing.length) return { state: 'locked', missing };
  return { state: bank >= job.cost ? 'buy' : 'poor', missing: [] };
}

/**
 * @param {{id:string,cost:number,requires:string[]}} up
 * @param {Iterable<string>} unlocked owned upgrade ids
 * @param {number} bank
 * @returns {{state:'owned'|'locked'|'buy'|'poor', missing:string[]}}
 */
export function upgradeState(up, unlocked, bank) {
  const r = canBuy(up, unlocked, bank);
  const have = new Set(unlocked);
  return { state: r.ok ? 'buy' : r.reason, missing: up.requires.filter((x) => !have.has(x)) };
}

/**
 * @param {number} n dollars
 * @returns {string} e.g. '$12,300' or '-$150'
 */
export function formatMoney(n) {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US')}`;
}

/**
 * @param {number} seconds
 * @returns {string} e.g. '15:00'
 */
export function formatClock(seconds) {
  const t = Math.ceil(Math.max(0, Number(seconds) || 0));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * @param {number} n filled stars (0-3)
 * @returns {string} e.g. '★★☆'
 */
export function starsText(n) {
  const f = Math.max(0, Math.min(3, Math.floor(Number(n) || 0)));
  return '★'.repeat(f) + '☆'.repeat(3 - f);
}

/**
 * @param {{stars:number}} result
 * @returns {string}
 */
export function resultTitle(result) {
  return 'BUILDING STRIPPED!';
}

const el = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

/**
 * Full-screen UI (title, briefing, pause, results) over the stage canvas.
 * @param {HTMLElement} parent
 * @param {{canvas:HTMLElement,width:number,height:number,k:number,onResize:(fn:Function)=>Function}} stage
 */
export function createScreens(parent, stage) {
  const root = el('div', 'screens', parent);
  let current = null;

  function layout() {
    root.style.left = stage.canvas.style.left;
    root.style.top = stage.canvas.style.top;
    root.style.width = `${stage.width}px`;
    root.style.height = `${stage.height}px`;
    root.style.transform = `scale(${stage.k})`;
  }
  layout();
  const offResize = stage.onResize(layout);

  function open(name) {
    hide();
    current = el('div', `scr ${name}`, root);
    return el('div', 'body', current);
  }

  function hide() {
    current?.remove();
    current = null;
  }

  const button = (parent, text, cls, fn) => {
    const b = el('button', cls, parent, text);
    b.type = 'button';
    b.addEventListener('click', () => fn());
    return b;
  };

  const row = (parent, label, value, cls = '') => {
    const r = el('div', `row ${cls}`, parent);
    el('span', '', r, label);
    el('b', '', r, value);
    return r;
  };

  return {
    /**
     * @param {{bank:number,jobs?:number,canContinue?:boolean}} info
     * @param {{onPlay?:Function,onSettings?:Function}} [cb]
     */
    showTitle(info = {}, cb = {}) {
      const b = open('title');
      el('div', 'brand', b, 'INFINITE MONKEY INDUSTRIES');
      el('div', 'logo', b, 'HOSTILE TAKEOVER');
      el('div', 'tag', b, 'STRIP IT TO THE COPPER.');
      const bank = el('div', 'bank px', b);
      el('small', '', bank, 'BANK');
      el('b', '', bank, formatMoney(info.bank));
      button(b, info.canContinue ? 'CONTINUE' : 'PLAY', 'btn primary big', cb.onPlay ?? noop);
      button(b, 'SETTINGS', 'btn small', cb.onSettings ?? noop);
    },

    /**
     * @param {{bank:number,jobs:object,owned:string[],unlocks:string[]}} profile
     * @param {{onPlay?:(id:string)=>void,onBuyJob?:Function,onBuyUpgrade?:Function,onBack?:Function}} [cb]
     */
    showMap(profile, cb = {}) {
      const b = open('map');
      const head = el('div', 'maphead px', b);
      el('small', '', head, 'BANK');
      el('b', '', head, formatMoney(profile.bank));
      const list = el('div', 'maplist', b);
      el('small', 'sub', list, 'BUILDINGS');
      const name = (id, all) => (all.find((x) => x.id === id)?.name ?? id);
      for (const j of JOBS) {
        const st = jobState(j, profile.owned, profile.bank);
        const card = el('div', `item px ${st.state}`, list);
        const info = el('div', 'info', card);
        el('small', '', info, `JOB ${String(j.number).padStart(2, '0')}`);
        el('b', '', info, j.name);
        el('span', 'tag2', info, j.tagline);
        if (st.state === 'locked') el('span', 'req', info, `NEEDS ${st.missing.map((m) => name(m, JOBS)).join(', ')}`);
        else if (st.state === 'play') el('span', 'stars2', info, starsText(profile.jobs[j.id]?.bestStars));
        if (st.state === 'play') button(card, 'PLAY', 'btn primary act', () => (cb.onPlay ?? noop)(j.id));
        else if (st.state === 'locked') button(card, 'LOCKED', 'btn act', noop).disabled = true;
        else {
          const buy = button(card, `BUY ${formatMoney(j.cost)}`, 'btn primary act', () => (cb.onBuyJob ?? noop)(j));
          buy.disabled = st.state === 'poor';
        }
      }
      el('small', 'sub', list, 'UPGRADES');
      for (const u of UPGRADES) {
        const st = upgradeState(u, profile.unlocks, profile.bank);
        const card = el('div', `item px ${st.state}`, list);
        const info = el('div', 'info', card);
        el('b', '', info, u.name);
        el('span', 'tag2', info, u.desc);
        if (st.state === 'locked') el('span', 'req', info, `NEEDS ${st.missing.map((m) => name(m, UPGRADES)).join(', ')}`);
        if (st.state === 'owned') button(card, 'OWNED', 'btn act', noop).disabled = true;
        else if (st.state === 'locked') button(card, 'LOCKED', 'btn act', noop).disabled = true;
        else {
          const buy = button(card, `BUY ${formatMoney(u.cost)}`, 'btn primary act', () => (cb.onBuyUpgrade ?? noop)(u));
          buy.disabled = st.state === 'poor';
        }
      }
      button(b, 'BACK', 'btn link', cb.onBack ?? noop);
    },

    /**
     * @param {{id:number|string,number?:number,name:string,blurb:string,quota:number,duration:number,hazards?:string[],crew?:object,bestStars?:number}} job
     * @param {{onStart?:Function,onBack?:Function}} [cb]
     */
    showBriefing(job, cb = {}) {
      const b = open('briefing');
      const card = el('div', 'card px', b);
      const raw = job.number ?? (Number.isFinite(Number(job.id)) ? job.id : 1);
      const n = String(raw).padStart(2, '0');
      el('small', 'hdr', card, `JOB ${n}`);
      el('h2', '', card, job.name);
      el('p', 'blurb', card, job.blurb);
      el('p', 'objective', card, 'OBJECTIVE: STRIP THE BUILDING. YOU START WITH 2 MONKEYS. TAP LOOT TO SELL IT, THEN HIRE MORE MONKEYS WHO WORK ON THEIR OWN.');
      row(card, 'PAR TIME', formatClock(job.par));
      el('small', 'sub', card, 'WATCH OUT FOR');
      const ul = el('ul', 'hazards', card);
      for (const h of job.hazards ?? []) el('li', '', ul, h);
      el('small', 'sub', card, 'YOUR CREW');
      const crew = el('div', 'crew', card);
      for (const role of ROLE_ORDER) {
        const chip = el('div', 'chip', crew);
        el('i', '', chip).style.background = ROLE_COLORS[role];
        el('span', '', chip, ROLE_NAMES[role]);
        el('b', '', chip, `x${job.crew?.[role] ?? 0}`);
      }
      const best = el('div', 'best', card);
      el('span', '', best, 'BEST');
      el('b', '', best, starsText(job.bestStars));
      button(b, 'START', 'btn primary big', cb.onStart ?? noop);
      button(b, 'BACK', 'btn link', cb.onBack ?? noop);
    },

    /**
     * @param {{settings:{hints:boolean,sound:boolean,debug:boolean}}} info
     * @param {{onResume?:Function,onRestart?:Function,onQuit?:Function,onSetting?:(key:string,value:boolean)=>void}} [cb]
     */
    showPause(info = {}, cb = {}) {
      const b = open('pause');
      const card = el('div', 'card px', b);
      el('h2', '', card, 'PAUSED');
      const settings = info.settings ?? {};
      for (const [key, label] of [['view3d', '2.5D VIEW'], ['hints', 'HINTS'], ['sound', 'SOUND'], ['debug', 'DEBUG']]) {
        const r = el('div', 'row', card);
        el('span', '', r, label);
        const t = el('button', 'toggle', r);
        t.type = 'button';
        t.setAttribute('role', 'switch');
        const paint = (on) => {
          t.setAttribute('aria-checked', String(on));
          t.classList.toggle('on', on);
          t.textContent = on ? 'ON' : 'OFF';
        };
        let on = !!settings[key];
        paint(on);
        t.addEventListener('click', () => {
          on = !on;
          paint(on);
          (cb.onSetting ?? noop)(key, on);
        });
      }
      button(card, 'RESUME', 'btn primary', cb.onResume ?? noop);
      if (cb.onReplayTutorial) button(card, 'REPLAY TUTORIAL', 'btn', cb.onReplayTutorial);
      button(card, 'RESTART JOB', 'btn', cb.onRestart ?? noop);
      button(card, 'QUIT TO TITLE', 'btn', cb.onQuit ?? noop);
    },

    /**
     * @param {{jobName:string,elapsed:number,par:number,stars:number,fines:number,profit:number,bank:number,newBest?:boolean}} result
     * @param {{onNext?:Function,onRetry?:Function}} [cb]
     */
    showResults(result, cb = {}) {
      const b = open('results');
      const card = el('div', 'card px', b);
      el('h2', '', card, resultTitle(result));
      el('small', 'sub', card, result.jobName);
      const stars = el('div', 'stars', card);
      for (let i = 0; i < 3; i++) {
        const s = el('span', i < result.stars ? 'on' : '', stars, i < result.stars ? '★' : '☆');
        s.style.animationDelay = `${i * 0.25}s`;
      }
      if (result.newBest) el('div', 'newbest', card, 'NEW BEST!');
      row(card, 'TIME', `${formatClock(result.elapsed)} / PAR ${formatClock(result.par)}`);
      if (result.fines > 0) row(card, 'FINES', formatMoney(-result.fines), 'fine');
      row(card, 'PROFIT', formatMoney(result.profit));
      el('div', 'banked', card, `+${formatMoney(result.profit)} BANKED`);
      button(card, 'NEXT BUILDING', 'btn primary', cb.onNext ?? noop);
      button(card, 'RETRY', 'btn', cb.onRetry ?? noop);
    },

    hide,

    /** @returns {boolean} */
    isOpen() {
      return current !== null;
    },

    destroy() {
      hide();
      offResize?.();
      root.remove();
    },
  };
}
