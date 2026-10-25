/** Stealable item catalogue keyed by prop kind. weight = monkeys needed to carry. */
export const ITEM_DEFS = {
  chair: { name: 'Chair', weight: 1, value: 40, carryZ: 1.1 },
  monitor: { name: 'Monitor', weight: 1, value: 80, carryZ: 1.1 },
  plant: { name: 'Potted Plant', weight: 1, value: 25, carryZ: 1.1 },
  copier: { name: 'Copier', weight: 2, value: 220, carryZ: 1.2 },
  cab: { name: 'Filing Cabinet', weight: 2, value: 120, carryZ: 1.2 },
  desk: { name: 'Desk', weight: 3, value: 260, carryZ: 1.0 },
  vend: { name: 'Vending Machine', weight: 4, value: 450, carryZ: 1.0 },
  rack: { name: 'Server Rack', weight: 4, value: 900, carryZ: 1.0 },
  statue: { name: 'Bronze Statue', weight: 5, value: 1200, carryZ: 1.0 },
  safe: { name: 'Vault Safe', weight: 6, value: 1500, carryZ: 1.0 },
  ceo: { name: 'Mahogany Desk', weight: 8, value: 2000, carryZ: 1.0 },
};

/**
 * Delivery quota: ratio of total item value, rounded to the nearest 100.
 * @param {{value:number}[]} items
 * @param {number} [ratio]
 * @returns {number}
 */
export function quotaFor(items, ratio = 0.6) {
  const sum = items.reduce((s, it) => s + it.value, 0);
  return Math.round((sum * ratio) / 100) * 100;
}
