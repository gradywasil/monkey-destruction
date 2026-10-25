/** Tunables for the automation / incremental ("auto") mode. */
export const AUTO_ROLES = ['hauler', 'hauler'];
export const HIRE_ROLES = ['hauler', 'breacher', 'rigger', 'decoy'];
export const HIRE_BASE = { hauler: 350, breacher: 1200, rigger: 1400, decoy: 1000 };
export const HIRE_GROWTH = 1.28;
export const DEFAULT_CREW_CAP = 12;

/** In-run boosts: cost = base * growth^level, effect = 1 + per * level. */
export const BOOSTS = {
  speed: { base: 150, growth: 1.7, per: 0.12, max: 8 },
  haggle: { base: 200, growth: 1.8, per: 0.1, max: 8 },
};
export const BOOST_IDS = Object.keys(BOOSTS);

export const PAR_DIVISOR = 12;
export const PAR_MIN = 240;
export const PAR_MAX = 900;
export const WHISTLE_COOLDOWN = 20;
/** Auto mode walks slower than classic; the speed boost claws it back. */
export const AUTO_SPEED = 0.46;

/** @returns {number} price of the next hire of `role` after `hired` earlier hires of it. */
export const hireCostFor = (role, hired, mult = 1) => Math.round(Math.round(HIRE_BASE[role] * HIRE_GROWTH ** hired) * mult);

/** @returns {number} price of the next level of a boost currently at `level`. */
export const boostCostFor = (id, level) => Math.round(BOOSTS[id].base * BOOSTS[id].growth ** level);

/** @returns {number} multiplier a boost at `level` applies. */
export const boostMult = (id, level) => 1 + BOOSTS[id].per * level;

/** @returns {number} par time in seconds (level `par` wins, else total value / PAR_DIVISOR clamped). */
export const parFor = (totalValue, levelPar) => levelPar > 0 ? levelPar : Math.min(PAR_MAX, Math.max(PAR_MIN, Math.round(totalValue / PAR_DIVISOR)));

/** @returns {1|2|3} */
export const starsFor = (elapsed, par) => (elapsed <= par ? 3 : elapsed <= 1.5 * par ? 2 : 1);

/** Stall rescue ("bank advance"): idle this long (sim s), never in the opening grace, at most this many per run. */
export const RESCUE_DELAY = 15;
export const RESCUE_GRACE = 30;
export const RESCUE_MAX = 3;
