const VERSION = 1;
const FIRST_JOB = 'dunmore-pike';

/** @returns {object} a fresh default profile */
function defaults() {
  return {
    version: VERSION,
    bank: 0,
    jobs: {},
    settings: { hints: true, sound: true, debug: false, view: 'iso' },
    tutorial: { done: false, step: 0 },
    unlocks: [],
    owned: [FIRST_JOB],
  };
}

const ids = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))] : []);
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

/**
 * Fill missing fields of a stored profile (any older shape) up to the current version.
 * @param {object} p
 * @returns {object}
 */
export function migrate(p) {
  const d = defaults();
  if (!p || typeof p !== 'object' || Array.isArray(p)) return d;
  const jobs = {};
  for (const [id, j] of Object.entries(p.jobs && typeof p.jobs === 'object' ? p.jobs : {})) {
    const o = j && typeof j === 'object' ? j : {};
    jobs[id] = { bestStars: num(o.bestStars), bestNet: num(o.bestNet), plays: num(o.plays) };
  }
  const s = p.settings && typeof p.settings === 'object' ? p.settings : {};
  const t = p.tutorial && typeof p.tutorial === 'object' ? p.tutorial : {};
  return {
    version: VERSION,
    bank: num(p.bank),
    jobs,
    settings: { ...d.settings, ...s, view: s.view === 'top' ? 'top' : 'iso' },
    tutorial: { done: !!t.done, step: num(t.step) },
    unlocks: ids(p.unlocks),
    owned: [...new Set([FIRST_JOB, ...ids(p.owned)])],
  };
}

/**
 * Persistent profile store over an injectable Storage.
 * @param {{ storage?: Storage, key?: string }} [opts]
 */
export function createSave({ storage = globalThis.localStorage, key = 'imi-takeover-v1' } = {}) {
  let profile = null;

  function load() {
    try {
      const raw = storage.getItem(key);
      return raw ? migrate(JSON.parse(raw)) : defaults();
    } catch {
      return defaults();
    }
  }

  function persist() {
    try {
      storage.setItem(key, JSON.stringify(profile));
    } catch {
      /* in-memory fallback */
    }
  }

  const cur = () => (profile ||= load());
  const copy = () => JSON.parse(JSON.stringify(cur()));

  return {
    get: copy,
    /** @param {(p: object) => (object|void)} fn mutates a copy or returns a new profile */
    update(fn) {
      const next = copy();
      profile = migrate(fn(next) || next);
      persist();
      return copy();
    },
    /** @param {{ jobId: string, profit?: number, net?: number, stars: number }} r profit (final cash) is banked; net is the legacy alias */
    recordResult({ jobId, profit, net = profit, stars }) {
      const p = copy();
      const j = p.jobs[jobId] || { bestStars: 0, bestNet: 0, plays: 0 };
      const bankDelta = Math.max(0, num(net));
      const newBest = stars > j.bestStars || (stars === j.bestStars && net > j.bestNet);
      p.bank += bankDelta;
      j.plays += 1;
      j.bestStars = Math.max(j.bestStars, num(stars));
      j.bestNet = Math.max(j.bestNet, num(net));
      p.jobs[jobId] = j;
      profile = p;
      persist();
      return { bankDelta, newBest, profile: copy() };
    },
    setSetting(k, v) {
      const p = copy();
      p.settings[k] = v;
      profile = p;
      persist();
    },
    setTutorial(patch) {
      const p = copy();
      p.tutorial = { ...p.tutorial, ...patch };
      profile = p;
      persist();
    },
    /**
     * Spend banked cash on an upgrade or building (requirements are the caller's job).
     * @param {'upgrade'|'job'} kind
     * @returns {{ok:true, profile:object}|{ok:false, reason:'owned'|'poor'|'unknown'}}
     */
    purchase(kind, id, cost) {
      if ((kind !== 'upgrade' && kind !== 'job') || typeof id !== 'string' || !Number.isFinite(cost) || cost < 0) return { ok: false, reason: 'unknown' };
      const p = copy();
      const list = kind === 'upgrade' ? p.unlocks : p.owned;
      if (list.includes(id)) return { ok: false, reason: 'owned' };
      if (p.bank < cost) return { ok: false, reason: 'poor' };
      p.bank -= cost;
      list.push(id);
      profile = p;
      persist();
      return { ok: true, profile: copy() };
    },
    reset() {
      profile = defaults();
      persist();
    },
  };
}
