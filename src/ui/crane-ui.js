const REASON_TEXT = {
  locked: 'CRANE NOT UNLOCKED',
  cooldown: 'CRANE IS RECHARGING',
  busy: 'CRANE IS BUSY',
  'not-placed': 'ALREADY BUSY',
  'too-light': 'TOO LIGHT FOR THE CRANE',
  ended: "TIME'S UP",
  'unknown-item': 'TAP AN ITEM'
};

/** Friendly toast text for a failed crane command. @param {string} reason */
export const craneFailText = (reason) => REASON_TEXT[reason] ?? 'NOPE';

/** Button label from crane snapshot: CRANE, CRANE 42s, or CRANE... while flying. @param {{state:string,cooldown:number}} crane */
export function craneLabel(crane) {
  if (crane.state !== 'idle') return 'CRANE...';
  return crane.cooldown > 0 ? `CRANE ${Math.ceil(crane.cooldown)}s` : 'CRANE';
}
