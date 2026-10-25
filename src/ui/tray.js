import { PROP_COLORS, PROP_VISUALS } from '../data/prop-visuals.js';
import { formatMoney } from './screens.js';

const el = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

/**
 * Bottom strip of loot chips (one per kind still in the building). Tap a chip to jump to the next item of that kind.
 * @param {HTMLElement} parent HUD root's bottom container
 * @param {{onPick?:(group:object)=>void}} [opts]
 */
export function createTray(parent, { onPick } = {}) {
  const root = el('div', 'tray', parent);
  const empty = el('div', 'tray-empty', root, 'BUILDING EMPTY');
  const chips = new Map();
  let selected = null;
  let sig = '';

  const mount = (g) => {
    const b = el('button', 'chip px', root);
    b.type = 'button';
    b.dataset.kind = g.kind;
    const swatch = el('i', 'sw', b);
    swatch.style.background = PROP_COLORS[PROP_VISUALS[g.kind]?.colorKey] ?? '#8b9bb4';
    const nm = el('b', 'nm', b);
    const row = el('div', 'row', b);
    const vl = el('span', 'vl', row);
    const ct = el('span', 'ct', row);
    b.addEventListener('click', () => onPick?.(chips.get(g.kind).group));
    const c = { b, nm, ct, vl, group: g };
    chips.set(g.kind, c);
    return c;
  };

  return {
    el: root,
    /** Refresh from groupLoot() output; only touches chips whose text changed. @param {object[]} groups */
    update(groups) {
      const next = groups.map((g) => `${g.kind}:${g.count}:${g.open}:${g.value}`).join('|') + `#${selected}`;
      if (next === sig) {
        for (const g of groups) chips.get(g.kind).group = g;
        return;
      }
      sig = next;
      const seen = new Set();
      groups.forEach((g, i) => {
        const c = chips.get(g.kind) ?? mount(g);
        c.group = g;
        seen.add(g.kind);
        c.nm.textContent = g.name;
        c.ct.textContent = `x${g.count}`;
        c.ct.hidden = g.count < 2;
        c.vl.textContent = g.open > 0 ? formatMoney(g.value) : 'SEALED';
        c.b.classList.toggle('dim', g.open === 0);
        c.b.classList.toggle('sel', g.kind === selected);
        if (root.children[i + 1] !== c.b) root.insertBefore(c.b, root.children[i + 1] ?? null);
      });
      for (const [kind, c] of chips) {
        if (seen.has(kind)) continue;
        c.b.remove();
        chips.delete(kind);
      }
      empty.hidden = groups.length > 0;
    },
    /** Highlight the chip of the item currently open in the card. @param {string|null} kind */
    select(kind) {
      selected = kind;
      sig = '';
    },
    destroy() {
      root.remove();
    }
  };
}
