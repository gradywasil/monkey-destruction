/**
 * HUD button swapping between the isometric ('iso') and top-down plan ('top') view.
 * The label names the current view (3D = isometric, 2D = plan).
 * @param {HTMLElement} parent HUD root
 * @param {{initial?:'iso'|'top', onChange?:(view:'iso'|'top')=>void}} [opts]
 * @returns {{el:HTMLButtonElement, view:()=>'iso'|'top', set:(v:'iso'|'top')=>void}}
 */
export function createViewToggle(parent, { initial = 'iso', onChange } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'viewtoggle px';
  const icon = document.createElement('i');
  const label = document.createElement('b');
  el.append(icon, label);
  parent.appendChild(el);
  let view = initial === 'top' ? 'top' : 'iso';

  function paint() {
    const top = view === 'top';
    icon.className = `vi ${top ? 'top' : 'iso'}`;
    label.textContent = top ? '2D' : '3D';
    el.classList.toggle('on', top);
    el.setAttribute('aria-label', top ? 'Switch to isometric view' : 'Switch to top-down view');
    el.setAttribute('aria-pressed', String(top));
  }
  paint();
  el.addEventListener('click', () => {
    view = view === 'top' ? 'iso' : 'top';
    paint();
    onChange?.(view);
  });
  return {
    el,
    view: () => view,
    set(v) {
      view = v === 'top' ? 'top' : 'iso';
      paint();
    }
  };
}
