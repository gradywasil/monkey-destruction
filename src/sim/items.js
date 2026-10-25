import { ITEM_DEFS } from '../data/items.js';
import { KNOWN_PROPS } from './grid.js';

/**
 * Build the item store from a grid's props.
 * @param {import('./grid.js').Grid} grid
 */
export function createItemStore(grid) {
  const items = new Map();
  const handlers = { pickup: new Set(), drop: new Set(), deliver: new Set() };
  const totals = { delivered: 0, count: 0, total: 0 };

  for (const p of grid.props) {
    const def = ITEM_DEFS[p.kind];
    if (!def) continue;
    items.set(p.id, {
      id: p.id, kind: p.kind, x: p.x, y: p.y, w: p.w, d: p.d,
      weight: def.weight, value: def.value, state: 'placed', carriers: [],
    });
    totals.total += def.value;
  }

  const emit = (type, item) => {
    for (const fn of handlers[type]) fn(item);
  };

  const canPlace = (item, x, y) => {
    const blocks = KNOWN_PROPS[item.kind]?.blocks;
    for (let j = 0; j < item.d; j++) {
      for (let i = 0; i < item.w; i++) {
        const tx = x + i;
        const ty = y + j;
        const t = grid.tile(tx, ty);
        if (!t || t.floor === 'void') return false;
        if (blocks ? !grid.isWalkable(tx, ty) : grid.props.some((q) => q.kind === item.kind && q.x === tx && q.y === ty)) return false;
      }
    }
    return true;
  };

  return {
    totals,
    list: () => [...items.values()],
    get: (id) => items.get(id) ?? null,
    placed: () => [...items.values()].filter((it) => it.state === 'placed'),

    /** @returns {boolean} */
    claim(itemId, crewIds, need) {
      const it = items.get(itemId);
      if (!it || it.state !== 'placed' || crewIds.length !== (need ?? it.weight)) return false;
      it.state = 'claimed';
      it.carriers = [...crewIds];
      return true;
    },

    /** @returns {boolean} */
    release(itemId) {
      const it = items.get(itemId);
      if (!it || it.state === 'delivered') return false;
      it.state = 'placed';
      it.carriers = [];
      return true;
    },

    /** Lift the item off the grid so it stops blocking. @returns {boolean} */
    pickUp(itemId) {
      const it = items.get(itemId);
      if (!it || (it.state !== 'placed' && it.state !== 'claimed')) return false;
      grid.removeProp(itemId);
      it.state = 'carried';
      emit('pickup', it);
      return true;
    },

    /** Put a carried item down with its origin at (x,y). @returns {boolean} */
    drop(itemId, x, y) {
      const it = items.get(itemId);
      if (!it || it.state !== 'carried' || !canPlace(it, x, y)) return false;
      grid.addProp({ id: it.id, kind: it.kind, x, y, w: it.w, d: it.d });
      it.x = x;
      it.y = y;
      it.state = 'placed';
      it.carriers = [];
      emit('drop', it);
      return true;
    },

    /** @returns {number} value delivered (0 if already delivered/unknown) */
    deliver(itemId) {
      const it = items.get(itemId);
      if (!it || it.state === 'delivered') return 0;
      if (grid.props.some((p) => p.id === itemId)) grid.removeProp(itemId);
      it.state = 'delivered';
      it.carriers = [];
      totals.delivered += it.value;
      totals.count++;
      emit('deliver', it);
      return it.value;
    },

    /** @returns {() => void} unsubscribe */
    on(type, fn) {
      handlers[type]?.add(fn);
      return () => handlers[type]?.delete(fn);
    },
  };
}
