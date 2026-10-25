const el = (tag, cls, parent, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

const WIDTH = 224;
const EDGE = 8;
const GAP = 22;

/**
 * Where to put a card of size w x h so it points at an anchor without covering it or leaving the free band.
 * Prefers above the anchor, falls back to below, then clamps. Pure.
 * @param {{x:number,y:number}} anchor logical px
 * @param {{w:number,h:number}} size
 * @param {{width:number,top:number,bottom:number}} area free band between the HUD bars
 * @returns {{left:number, top:number, below:boolean}}
 */
export function placeCard(anchor, size, area) {
  const left = Math.min(area.width - EDGE - size.w, Math.max(EDGE, Math.round(anchor.x - size.w / 2)));
  const above = anchor.y - GAP - size.h;
  const below = anchor.y + GAP;
  let top;
  let isBelow = false;
  if (above >= area.top) top = above;
  else if (below + size.h <= area.bottom) {
    top = below;
    isBelow = true;
  } else top = Math.max(area.top, Math.min(area.bottom - size.h, above));
  return { left, top: Math.round(top), below: isBelow };
}

/**
 * Action card that pops up next to whatever the player tapped. Shows only the buttons that apply.
 * @param {HTMLElement} parent HUD root
 * @param {{width:number,height:number}} stage logical size source (read live)
 * @param {{top?:()=>number, bottom?:()=>number}} [bounds] free band between the HUD bars
 */
export function createCard(parent, stage, bounds = {}) {
  const root = el('div', 'card px', parent);
  root.hidden = true;
  const head = el('div', 'chead', root);
  const title = el('b', '', head);
  const sub = el('small', '', head);
  const acts = el('div', 'cacts', root);
  let onAction = () => {};
  let key = '';
  let anchor = null;
  let open = false;

  const render = (model) => {
    const k = JSON.stringify(model);
    if (k === key) return;
    key = k;
    title.textContent = model.title;
    sub.textContent = model.sub ?? '';
    acts.textContent = '';
    for (const a of model.actions) {
      const b = el('button', `cbtn${a.primary ? ' primary' : ''}${a.disabled ? ' off' : ''}`, acts);
      b.type = 'button';
      b.dataset.action = a.id;
      el('b', '', b, a.label);
      if (a.sub) el('small', '', b, a.sub);
      b.addEventListener('click', () => onAction(a.disabled ? 'disabled' : a.id, a));
    }
  };

  const place = () => {
    if (!open || !anchor) return;
    const w = WIDTH;
    const h = root.offsetHeight || 120;
    const p = placeCard(anchor, { w, h }, {
      width: stage.width,
      top: bounds.top?.() ?? 0,
      bottom: bounds.bottom?.() ?? stage.height
    });
    root.style.left = `${p.left}px`;
    root.style.top = `${p.top}px`;
    root.classList.toggle('below', p.below);
  };

  return {
    el: root,
    isOpen: () => open,
    /** Open (or refresh) the card. @param {{title:string,sub?:string,actions:object[]}} model @param {{x:number,y:number}} at */
    show(model, at) {
      render(model);
      anchor = at;
      open = true;
      root.hidden = false;
      place();
    },
    /** Follow a moving anchor and refresh the buttons without reopening. */
    update(model, at) {
      if (!open) return;
      render(model);
      if (at) anchor = at;
      place();
    },
    hide() {
      open = false;
      key = '';
      root.hidden = true;
    },
    onAction(fn) {
      onAction = fn ?? (() => {});
    },
    destroy() {
      root.remove();
    }
  };
}
