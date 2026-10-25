import { upgradeById } from '../data/upgrades.js';

export const NO_MODIFIERS = Object.freeze({ haulSpeed: 1, breachDamage: 1, decoyStamina: 1, valueMult: 1, carryReduction: 0, crane: false, startHaulers: 0, hireCost: 1, crewCap: 0 });

/**
 * Fold owned upgrade ids into gameplay multipliers (unknown ids ignored).
 * @param {Iterable<string>} unlockedIds
 * @returns {{haulSpeed:number, breachDamage:number, decoyStamina:number, valueMult:number, carryReduction:number, crane:boolean, startHaulers:number, hireCost:number, crewCap:number}}
 */
export function computeModifiers(unlockedIds = []) {
  const m = { ...NO_MODIFIERS };
  for (const id of new Set(unlockedIds)) {
    const e = upgradeById(id)?.effect;
    if (!e) continue;
    for (const k of ['haulSpeed', 'breachDamage', 'decoyStamina', 'valueMult', 'carryReduction', 'startHaulers', 'hireCost', 'crewCap']) if (e[k]) m[k] += e[k];
    if (e.crane) m.crane = true;
  }
  return m;
}
