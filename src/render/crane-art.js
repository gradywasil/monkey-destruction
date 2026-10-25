import { LODS, E32, OUTLINE } from './lod.js';

const BODY = E32[8];
const BODY_LO = E32[7];
const GLASS = E32[18];
const METAL = E32[21];
const ROPE = E32[2];

/**
 * Draw the crane helicopter, its ground shadow and the cable to the lifted item.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} camera
 * @param {{state:string,x:number|null,y:number|null,z:number,itemId:string|null,progress:number}|undefined} crane
 * @param {{time?:number, hangZ?:number|null}} [opts] hangZ: height of the lifted item, when it hangs below
 */
export function drawCrane(ctx, camera, crane, { time = 0, hangZ = null } = {}) {
  if (!crane || crane.state === 'idle' || crane.x == null) return;
  const { lod } = camera.transform();
  const hi = lod === 'hi';
  const u = hi ? 2 : 1;
  const ground = camera.gridToScreen(crane.x, crane.y, 0);
  const air = camera.gridToScreen(crane.x, crane.y, crane.z);
  const cx = Math.round(air.x);
  const cy = Math.round(air.y);
  ctx.save();
  ctx.fillStyle = '#18142566';
  ctx.beginPath();
  ctx.ellipse(Math.round(ground.x), Math.round(ground.y), 7 * u, 3 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  if (crane.itemId && (crane.state === 'lift' || crane.state === 'outbound')) {
    const z = hangZ ?? crane.z - 0.6;
    const end = camera.gridToScreen(crane.x, crane.y, z);
    ctx.fillStyle = ROPE;
    ctx.fillRect(cx, cy + 3 * u, u, Math.max(0, Math.round(end.y) - cy - 3 * u));
  }
  const r = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(cx + x * u, cy + y * u, w * u, h * u);
  };
  r(-6, -3, 12, 7, OUTLINE); // fuselage outline
  r(-5, -2, 10, 5, BODY);
  r(-5, 1, 10, 2, BODY_LO);
  r(1, -2, 4, 3, GLASS);
  r(-12, -2, 7, 3, OUTLINE); // tail boom
  r(-11, -1, 6, 1, BODY_LO);
  r(-13, -5, 2, 4, OUTLINE);
  r(-1, -5, 2, 2, OUTLINE); // mast
  const spin = Math.floor(time * 24) % 2;
  const len = spin ? 11 : 9;
  r(-len, -6, len * 2, 1, OUTLINE); // rotor, flickers between two spans
  r(-len + 1, -6, len * 2 - 2, 1, spin ? METAL : E32[20]);
  r(-5, 5, 10, 1, OUTLINE); // skids
  ctx.restore();
}
