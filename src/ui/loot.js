import { ITEM_DEFS } from '../data/items.js';
import { MIN_WEIGHT as CRANE_MIN_WEIGHT } from '../sim/crane.js';
import { formatMoney } from './screens.js';

export const HEAVY_WEIGHT = 3;

const SHORT = { chair: 'CHAIR', monitor: 'SCREEN', plant: 'PLANT', copier: 'COPIER', cab: 'CABINET', desk: 'DESK', vend: 'VENDING', rack: 'SERVER', statue: 'STATUE', safe: 'SAFE', ceo: 'CEO DESK' };

/** @returns {string} short uppercase label that fits a tray chip. */
export const shortName = (kind) => SHORT[kind] ?? (ITEM_DEFS[kind]?.name ?? kind).toUpperCase();

/** A loose, reachable item nobody has claimed yet. */
export const isOpen = (l) => !l.sealed && !l.claimed;

/**
 * Group the floor loot by kind for the tray. Groups with something haulable come first, then richest first.
 * Within a group, ids are ordered nearest the truck first (the cheapest carry).
 * @param {{id:string,kind:string,x:number,y:number,value:number,sealed:boolean,claimed:boolean}[]} loot world.loot()
 * @param {{x:number,y:number}|null} drop truck drop tile
 * @returns {{kind:string,name:string,value:number,count:number,open:number,sealed:number,ids:string[]}[]}
 */
export function groupLoot(loot, drop) {
  const near = (l) => (drop ? Math.hypot(l.x - drop.x, l.y - drop.y) : 0);
  const byKind = new Map();
  for (const l of loot) {
    let g = byKind.get(l.kind);
    if (!g) {
      g = { kind: l.kind, name: shortName(l.kind), value: l.value, count: 0, open: 0, sealed: 0, items: [] };
      byKind.set(l.kind, g);
    }
    g.count++;
    if (isOpen(l)) g.open++;
    if (l.sealed) g.sealed++;
    g.items.push(l);
  }
  const groups = [...byKind.values()].map((g) => {
    g.items.sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || near(a) - near(b) || (a.id < b.id ? -1 : 1));
    const { items, ...rest } = g;
    return { ...rest, ids: items.map((l) => l.id) };
  });
  groups.sort((a, b) => Number(b.open > 0) - Number(a.open > 0) || b.value - a.value || (a.kind < b.kind ? -1 : 1));
  return groups;
}

/**
 * What the action card shows for a floor item. Pure, so it can be tested without a DOM.
 * @param {object} l one entry of world.loot()
 * @param {{pinnedId?:string|null, haulers:number, breachers:number, whistleCd?:number, crane?:{unlocked:boolean,state:string,cooldown:number}|null}} ctx
 * @returns {{title:string, sub:string, actions:{id:string,label:string,sub?:string,disabled?:boolean,primary?:boolean}[]}}
 */
export function itemCard(l, ctx) {
  const def = ITEM_DEFS[l.kind];
  const need = l.need;
  const sub = `${formatMoney(l.value)} / ${need} MONKEY${need > 1 ? 'S' : ''}`;
  const actions = [];
  if (l.claimed) {
    actions.push({ id: 'none', label: 'BEING HAULED', sub: 'ALREADY ON THE WAY', disabled: true });
    return { title: (def?.name ?? l.kind).toUpperCase(), sub, actions };
  }
  if (l.sealed) {
    actions.push(ctx.breachers > 0
      ? { id: 'none', label: 'SEALED IN', sub: 'BREACHERS WILL OPEN A WAY', disabled: true }
      : { id: 'hire', label: 'SEALED IN', sub: 'HIRE A BREACHER', primary: true });
    return { title: (def?.name ?? l.kind).toUpperCase(), sub, actions };
  }
  if (need > ctx.haulers) {
    actions.push({ id: 'hire', label: `NEED ${need} HAULERS`, sub: `YOU HAVE ${ctx.haulers}. TAP TO HIRE`, primary: true });
  } else {
    const pinned = ctx.pinnedId === l.id;
    actions.push({ id: 'pin', label: pinned ? 'PINNED' : 'HAUL NEXT', sub: pinned ? 'TAP TO UNPIN' : 'FIRST FREE MONKEYS GO HERE', primary: !pinned });
  }
  if (need >= HEAVY_WEIGHT) {
    const cd = Math.ceil(ctx.whistleCd ?? 0);
    actions.push({ id: 'whistle', label: 'WHISTLE', sub: cd > 0 ? `READY IN ${cd}S` : 'ALL IDLE MONKEYS COME', disabled: cd > 0 });
  }
  const cr = ctx.crane;
  if (cr?.unlocked && l.weight >= CRANE_MIN_WEIGHT) {
    const busy = cr.state !== 'idle';
    const cd = Math.ceil(cr.cooldown ?? 0);
    actions.push({ id: 'crane', label: 'CRANE', sub: busy ? 'CRANE IS BUSY' : cd > 0 ? `READY IN ${cd}S` : 'LIFT IT OUT', disabled: busy || cd > 0 });
  }
  return { title: (def?.name ?? l.kind).toUpperCase(), sub, actions };
}

/**
 * Which hire the HIRE button should suggest. Mirrors the nudge logic: breachers for sealed loot, haulers for
 * heavy loot, a baseline of haulers first, then the cheapest affordable role.
 * @param {object|null} snap world snapshot (auto mode)
 * @returns {{role:string, cost:number, canAfford:boolean}|null}
 */
export function recommendRole(snap) {
  if (!snap?.hire) return null;
  const { roles, count, cap } = snap.hire;
  if (count >= cap) return null;
  const count_ = (r) => roles[r]?.count ?? 0;
  const h = snap.hints ?? {};
  let role = 'hauler';
  if (h.sealedValue > 0 && count_('breacher') === 0 && count_('hauler') >= 3) role = 'breacher';
  else if (h.heavyWaiting > 0 || count_('hauler') < 4) role = 'hauler';
  else if (h.inspectorNear && count_('decoy') === 0) role = 'decoy';
  else if (h.sealedValue > 0 && count_('breacher') === 0) role = 'breacher';
  else if (count_('breacher') === 0) role = 'breacher';
  else role = Object.keys(roles).sort((a, b) => roles[a].cost - roles[b].cost)[0];
  const r = roles[role];
  return { role, cost: r.cost, canAfford: r.canAfford };
}
