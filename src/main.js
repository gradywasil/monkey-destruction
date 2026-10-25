import './vendor/crew-art.js';
import { createStage } from './platform/stage.js';
import { createInput } from './platform/input.js';
import { createLoop } from './loop.js';
import { createDebugOverlay } from './debug.js';
import { buildCrewAtlas } from './render/atlas.js';
import { createCamera } from './render/camera.js';
import { createWorldRenderer, drawOverlays } from './render/world-renderer.js';
import { buildWorldAtlas } from './render/world-atlas.js';
import { createDirector } from './render/director.js';
import { createPlanRenderer } from './render/plan-renderer.js';
import { loadLevel } from './sim/level.js';
import { ITEM_DEFS } from './data/items.js';
import { LAYER } from './render/iso.js';
import { createWorld } from './sim/world.js';
import { createHud, TOP_BAND, BOTTOM_BAND } from './ui/hud.js';
import { groupLoot, itemCard } from './ui/loot.js';
import { pickItem, pickEdge, pickInspector } from './ui/pick.js';
import { createFx, createShake } from './render/fx.js';
import { createAudio, tierForValue } from './platform/audio.js';
import { createSave } from './platform/save.js';
import { createScreens, formatMoney } from './ui/screens.js';
import { createTutorial, createTutorialView } from './ui/tutorial.js';
import { createNudges } from './ui/nudges.js';
import { craneFailText } from './ui/crane-ui.js';
import { drawCrane } from './render/crane-art.js';
import { createFlow } from './ui/flow.js';
import { JOBS, jobById } from './data/jobs.js';
import { computeModifiers } from './sim/modifiers.js';
import { canHaul } from './sim/crew.js';
import { stressGrid, createDriver } from './sim/stress.js';

const SKY = '#2d9be0';
const FLING_WINDOW_MS = 80;
const WHEEL_IDLE_MS = 150;
const WALK_FLIP_S = 0.2;
const HIT_FLIP_S = 0.27;
const STALL_FLIP_S = 0.35;
const FINED_SHOW_S = 1;
const HEAVY_WEIGHT = 3;
const ALERT_GAP_S = 8;
const POSE_MAP = { idle: 'idle', carry: 'air', lift: 'crouch', throw: 'launch', launch: 'launch' };
const INSPECTOR_TINT = '#e43b44';
const ROLE_TINT = { breacher: '#f77622', hauler: '#63c74d', rigger: '#0099db', decoy: '#b55088' };
const MATERIAL_COLOR = { drywall: '#ead4aa', glass: '#2ce8f5', steel: '#8b9bb4', brick: '#be4a2f' };
const FAIL_TEXT = {
  'not-enough-idle': 'NEEDS MORE MONKEYS',
  'not-enough-haulers': 'NOT ENOUGH HAULERS',
  unreachable: "CAN'T REACH THAT",
  'not-placed': 'ALREADY BUSY',
  'too-tough': 'TOO TOUGH',
  'not-breachable': "CAN'T BREACH THAT",
  'no-breacher': 'NO BREACHER FREE: HIRE ONE',
  already: 'ALREADY ON IT',
  invalid: 'PICK A FLOOR TILE',
  ended: 'ALL STRIPPED',
  'no-rigger': 'NO RIGGER FREE: HIRE ONE',
  'already-rigged': 'ALREADY RIGGED',
  'not-a-window': 'TAP A WINDOW',
  'no-decoy': 'NO DECOY FREE: HIRE ONE',
  tired: 'DECOY IS TIRED',
  'not-found': 'NO INSPECTOR'
};

const app = document.getElementById('app');
const stage = createStage(app);
let job = JOBS[0];
let levelText = await (await fetch(new URL(`./${job.levelUrl.replace(/^src\//, '')}`, import.meta.url))).text();
let levelJson = JSON.parse(levelText);
let levelName = levelJson.name;
const TRAY_HZ = 4;
let grid = loadLevel(levelText);
let world;
let planRenderer;
let isoRenderer = null;
let worldAtlas = null;
/** '2.5D' ('iso') or plan ('top'); the saved setting is applied once the save is loaded. */
let view = 'iso';
const ISO_STOP = 1;
/** Let the player see the whole building before the camera starts following monkeys. */
const OPENING_HOLD_S = 4;
const crewAtlas = buildCrewAtlas();
const iso = () => (isoRenderer ??= createWorldRenderer({ grid, worldAtlas: (worldAtlas ??= buildWorldAtlas()), crewAtlas }));
const renderer = () => (view === 'top' ? planRenderer : iso());
const makeCamera = () => createCamera({
  viewW: stage.width,
  viewH: stage.height,
  gridW: grid.width,
  gridH: grid.height,
  initial: { cx: 10, cy: 6, z: 1 }
});
let camera = makeCamera();

const bandSize = () => ({
  w: stage.width,
  h: stage.height - TOP_BAND - BOTTOM_BAND - ((stage.safeArea?.top ?? 0) + (stage.safeArea?.bottom ?? 0)) / stage.k
});

/** Reserve the HUD bars and frame the floor: whole plan centred, or the 2.5D view zoomed in on the middle. */
function fitCamera() {
  camera.setProjection(view);
  camera.setInsets({
    top: TOP_BAND + (stage.safeArea?.top ?? 0) / stage.k,
    bottom: BOTTOM_BAND + (stage.safeArea?.bottom ?? 0) / stage.k
  });
  if (view === 'top') camera.fitPlan();
  else camera.focus(grid.width / 2, grid.height / 2, { stop: ISO_STOP, duration: 1e-6 });
}
fitCamera();
const director = createDirector({ camera: { isBusy: () => camera.isBusy(), gridToScreen: (...a) => camera.gridToScreen(...a), viewCenter: () => camera.viewCenter(), focus: (...a) => camera.focus(...a) }, band: bandSize });
stage.onResize(() => {
  camera.resize(stage.width, stage.height);
  if (view === 'top') fitCamera();
});

/** Swap 2.5D <-> plan view and reframe. */
function setView(next) {
  view = next === 'top' ? 'top' : 'iso';
  save.setSetting('view', view);
  fitCamera();
  director.reset();
  director.hold(OPENING_HOLD_S);
}

const hud = createHud(app, stage);
const save = createSave();
const screens = createScreens(app, stage);
view = save.get().settings.view;
fitCamera();
const flow = createFlow('title');
const tutView = createTutorialView(app, stage);
const nudges = createNudges(hud.root, {
  onShow: (n) => {
    hud.setFocus(`hire:${n.pulse}`, 'nudge');
    feedTutorial(`nudge:${n.id}`);
  },
  onHide: () => hud.setFocus(null, 'nudge')
});
let nudgeAt = 0;
let hiredThisRun = false;
let tutorial = null;
let offTutorial = null;
let trayAt = 0;
let cardTarget = null;
const playing = () => flow.state === 'playing';

function feedTutorial(type) {
  tutorial?.feed(type);
}
let time = 0;
let lastTile = null;
const fx = createFx();
const reduceMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const shake = createShake({ reduceMotion });
const audio = createAudio({ getEnabled: () => save.get().settings.sound });
const unlockAudio = () => audio.unlock();
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlockAudio, { passive: true });
document.addEventListener('click', (e) => {
  if (e.target.closest?.('button')) audio.play('tap');
}, true);
let heliUp = false;
const finedAt = new Map();
let lastAlert = -Infinity;

/** Fetch a job's level and swap in a fresh grid/camera; call startWorld() afterwards. */
async function loadJob(next) {
  const text = await (await fetch(new URL(`./${next.levelUrl.replace(/^src\//, '')}`, import.meta.url))).text();
  job = next;
  levelText = text;
  levelJson = JSON.parse(text);
  levelName = levelJson.name;
  grid = loadLevel(text);
  camera = makeCamera();
  fitCamera();
  startWorld();
  if (window.__imi) window.__imi.camera = camera;
}

/** Debug: window.__imi.stress() swaps in the 100-crew / 150-item gilded-tower scenario. */
let stressOpts = null;
let stressDrive = null;
let stressTick = 0;
/** Debug: window.__imi.prof accumulates ms spent in renderer.draw / overlays when `prof.on`. */
const prof = { on: false, frames: 0, draw: 0, overlay: 0, snapshot: 0 };

function startWorld() {
  grid = loadLevel(levelText);
  const roles = stressOpts ? stressGrid(grid, stressOpts) : undefined;
  world = createWorld({ grid, roles, auto: true, modifiers: computeModifiers(save.get().unlocks) });
  planRenderer = createPlanRenderer({ grid, crewAtlas });
  isoRenderer = null;
  director.reset();
  director.hold(OPENING_HOLD_S);
  stressDrive = stressOpts ? createDriver(world, grid) : null;
  stressTick = 0;
  closeCard();
  fx.clear();
  shake.clear();
  finedAt.clear();
  lastAlert = -Infinity;
  nudges.reset();
  hud.reset();
  hiredThisRun = false;
  nudgeAt = 0;
  fitCamera();
  world.events.on('deliver', ({ item, value, base = value }) => {
    const d = grid.truck;
    if (d) {
      fx.emit('sparkle', d.dropX + 0.5, d.dropY + 0.5, 0.5);
      const p = camera.gridToScreen(d.dropX + 0.5, d.dropY + 0.5, 1);
      hud.floatText(`+$${value}`, p.x, p.y, value > base ? 'gold' : '');
    }
    audio.play('deliver', { tier: tierForValue(value) });
    hud.toast(ITEM_DEFS[item.kind]?.name.toUpperCase() ?? 'DELIVERED');
    feedTutorial('deliver');
  });
  const edgeMid = (e) => ({ gx: e.side === 'N' ? e.x + 0.5 : e.x, gy: e.side === 'N' ? e.y : e.y + 0.5 });
  const edgeColor = (e) => MATERIAL_COLOR[grid.edge(e.x, e.y, e.side)?.material] ?? '#c0cbdc';
  world.events.on('hit', ({ edge }) => {
    const m = edgeMid(edge);
    fx.emit('debris', m.gx, m.gy, 0.8, { color: edgeColor(edge) });
    audio.play('hit');
  });
  world.events.on('break', ({ edge, material }) => {
    feedTutorial('break');
    const m = edgeMid(edge);
    fx.emit('burst', m.gx, m.gy, 0.8, { color: MATERIAL_COLOR[material] ?? edgeColor(edge) });
    planRenderer.invalidateFloor();
    isoRenderer?.invalidateFloor();
    audio.play('break');
    shake.kick(3);
  });
  world.events.on('pickup', () => audio.play('pickup'));
  world.events.on('drop', (it) => {
    const w = it?.weight ?? it?.item?.weight ?? 0;
    if (w >= HEAVY_WEIGHT) {
      audio.play('heave');
      shake.kick(w >= 5 ? 4 : 2);
    }
  });
  world.events.on('whistle', () => audio.play('whistle'));
  world.events.on('craneLift', () => {
    heliUp = true;
    shake.kick(3);
  });
  world.events.on('fail', () => audio.play('fine'));
  world.events.on('fail', () => hud.toast('HAUL FAILED', 'warn'));
  world.events.on('blocked', () => hud.toast('PATH BLOCKED', 'warn'));
  world.events.on('hire', ({ crew: c, role }) => {
    hiredThisRun = true;
    nudges.dismiss();
    fx.emit('sparkle', c.x, c.y, 0.5);
    hud.toast(`HIRED ${role.toUpperCase()}`);
    feedTutorial('hire');
  });
  world.events.on('bailout', ({ amount, reason }) => {
    audio.play('tap');
    const what = { breacher: 'HIRE A BREACHER', haulers: 'HIRE MORE HAULERS', rigger: 'HIRE A RIGGER' }[reason] ?? 'HIRE A MONKEY';
    hud.toast(`BANK ADVANCE +$${amount.toLocaleString('en-US')}. ${what}!`);
  });
  world.events.on('boost', ({ id, level }) => hud.toast(`${id.toUpperCase()} LEVEL ${level}`));
  world.events.on('cleared', ({ elapsed, stars, profit }) => {
    if (!flow.dispatch('cleared')) return;
    audio.play('win');
    const snap = world.snapshot();
    const result = { jobName: levelName, elapsed, par: snap.economy.par, stars, fines: snap.economy.fines, profit };
    const { newBest, profile } = save.recordResult({ jobId: job.id, ...result });
    screens.showResults({ ...result, bank: profile.bank, newBest }, {
      onNext: () => {
        flow.dispatch('continue');
        startWorld();
      },
      onRetry: () => {
        startWorld();
        flow.dispatch('retry');
      }
    });
  });
  world.events.on('fine', ({ inspectorId, amount }) => {
    finedAt.set(inspectorId, time);
    audio.play('fine');
    shake.kick(2);
    hud.toast(`FINED -$${amount}!`, 'warn');
    const i = world.inspectors.find((k) => k.id === inspectorId);
    if (i) {
      const p = camera.gridToScreen(i.x, i.y, 1.4);
      hud.floatText(`-$${amount}`, p.x, p.y);
    }
  });
  world.events.on('alert', () => {
    if (time - lastAlert < ALERT_GAP_S) return;
    lastAlert = time;
    audio.play('alert');
    hud.toast('INSPECTOR SUSPICIOUS!', 'warn');
  });
  world.events.on('rigged', () => hud.toast('WINDOW RIGGED'));
  world.events.on('shove', ({ edge }) => {
    const z = world.snapshot().zips.find((k) => k.edge.x === edge.x && k.edge.y === edge.y && k.edge.side === edge.side);
    if (z) fx.emit('sparkle', z.net.x + 0.5, z.net.y + 0.5, 0.5);
    hud.toast('SHOVED OUT THE WINDOW!');
  });
  world.events.on('stallStart', () => hud.toast('STALLING THE INSPECTOR!'));
  world.events.on('decoyDone', () => hud.toast('DECOY NEEDS A BREAK', 'warn'));
  trayAt = 0;
  window.__imi = { ...window.__imi, world, grid, renderer: planRenderer, director, setView };
}

/** World point (grid units) the tutorial arrow should point at, or null. Edges resolve to their midpoint. */
function tutorialTarget(step, snap) {
  const key = step.target;
  if (!key) return null;
  if (key === 'item') {
    const crew = snap.crew;
    const cx = crew.reduce((a, c) => a + c.x, 0) / (crew.length || 1);
    const cy = crew.reduce((a, c) => a + c.y, 0) / (crew.length || 1);
    let best = Infinity;
    let at = null;
    for (const it of world.items.list()) {
      if (it.state !== 'placed' || it.weight > 1 || !world.path.adjacentTiles(it).length) continue;
      const d = Math.hypot(it.x - cx, it.y - cy);
      if (d < best) { best = d; at = { x: it.x + 0.5, y: it.y + 0.5, z: 1.2 }; }
    }
    return at;
  }
  if (key === 'truck') return grid.truck ? { x: grid.truck.dropX + 0.5, y: grid.truck.dropY + 0.5, z: 1.2 } : null;
  return null;
}

/** Pulsing frame around the card's target and a bobbing pin over the "haul next" item. */
function drawSelection(octx, cam, snap) {
  const frame = (x, y, w, d, color) => {
    const pts = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(([gx, gy]) => cam.gridToScreen(gx, gy, 0));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    octx.strokeStyle = color;
    octx.lineWidth = 2;
    octx.lineJoin = 'miter';
    octx.beginPath();
    pts.forEach((p, i) => octx[i ? 'lineTo' : 'moveTo'](Math.round(p.x), Math.round(p.y)));
    octx.closePath();
    octx.stroke();
    return { x0: Math.round(Math.min(...xs)), y0: Math.round(Math.min(...ys)) - 8, x1: Math.round(Math.max(...xs)), y1: Math.round(Math.max(...ys)) };
  };
  if (cardTarget?.type === 'item') {
    const l = world.lootOf(cardTarget.id);
    if (l && Math.floor(time * 4) % 2 === 0) frame(l.x, l.y, l.w, l.d, '#fee761');
  }
  if (snap.priorityId) {
    const l = world.lootOf(snap.priorityId);
    if (l) {
      const b = frame(l.x, l.y, l.w, l.d, '#63c74d');
      const cx = Math.round((b.x0 + b.x1) / 2);
      const bob = Math.round(Math.sin(time * 6) * 2);
      octx.fillStyle = '#181425';
      octx.fillRect(cx - 7, b.y0 - 16 + bob, 14, 10);
      octx.fillRect(cx - 3, b.y0 - 8 + bob, 6, 6);
      octx.fillStyle = '#63c74d';
      octx.fillRect(cx - 5, b.y0 - 14 + bob, 10, 6);
      octx.fillRect(cx - 1, b.y0 - 8 + bob, 2, 4);
    }
  }
}

/** Bobbing arrow over whatever the current tutorial step wants tapped. */
function drawTutorialArrow(octx, cam, snap) {
  const step = tutorial?.current();
  if (!step || flow.state !== 'playing') return;
  const at = tutorialTarget(step, snap);
  if (!at) return;
  const p = cam.gridToScreen(at.x, at.y, at.z);
  tutView.place(p.y > stage.height * 0.45 ? 'high' : 'low');
  const bob = Math.round(Math.sin(time * 6) * 3);
  const x = Math.round(p.x);
  const y = Math.round(p.y) + bob;
  octx.fillStyle = '#181425';
  octx.fillRect(x - 8, y - 18, 16, 10);
  octx.fillRect(x - 4, y - 8, 8, 8);
  octx.fillRect(x - 2, y, 4, 2);
  octx.fillStyle = '#fee761';
  octx.fillRect(x - 6, y - 16, 12, 6);
  octx.fillRect(x - 2, y - 10, 4, 8);
}

const input = createInput(stage.canvas, { toLogical: stage.toLogical });
let samples = [];
input.on('drag', ({ dx, dy }) => {
  director.hold();
  const now = performance.now();
  samples.push({ t: now, dx, dy });
  samples = samples.filter((s) => now - s.t <= FLING_WINDOW_MS);
  camera.panBy(dx, dy);
});
input.on('dragend', () => {
  const now = performance.now();
  const recent = samples.filter((s) => now - s.t <= FLING_WINDOW_MS);
  samples = [];
  if (!recent.length) return;
  const secs = Math.max(0.016, (now - recent[0].t) / 1000);
  camera.fling(recent.reduce((a, s) => a + s.dx, 0) / secs, recent.reduce((a, s) => a + s.dy, 0) / secs);
});
input.on('pinchstart', () => {
  director.hold();
  camera.zoomBy(1);
});
input.on('pinch', ({ cx, cy, delta, dcx, dcy }) => {
  camera.panBy(dcx, dcy);
  camera.zoomBy(delta, cx, cy);
});
input.on('pinchend', () => camera.endGesture());
let wheelTimer = 0;
input.on('wheel', ({ x, y, scale }) => {
  director.hold();
  camera.zoomBy(scale, x, y);
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => camera.endGesture(), WHEEL_IDLE_MS);
});
const failText = (res) => (res.reason === 'not-enough-idle' && res.needed
  ? `NEEDS ${res.needed} MONKEYS`
  : FAIL_TEXT[res.reason] ?? 'NOPE');

function whistleItem(item) {
  const res = world.commands.whistle(item.id);
  if (res.ok) {
    feedTutorial('whistle');
    hud.toast(`WHISTLE! ${res.crewIds.length} MONKEYS`);
    return true;
  }
  hud.toast(failText(res), 'warn');
  return false;
}

function sendDecoy(target) {
  const insp = target ?? world.inspectors.slice().sort((a, b) => {
    const idle = world.crew.find((c) => c.role === 'decoy' && c.state === 'idle') ?? world.crew.find((c) => c.role === 'decoy');
    const o = idle ?? { x: 0, y: 0 };
    return Math.hypot(a.x - o.x, a.y - o.y) - Math.hypot(b.x - o.x, b.y - o.y);
  })[0];
  if (!insp) {
    hud.toast('NO INSPECTOR', 'warn');
    return;
  }
  const res = world.commands.decoy(insp.id);
  if (res.ok) feedTutorial('decoy');
  hud.toast(res.ok ? 'DECOY SENT!' : failText(res), res.ok ? 'info' : 'warn');
}

hud.onHire((role) => {
  if (!playing()) return;
  const res = world.commands.hire(role);
  if (res.ok) return;
  if (res.reason === 'cash') hud.toast(`NEED ${formatMoney(world.hireCost(role))}`, 'warn');
  else if (res.reason === 'cap') hud.toast('CREW FULL', 'warn');
});

hud.onBoost((id) => {
  if (!playing()) return;
  const res = world.commands.boost(id);
  if (!res.ok && res.reason === 'cash') hud.toast(`NEED ${formatMoney(world.boostCost(id))}`, 'warn');
});

const itemCenter = (l) => ({ x: l.x + l.w / 2, y: l.y + l.d / 2 });
const edgeMid = (e) => ({ x: e.side === 'N' ? e.x + 0.5 : e.x, y: e.side === 'N' ? e.y : e.y + 0.5 });
const edgeName = (e) => {
  const def = grid.edge(e.x, e.y, e.side);
  if (def?.type === 'window') return 'WINDOW';
  if (def?.type === 'door') return 'DOOR';
  return `${(def?.material ?? 'wall').toUpperCase()} WALL`;
};
const crewCount = (role) => world.crew.reduce((n, c) => n + (c.role === role ? 1 : 0), 0);
const haulerCount = () => world.crew.reduce((n, c) => n + (canHaul(c.role) ? 1 : 0), 0);

/** What the open card should show right now, or null when its target is gone. */
function cardModel(target, snap) {
  if (target.type === 'item') {
    const l = world.lootOf(target.id);
    if (!l) return null;
    return {
      model: itemCard(l, {
        pinnedId: snap.priorityId,
        haulers: haulerCount(),
        breachers: crewCount('breacher'),
        whistleCd: snap.whistleCooldown,
        crane: snap.crane
      }),
      at: itemCenter(l),
      z: 0.6
    };
  }
  if (target.type === 'edge') {
    const e = target.edge;
    const def = grid.edge(e.x, e.y, e.side);
    if (!def || def.type === 'none' || def.broken || def.hp <= 0) return null;
    const idle = (role) => world.crew.some((c) => c.role === role && c.state === 'idle');
    const actions = [];
    const win = def.type === 'window';
    const role = win ? 'rigger' : 'breacher';
    const ready = idle(role);
    const busyMsg = crewCount(role) ? `ALL ${role.toUpperCase()}S ARE BUSY` : `HIRE A ${role.toUpperCase()} FIRST`;
    actions.push({
      id: win ? 'rig' : 'breach',
      label: win ? 'RIG WINDOW' : 'BREACH',
      sub: ready ? (win ? 'SHOVE LOOT OUT HERE' : 'SMASH IT OPEN') : busyMsg,
      primary: ready,
      disabled: !ready
    });
    if (!crewCount(role)) actions.push({ id: 'hire', label: 'OPEN HIRE', sub: 'GET THE RIGHT MONKEY' });
    return { model: { title: edgeName(e), sub: `STRENGTH ${Math.ceil(def.hp)}`, actions }, at: edgeMid(e), z: 0.8 };
  }
  if (target.type === 'inspector') {
    const i = world.inspectors.find((k) => k.id === target.id);
    if (!i) return null;
    const decoys = world.crew.filter((c) => c.role === 'decoy' && c.state === 'idle').length;
    const hired = crewCount('decoy');
    return {
      model: {
        title: 'INSPECTOR',
        sub: 'FINES YOU IF HE SEES WORK',
        actions: [{ id: 'decoy', label: 'DISTRACT', sub: decoys ? 'SEND A DECOY TO STALL HIM' : hired ? 'ALL DECOYS ARE BUSY' : 'HIRE A DECOY FIRST', primary: decoys > 0, disabled: !decoys }]
      },
      at: { x: i.x, y: i.y },
      z: 1.4
    };
  }
  return null;
}

function closeCard() {
  cardTarget = null;
  hud.card.hide();
  hud.tray.select(null);
}

function openCard(target) {
  const snap = world.snapshot();
  const m = cardModel(target, snap);
  if (!m) return closeCard();
  cardTarget = target;
  director.hold();
  hud.tray.select(target.type === 'item' ? world.lootOf(target.id)?.kind ?? null : null);
  hud.card.show(m.model, camera.gridToScreen(m.at.x, m.at.y, m.z));
  feedTutorial('card');
}

/** Keep the open card on its target and its buttons current; close it when the target is gone. */
function syncCard(snap) {
  if (!cardTarget) return;
  const m = cardModel(cardTarget, snap);
  if (!m) return closeCard();
  hud.card.update(m.model, camera.gridToScreen(m.at.x, m.at.y, m.z));
}

hud.card.onAction((id, action) => {
  const t = cardTarget;
  if (!t || !playing()) return;
  if (id === 'none') return;
  if (id === 'disabled') {
    hud.toast(action.sub ?? 'NOT RIGHT NOW', 'warn');
    return;
  }
  if (id === 'hire') {
    closeCard();
    hud.openHire();
    return;
  }
  if (t.type === 'item') {
    const item = world.items.get(t.id);
    if (!item) return closeCard();
    if (id === 'pin') {
      const res = world.commands.prioritize(item.id);
      if (res.ok) {
        hud.toast(res.cleared ? 'UNPINNED' : `${ITEM_DEFS[item.kind]?.name.toUpperCase() ?? 'LOOT'}: HAULING NEXT`);
        if (!res.cleared) feedTutorial('pin');
      } else if (res.reason === 'not-enough-haulers') {
        hud.toast(`NEEDS ${res.needed} HAULERS`, 'warn');
      } else {
        hud.toast(res.reason === 'unreachable' ? 'SEALED IN: BREACH A WALL' : FAIL_TEXT[res.reason] ?? 'NOPE', 'warn');
      }
      closeCard();
    } else if (id === 'whistle') {
      if (whistleItem(item)) closeCard();
    } else if (id === 'crane') {
      const res = world.commands.crane(item.id);
      hud.toast(res.ok ? 'CRANE INBOUND!' : craneFailText(res.reason), res.ok ? 'info' : 'warn');
      if (res.ok) closeCard();
    }
  } else if (t.type === 'edge') {
    const res = id === 'rig' ? world.commands.rig(t.edge) : world.commands.breach(t.edge);
    hud.toast(res.ok ? (id === 'rig' ? 'RIGGER ON THE WAY' : 'BREACHER ON THE WAY') : failText(res), res.ok ? 'info' : 'warn');
    if (res.ok) closeCard();
  } else if (t.type === 'inspector') {
    sendDecoy(world.inspectors.find((k) => k.id === t.id));
    closeCard();
  }
});

input.on('tap', ({ x, y }) => {
  if (!playing() || hud.sheetOpen()) return;
  lastTile = renderer().pickTile(x, y, camera);
  const insp = pickInspector(world, camera, x, y);
  if (insp) return openCard({ type: 'inspector', id: insp.id });
  const item = pickItem(world, camera, x, y);
  if (item) return openCard({ type: 'item', id: item.id });
  const edge = pickEdge(world, camera, x, y);
  if (edge) return openCard({ type: 'edge', edge });
  closeCard();
});
input.on('longpressstart', ({ x, y }) => {
  if (!playing() || hud.sheetOpen()) return;
  const item = pickItem(world, camera, x, y);
  if (item) whistleItem(item);
});

/** Tray chip tapped: open the next item of that kind (cycling through the group on repeat taps). */
const trayCursor = new Map();
hud.onTrayPick((g) => {
  if (!playing() || !g.ids.length) return;
  const n = (trayCursor.get(g.kind) ?? -1) + 1;
  const id = g.ids[n % g.ids.length];
  trayCursor.set(g.kind, n % g.ids.length);
  const l = world.lootOf(id);
  if (!l) return;
  const c = itemCenter(l);
  camera.focus(c.x, c.y, { duration: 0.25 });
  director.hold();
  openCard({ type: 'item', id });
});

function update(dt) {
  time += dt;
  if (playing()) {
    stressDrive?.(stressTick++);
    world.tick(dt);
  }
  fx.update(dt);
  shake.update(dt);
  const flying = playing() && !!world.snapshot().crane?.itemId;
  if (!flying) heliUp = false;
  audio.setCraneLoop(flying);
  camera.update(dt);
  if (playing()) director.update(dt, world.snapshot());
  if (playing()) {
    nudges.tick(dt);
    tutorial?.tick(dt);
  }
}

function render() {
  const { ctx } = stage;
  ctx.fillStyle = SKY;
  ctx.fillRect(0, 0, stage.width, stage.height);
  const t0 = prof.on ? performance.now() : 0;
  const snap = world.snapshot();
  const t1 = prof.on ? performance.now() : 0;
  const so = shake.offset();
  ctx.save();
  ctx.translate(so.x, so.y);
  const drawables = snap.crew.map((c, i) => {
    const phase = time + i * 0.07;
    let pose = POSE_MAP[c.pose] ?? 'idle';
    if (c.pose === 'walk') pose = Math.floor(phase / WALK_FLIP_S) % 2 ? 'air' : 'idle';
    else if (c.pose === 'stall') pose = Math.floor(phase / STALL_FLIP_S) % 2 ? 'air' : 'idle';
    else if (c.pose === 'hit') pose = Math.floor(phase / HIT_FLIP_S) % 2 ? 'impact' : 'crouch';
    return {
      gx: c.x, gy: c.y, gz: 0, w: 0, d: 0, layer: LAYER.CHARACTER,
      crew: { variant: crewAtlas.variantFor(c.role, i), pose, facing: c.facing },
      tint: ROLE_TINT[c.role]
    };
  });
  snap.inspectors.forEach((n, i) => {
    const pose = n.state === 'patrol' ? (Math.floor((time + i * 0.07) / WALK_FLIP_S) % 2 ? 'air' : 'idle') : 'idle';
    drawables.push({
      gx: n.x, gy: n.y, gz: 0, w: 0, d: 0, layer: LAYER.CHARACTER,
      crew: { variant: crewAtlas.variantFor('inspector', i), pose, facing: n.facing },
      tint: INSPECTOR_TINT
    });
  });
  for (const it of snap.carried) {
    drawables.push({ gx: it.x, gy: it.y, gz: it.z, w: 0, d: 0, layer: LAYER.EFFECT, prop: { kind: it.kind } });
  }
  const t2 = prof.on ? performance.now() : 0;
  let overlayMs = 0;
  renderer().draw(ctx, camera, drawables, {
    viewW: stage.width,
    viewH: stage.height,
    overlay: (octx, cam) => {
      const o0 = prof.on ? performance.now() : 0;
      const finedIds = new Set();
      for (const [id, at] of finedAt) if (time - at < FINED_SHOW_S) finedIds.add(id);
      drawOverlays(octx, cam, { snapshot: snap, world, chainPreview: null, finedIds });
      drawSelection(octx, cam, snap);
      drawTutorialArrow(octx, cam, snap);
      drawCrane(octx, cam, snap.crane, { time, hangZ: snap.carried.find((c) => c.id === snap.crane.itemId)?.z ?? null });
      fx.draw(octx, cam);
      if (prof.on) overlayMs = performance.now() - o0;
    }
  });
  if (prof.on) {
    const t3 = performance.now();
    prof.frames++;
    prof.snapshot += t1 - t0;
    prof.overlay += overlayMs;
    prof.draw += t3 - t2 - overlayMs;
  }
  ctx.restore();
  hud.update(snap, { levelName, jobNum: job?.number });
  syncCard(snap);
  if (playing() && time - trayAt >= 1 / TRAY_HZ) {
    trayAt = time;
    hud.tray.update(groupLoot(world.loot(), grid.truck ? { x: grid.truck.dropX, y: grid.truck.dropY } : null));
  }
  if (playing() && time - nudgeAt >= 0.5) {
    nudgeAt = time;
    nudges.offer(snap, { hired: hiredThisRun, tutorialHire: tutorial?.current()?.id === 'hire' });
  }
  const step = tutorial?.current();
  if (step?.id === 'hire' && snap.hire) {
    const r = snap.hire.roles.hauler;
    tutView.setText(r.canAfford ? step.text : `HIRE A HAULER: ${formatMoney(r.cost)} — SAVE UP`);
  }
}

const loop = createLoop({ update, render, hz: 30 });
const debug = createDebugOverlay(app, () => {
  const s = camera.state;
  return { zoom: s.z, lod: s.lod, scale: s.scale, tile: lastTile ? `${lastTile.x},${lastTile.y}` : '-' };
});

function applySetting(key, value) {
  if (key === 'view3d') {
    setView(value ? 'iso' : 'top');
    return;
  }
  save.setSetting(key, value);
  if (key === 'sound') audio.refresh();
  if (key === 'debug') debug.setVisible(value);
  else if (key === 'hints') {
    if (!value) {
      tutView.hide();
      hud.setFocus(null);
      offTutorial?.();
      tutorial = null;
    } else if (!tutorial) {
      beginTutorial(true);
    }
  }
}

function beginTutorial(force = false) {
  offTutorial?.();
  offTutorial = null;
  tutorial = null;
  tutView.hide();
  hud.setFocus(null);
  const p = save.get();
  if (!force && !(p.settings.hints && !p.tutorial.done)) return;
  if (p.tutorial.done) return;
  tutorial = createTutorial({ startAt: p.tutorial.step });
  const t = tutorial;
  offTutorial = t.onChange((step) => {
    tutView.show(step);
    hud.setFocus(step?.focus ?? null);
    save.setTutorial({ step: t.index(), done: t.done() });
  });
  tutView.onSkip = () => t.skip();
  if (t.done()) {
    tutorial = null;
    return;
  }
  t.start();
}

function showTitle() {
  tutView.hide();
  hud.setFocus(null);
  const p = save.get();
  screens.showTitle({ bank: p.bank, jobs: p.jobs, canContinue: false }, { onPlay: () => flow.dispatch('play') });
}

function showBriefing() {
  const crew = {};
  for (const c of world.crew) crew[c.role] = (crew[c.role] ?? 0) + 1;
  const info = {
    id: job.id,
    name: job.name,
    tagline: job.tagline,
    blurb: levelJson.briefing?.blurb ?? '',
    par: world.job.par,
    hazards: levelJson.briefing?.hazards ?? [],
    crew,
    number: job.number,
    bestStars: save.get().jobs[job.id]?.bestStars ?? 0
  };
  screens.showBriefing(info, {
    onStart: () => {
      startWorld();
      flow.dispatch('start');
    },
    onBack: () => flow.dispatch('back')
  });
}

function showMap() {
  tutView.hide();
  hud.setFocus(null);
  const refresh = () => screens.showMap(save.get(), {
    onPlay: (id) => loadJob(jobById(id)).then(() => flow.dispatch('select')),
    onBuyJob: (j) => { save.purchase('job', j.id, j.cost); refresh(); },
    onBuyUpgrade: (u) => { save.purchase('upgrade', u.id, u.cost); refresh(); },
    onBack: () => flow.dispatch('back')
  });
  refresh();
}

function showPause() {
  screens.showPause({ settings: { ...save.get().settings, view3d: save.get().settings.view === 'iso' } }, {
    onResume: () => flow.dispatch('resume'),
    onReplayTutorial: () => {
      save.setTutorial({ step: 0, done: false });
      startWorld();
      flow.dispatch('restart');
      beginTutorial(true);
    },
    onRestart: () => {
      startWorld();
      flow.dispatch('restart');
    },
    onQuit: () => {
      flow.dispatch('quit');
      startWorld();
    },
    onSetting: applySetting
  });
}

flow.onChange((next, prev, event) => {
  if (next !== 'playing') {
    tutView.hide();
    hud.setFocus(null);
  } else if (event === 'resume' && tutorial && !tutorial.done()) {
    const st = tutorial.current();
    if (st) {
      tutView.show(st);
      hud.setFocus(st.focus ?? null);
    }
  }
  if (next === 'playing') audio.startMusic();
  else audio.pauseMusic();
  if (next === 'title') showTitle();
  else if (next === 'map') showMap();
  else if (next === 'briefing') showBriefing();
  else if (next === 'paused') showPause();
  else if (next === 'playing') {
    screens.hide();
    if (event === 'start' || event === 'restart' || event === 'retry') {
      if (event === 'start' || prev === 'results') beginTutorial();
    }
  } else if (next === 'results') {
    closeCard();
  }
});

const pause = () => flow.dispatch('pause');
hud.onPause = pause;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});

startWorld();
debug.setVisible(save.get().settings.debug);
showTitle();
loop.start();

function breakEdge(x, y, side) {
  grid.damageEdge(x, y, side, Infinity);
  planRenderer.invalidateFloor();
  isoRenderer?.invalidateFloor();
}

async function stress(opts = { crew: 100, items: 150 }) {
  const gilded = JOBS.find((j) => /gilded/.test(j.levelUrl)) ?? JOBS[JOBS.length - 1];
  stressOpts = opts;
  await loadJob(gilded);
  for (const e of ['play', 'select', 'start']) flow.dispatch(e);
  return { crew: world.crew.length, items: world.items.list().length };
}

window.__imi = { nudges, stress, prof, loadJob, stage, camera, loop, breakEdge, hud, world, grid, renderer: planRenderer, fx, flow, save, audio, shake, screens, openCard, closeCard, director, setView };
