export const NUDGE_MS = 6000;

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * Pick the one nudge worth showing now, or null. Pure: the caller owns `shown` (causes already
 * nudged this run) and `hired` (the player has hired at least once).
 * @param {object|null} snap world snapshot (auto mode)
 * @param {{ shown?: Set<string>|string[], hired?: boolean, tutorialHire?: boolean }} [state]
 *   tutorialHire: the tutorial is already pointing at HIRE, so skip the generic afford nudge.
 * @returns {{ id: string, text: string, pulse: string }|null} pulse is a role id (hire button to highlight)
 */
export function chooseNudge(snap, { shown = [], hired = false, tutorialHire = false } = {}) {
  if (!snap?.hints || !snap.hire || !snap.economy || snap.economy.cleared) return null;
  const seen = new Set(shown);
  const { hints, hire, economy } = snap;
  const count = (r) => hire.roles[r]?.count ?? 0;
  const full = hire.count >= hire.cap;
  // early game belongs to the tutorial: hold the problem nudges until the player has had time to earn
  const t = economy.elapsed ?? Infinity;
  const list = [];
  if (t >= 90 && hints.inspectorNear && count('decoy') === 0) {
    list.push({ id: 'inspector', text: 'INSPECTOR! HIRE A DECOY TO STALL HIM', pulse: 'decoy' });
  }
  // sealed loot also covers "haulers idle, nothing to carry": every remaining item is behind walls
  if (t >= 150 && hints.sealedValue > 0 && count('breacher') === 0) {
    list.push({ id: 'sealed', text: `SEALED ROOMS HOLD ${money(hints.sealedValue)} OF LOOT. HIRE A BREACHER`, pulse: 'breacher' });
  }
  if (t >= 120 && hints.heavyWaiting > 0) {
    list.push({ id: 'heavy', text: 'HEAVY LOOT NEEDS MORE HAULERS', pulse: 'hauler' });
  }
  if (!hired && !tutorialHire && !full) {
    const open = Object.entries(hire.roles).filter(([, r]) => r.canAfford).sort((a, b) => a[1].cost - b[1].cost)[0];
    if (open && economy.cash >= open[1].cost) {
      list.push({ id: 'afford', text: 'YOU CAN AFFORD A NEW MONKEY: TAP HIRE', pulse: open[0] });
    }
  }
  return list.find((n) => !seen.has(n.id)) ?? null;
}

/**
 * Compact banner that shows one nudge at a time for NUDGE_MS and never repeats a cause in a run.
 * @param {HTMLElement} parent HUD root
 * @param {{ onShow?: (n:object)=>void, onHide?: (n:object)=>void, ms?: number }} [opts]
 */
export function createNudges(parent, { onShow, onHide, ms = NUDGE_MS } = {}) {
  const box = document.createElement('div');
  box.className = 'nudge px';
  box.hidden = true;
  const txt = document.createElement('b');
  box.appendChild(txt);
  parent.appendChild(box);
  const shown = new Set();
  let active = null;
  let left = 0;

  const hide = () => {
    if (!active) return;
    const n = active;
    active = null;
    box.hidden = true;
    onHide?.(n);
  };

  return {
    el: box,
    shown,
    active: () => active,
    /** Offer the current snapshot; shows a fresh nudge when idle. @returns {object|null} the nudge newly shown */
    offer(snap, state = {}) {
      if (active) return null;
      const n = chooseNudge(snap, { ...state, shown });
      if (!n) return null;
      shown.add(n.id);
      active = n;
      left = ms / 1000;
      txt.textContent = n.text;
      box.hidden = false;
      onShow?.(n);
      return n;
    },
    /** Advance the timeout; call once per sim frame. */
    tick(dt) {
      if (!active) return;
      left -= dt;
      if (left <= 0) hide();
    },
    /** Dismiss the current nudge (e.g. the player acted on it). */
    dismiss: hide,
    /** New run: forget which causes were already shown. */
    reset() {
      hide();
      shown.clear();
    },
    destroy() {
      box.remove();
    }
  };
}
