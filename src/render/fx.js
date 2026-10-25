const MAX_PARTICLES = 200;
const GRAVITY = 6;
const SIZE = { lo: 1, hi: 2 };
const DUST = '#ead4aa';
const SPARK = '#fee761';

/**
 * Small deterministic particle system. Particles live in grid coordinates plus height.
 * @param {number} [seed]
 */
export function createFx(seed = 7) {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let list = [];

  function add(p) {
    if (list.length >= MAX_PARTICLES) list.shift();
    list.push(p);
  }

  function chips(n, gx, gy, gz, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const v = (0.4 + rand() * 0.8) * speed;
      add({ gx, gy, gz, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 1.2 + rand() * 1.6, g: GRAVITY, life: 0.5 + rand() * 0.3, age: 0, color, big: rand() < 0.4 });
    }
  }

  function dust(n, gx, gy, gz) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      add({ gx, gy, gz, vx: Math.cos(a) * 0.5, vy: Math.sin(a) * 0.5, vz: 0.5 + rand() * 0.4, g: 0, life: 0.6 + rand() * 0.3, age: 0, color: DUST, big: true, fade: true });
    }
  }

  return {
    /**
     * @param {'debris'|'burst'|'puff'|'sparkle'} kind
     * @param {number} gx
     * @param {number} gy
     * @param {number} gz
     * @param {{color?:string}} [opts]
     */
    emit(kind, gx, gy, gz, opts = {}) {
      const color = opts.color ?? DUST;
      if (kind === 'debris') chips(3 + Math.floor(rand() * 3), gx, gy, gz, color, 1.2);
      else if (kind === 'burst') {
        chips(10 + Math.floor(rand() * 5), gx, gy, gz, color, 2);
        dust(3, gx, gy, gz);
      } else if (kind === 'puff') dust(3, gx, gy, gz);
      else if (kind === 'sparkle') {
        for (let i = 0; i < 4; i++) {
          add({ gx: gx + (rand() - 0.5) * 0.6, gy: gy + (rand() - 0.5) * 0.6, gz, vx: 0, vy: 0, vz: 0.8 + rand() * 0.6, g: 0, life: 0.6 + rand() * 0.3, age: 0, color: SPARK, big: false, fade: true });
        }
      }
    },

    /** @param {number} dt seconds */
    update(dt) {
      for (const p of list) {
        p.age += dt;
        p.vz -= p.g * dt;
        p.gx += p.vx * dt;
        p.gy += p.vy * dt;
        p.gz = Math.max(0, p.gz + p.vz * dt);
      }
      list = list.filter((p) => p.age < p.life);
    },

    /** Draw in screen space (camera.gridToScreen already applies the camera transform). */
    draw(ctx, camera) {
      const size = SIZE[camera.transform().lod] ?? 1;
      for (const p of list) {
        if (p.fade && p.age > p.life * 0.5) ctx.globalAlpha = 0.5;
        const q = camera.gridToScreen(p.gx, p.gy, p.gz);
        const n = p.big ? size + 1 : size;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(q.x - n / 2), Math.round(q.y - n / 2), n, n);
        ctx.globalAlpha = 1;
      }
    },

    clear() {
      list = [];
    },

    get count() {
      return list.length;
    },

    get particles() {
      return list;
    }
  };
}

const SHAKE_DECAY = 28;

/**
 * Decaying integer-pixel screen shake. `rand` returns [0,1).
 * @param {{rand?:()=>number, reduceMotion?:()=>boolean}} [opts]
 */
export function createShake({ rand = Math.random, reduceMotion = () => false } = {}) {
  let amp = 0;
  return {
    /** @param {number} px starting amplitude in pixels (kept small) */
    kick(px) {
      if (reduceMotion()) return;
      amp = Math.min(6, Math.max(amp, px));
    },
    update(dt) {
      amp = Math.max(0, amp - SHAKE_DECAY * dt);
    },
    offset() {
      const a = Math.floor(amp);
      if (a < 1) return { x: 0, y: 0 };
      return { x: Math.round((rand() * 2 - 1) * a), y: Math.round((rand() * 2 - 1) * a) };
    },
    clear() {
      amp = 0;
    },
    get amplitude() {
      return amp;
    }
  };
}
