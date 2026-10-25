const STEP_S = 0.5;
const FOLLOW_S = 0.7;
export const USER_HOLD_S = 6;
const DEAD_X = 0.3;
const DEAD_Y = 0.28;

/**
 * Pick the monkey the camera should follow: keep the current one while it is busy, else prefer a monkey carrying
 * loot, else any busy monkey. Ties break on id so the choice is stable.
 * @param {{id:string,pose:string,carrying?:string|null}[]} crew snapshot crew
 * @param {string|null} currentId
 * @returns {string|null}
 */
export function chooseLead(crew, currentId) {
  const busy = crew.filter((c) => c.pose !== 'idle');
  if (!busy.length) return null;
  if (currentId && busy.some((c) => c.id === currentId)) return currentId;
  const sorted = busy.slice().sort((a, b) => Number(!!b.carrying) - Number(!!a.carrying) || (a.id < b.id ? -1 : 1));
  return sorted[0].id;
}

/**
 * True when a screen point has drifted out of the central dead zone of the visible band.
 * @param {{x:number,y:number}} p screen point
 * @param {{x:number,y:number}} centre band centre
 * @param {{w:number,h:number}} band size of the free band
 */
export function outsideDeadZone(p, centre, band) {
  return Math.abs(p.x - centre.x) > band.w * DEAD_X || Math.abs(p.y - centre.y) > band.h * DEAD_Y;
}

/**
 * "Director" camera: quietly follows a working monkey so the player never has to pan, and backs off for a few
 * seconds whenever the player drags, pinches or taps something themselves.
 * @param {{camera:object, band:()=>{w:number,h:number}}} deps camera and the size of the free band between HUD bars
 */
export function createDirector({ camera, band }) {
  let hold = 0;
  let acc = 0;
  let leadId = null;
  let enabled = true;
  return {
    /** The player took the wheel: stay put for a while. */
    hold(seconds = USER_HOLD_S) {
      hold = Math.max(hold, seconds);
    },
    setEnabled(on) {
      enabled = !!on;
    },
    reset() {
      hold = 0;
      acc = 0;
      leadId = null;
    },
    lead: () => leadId,
    /** @param {number} dt @param {{crew:object[]}} snap */
    update(dt, snap) {
      hold = Math.max(0, hold - dt);
      if (!enabled || hold > 0) return;
      acc += dt;
      if (acc < STEP_S) return;
      acc = 0;
      if (camera.isBusy()) return;
      leadId = chooseLead(snap.crew, leadId);
      const lead = leadId && snap.crew.find((c) => c.id === leadId);
      if (!lead) return;
      const p = camera.gridToScreen(lead.x, lead.y, 0);
      if (outsideDeadZone(p, camera.viewCenter(), band())) camera.focus(lead.x, lead.y, { duration: FOLLOW_S });
    }
  };
}
