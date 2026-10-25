export const MAX_VOICES = 12;
export const MASTER_GAIN = 0.5;
const STEPS_PER_BAR = 8;
const BARS = 16;
const LOOKAHEAD_S = 0.2;
const TICK_MS = 50;

export const midiToHz = (m) => 440 * 2 ** ((m - 69) / 12);

/** Pitch multiplier for a delivery: higher value tier, higher cha-ching. */
export function tierForValue(value) {
  if (value >= 1000) return 4;
  if (value >= 500) return 3;
  if (value >= 200) return 2;
  if (value >= 80) return 1;
  return 0;
}
export const tierPitch = (tier) => 2 ** (tier * 2 / 12);

/** Caps simultaneous voices and rate-limits repeated sound names. */
export function createVoiceLimiter({ max = MAX_VOICES, minGap = {} } = {}) {
  const active = [];
  const last = new Map();
  return {
    /** @returns {boolean} whether the voice may play */
    request(name, now, dur) {
      for (let i = active.length - 1; i >= 0; i--) if (active[i] <= now) active.splice(i, 1);
      if (now - (last.get(name) ?? -Infinity) < (minGap[name] ?? 0)) return false;
      if (active.length >= max) return false;
      last.set(name, now);
      active.push(now + dur);
      return true;
    },
    get active() {
      return active.length;
    }
  };
}

const PROG = [57, 53, 48, 55]; // Am F C G roots (A3 F3 C3 G3)
const CHORDS = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];

/** 16 bars x 8 eighth-steps of {bass, arp} MIDI notes (null = rest). Deterministic. */
export function musicPattern(bars = BARS) {
  const steps = [];
  for (let b = 0; b < bars; b++) {
    const root = PROG[Math.floor(b / 2) % 4];
    const chord = CHORDS[Math.floor(b / 2) % 4];
    const shape = b % 4 < 2 ? [0, 1, 2, 1, 0, 1, 2, 1] : [0, 2, 1, 2, 0, 2, 1, 2];
    for (let s = 0; s < STEPS_PER_BAR; s++) {
      const bass = s % 4 === 0 ? root - 12 : s % 4 === 2 ? root - 12 + (b % 8 === 7 ? 7 : 0) : null;
      const arp = b < 2 && s % 2 ? null : root + 12 + chord[shape[s]];
      steps.push({ bass, arp });
    }
  }
  return steps;
}

/**
 * Pure lookahead scheduling: given the next step time and now, return the steps due
 * within the window, plus the advanced cursor.
 */
export function scheduleSteps({ nextTime, index, now, stepDur, total, lookahead = LOOKAHEAD_S }) {
  const due = [];
  while (nextTime < now + lookahead) {
    due.push({ time: nextTime, index });
    nextTime += stepDur;
    index = (index + 1) % total;
  }
  return { due, nextTime, index };
}

/**
 * Synthesised audio. `ctxFactory` is injectable for tests.
 * @param {{getEnabled:()=>boolean, ctxFactory?:()=>any}} opts
 */
export function createAudio({ getEnabled = () => true, ctxFactory } = {}) {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let musicOn = false;
  let musicTimer = 0;
  let musicGain = null;
  let nextTime = 0;
  let stepIdx = 0;
  let rotor = null;
  const pattern = musicPattern();
  const stepDur = 60 / 132 / 2;
  const limiter = createVoiceLimiter({ minGap: { hit: 0.07, pickup: 0.05, tap: 0.04, fine: 0.2, deliver: 0.05 } });

  const make = ctxFactory ?? (() => {
    const C = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return C ? new C() : null;
  });

  function ensure() {
    if (ctx) return ctx;
    try {
      ctx = make();
    } catch {
      ctx = null;
    }
    if (!ctx) return null;
    master = ctx.createGain();
    master.gain.value = getEnabled() ? MASTER_GAIN : 0;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(master);
    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      d[i] = s / 2147483648 - 1;
    }
    return ctx;
  }

  function osc(type, f0, f1, t, dur, vol, dest = master) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(t, dur, vol, freq = 1200, type = 'lowpass') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const SOUNDS = {
    tap: { dur: 0.08, play: (t) => osc('square', 660, 880, t, 0.06, 0.18) },
    pickup: { dur: 0.12, play: (t) => osc('triangle', 330, 660, t, 0.1, 0.3) },
    deliver: {
      dur: 0.5,
      play: (t, { tier = 0 } = {}) => {
        const p = tierPitch(tier);
        osc('square', 988 * p, 988 * p, t, 0.09, 0.2);
        osc('square', 1319 * p, 1319 * p, t + 0.09, 0.3, 0.2);
        if (tier >= 2) osc('triangle', 1976 * p, 1976 * p, t + 0.18, 0.3, 0.15);
      }
    },
    hit: { dur: 0.15, play: (t) => { osc('sine', 140, 50, t, 0.12, 0.5); noise(t, 0.05, 0.25, 500); } },
    break: { dur: 0.5, play: (t) => { noise(t, 0.45, 0.6, 2500); osc('sawtooth', 120, 40, t, 0.3, 0.3); } },
    heave: { dur: 0.4, play: (t) => { osc('sawtooth', 110, 55, t, 0.3, 0.35); noise(t, 0.2, 0.2, 300); } },
    whistle: { dur: 0.45, play: (t) => { osc('sine', 1100, 1500, t, 0.18, 0.3); osc('sine', 1500, 1900, t + 0.2, 0.22, 0.3); } },
    alert: { dur: 0.5, play: (t) => { osc('square', 440, 440, t, 0.12, 0.2); osc('square', 330, 330, t + 0.14, 0.12, 0.2); osc('square', 247, 247, t + 0.28, 0.2, 0.2); } },
    fine: { dur: 0.4, play: (t) => osc('sawtooth', 150, 90, t, 0.35, 0.35) },
    win: { dur: 1.2, play: (t) => [523, 659, 784, 1047].forEach((f, i) => osc('square', f, f, t + i * 0.13, i === 3 ? 0.5 : 0.14, 0.2)) },
    lose: { dur: 1.2, play: (t) => [392, 330, 262, 196].forEach((f, i) => osc('triangle', f, f, t + i * 0.2, 0.35, 0.3)) }
  };

  function play(name, opts) {
    if (!getEnabled() || !ensure()) return false;
    const def = SOUNDS[name];
    if (!def) return false;
    const now = ctx.currentTime;
    if (!limiter.request(name, now, def.dur)) return false;
    def.play(now, opts);
    return true;
  }

  function pump() {
    if (!musicOn || !ctx) return;
    const r = scheduleSteps({ nextTime, index: stepIdx, now: ctx.currentTime, stepDur, total: pattern.length });
    nextTime = r.nextTime;
    stepIdx = r.index;
    for (const { time, index } of r.due) {
      const st = pattern[index];
      if (st.bass != null) osc('triangle', midiToHz(st.bass), midiToHz(st.bass), time, stepDur * 1.8, 0.5, musicGain);
      if (st.arp != null) osc('square', midiToHz(st.arp), midiToHz(st.arp), time, stepDur * 0.8, 0.18, musicGain);
    }
  }

  function setCraneLoop(on) {
    if (!ctx) return;
    if (on && !rotor && getEnabled()) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 220;
      const g = ctx.createGain();
      g.gain.value = 0.25;
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 14;
      lg.gain.value = 0.2;
      lfo.connect(lg);
      lg.connect(g.gain);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start();
      lfo.start();
      rotor = { src, lfo };
    } else if (!on && rotor) {
      rotor.src.stop();
      rotor.lfo.stop();
      rotor = null;
    }
  }

  return {
    /** Call from a user gesture: creates/resumes the context. */
    unlock() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume?.();
      return true;
    },
    play,
    startMusic() {
      if (musicOn || !ensure()) return;
      musicOn = true;
      nextTime = ctx.currentTime + 0.05;
      musicTimer = setInterval(pump, TICK_MS);
    },
    pauseMusic() {
      musicOn = false;
      clearInterval(musicTimer);
      setCraneLoop(false);
    },
    setCraneLoop,
    /** Apply the settings.sound value live. */
    refresh() {
      if (!ctx) return;
      master.gain.value = getEnabled() ? MASTER_GAIN : 0;
      if (!getEnabled()) setCraneLoop(false);
    },
    get context() {
      return ctx;
    },
    get musicOn() {
      return musicOn;
    }
  };
}
