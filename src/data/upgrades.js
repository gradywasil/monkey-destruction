/** Prestige upgrades bought with banked cash; effects are summed by computeModifiers. */
export const UPGRADES = [
  { id: 'bionic-legs-1', name: 'BIONIC LEGS I', desc: 'HAULERS +15% SPEED', cost: 1500, requires: [], effect: { haulSpeed: 0.15 } },
  { id: 'bionic-legs-2', name: 'BIONIC LEGS II', desc: '+15% MORE SPEED', cost: 5000, requires: ['bionic-legs-1'], effect: { haulSpeed: 0.15 } },
  { id: 'bionic-fists', name: 'BIONIC FISTS', desc: 'BREACHERS +50% DAMAGE', cost: 1500, requires: [], effect: { breachDamage: 0.5 } },
  { id: 'bionic-arms', name: 'BIONIC ARMS', desc: 'HEAVY ITEMS NEED 1 FEWER CARRIER', cost: 3500, requires: [], effect: { carryReduction: 1 } },
  { id: 'decoy-training', name: 'DECOY TRAINING', desc: 'DECOYS +50% STAMINA', cost: 2000, requires: [], effect: { decoyStamina: 0.5 } },
  { id: 'shredder-truck', name: 'SHREDDER TRUCK', desc: 'ALL DELIVERIES +25% VALUE', cost: 4000, requires: [], effect: { valueMult: 0.25 } },
  { id: 'shredder-2', name: 'INDUSTRIAL SHREDDER', desc: '+25% MORE VALUE', cost: 9000, requires: ['shredder-truck'], effect: { valueMult: 0.25 } },
  { id: 'recruiter-1', name: 'RECRUITER I', desc: 'START WITH +1 HAULER', cost: 1200, requires: [], effect: { startHaulers: 1 } },
  { id: 'recruiter-2', name: 'RECRUITER II', desc: 'START WITH +1 MORE HAULER', cost: 4000, requires: ['recruiter-1'], effect: { startHaulers: 1 } },
  { id: 'headhunter', name: 'HEADHUNTER', desc: 'HIRING COSTS 15% LESS', cost: 2500, requires: [], effect: { hireCost: -0.15 } },
  { id: 'barracks-1', name: 'BARRACKS I', desc: 'CREW CAP +4', cost: 3000, requires: [], effect: { crewCap: 4 } },
  { id: 'barracks-2', name: 'BARRACKS II', desc: 'CREW CAP +4 MORE', cost: 7000, requires: ['barracks-1'], effect: { crewCap: 4 } },
  { id: 'crane-helicopter', name: 'CRANE HELICOPTER', desc: 'AIRLIFT A HEAVY ITEM EVERY 60 S', cost: 8000, requires: [], effect: { crane: true } },
];

/** @returns {object|undefined} */
export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);

/**
 * @param {{id:string, cost:number, requires:string[]}} upgrade
 * @param {Iterable<string>} owned owned upgrade ids
 * @param {number} bank
 * @returns {{ok:boolean, reason?:'owned'|'locked'|'poor'}}
 */
export function canBuy(upgrade, owned, bank) {
  const have = new Set(owned);
  if (have.has(upgrade.id)) return { ok: false, reason: 'owned' };
  if (!upgrade.requires.every((r) => have.has(r))) return { ok: false, reason: 'locked' };
  if (bank < upgrade.cost) return { ok: false, reason: 'poor' };
  return { ok: true };
}
