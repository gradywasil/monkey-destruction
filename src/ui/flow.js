const TABLE = {
  title: { play: 'map' },
  map: { select: 'briefing', back: 'title' },
  briefing: { start: 'playing', back: 'map' },
  playing: { pause: 'paused', cleared: 'results' },
  paused: { resume: 'playing', restart: 'playing', quit: 'title' },
  results: { continue: 'map', retry: 'playing' }
};

/**
 * Pure game-flow state machine.
 * @param {string} [initial]
 * @returns {{state:string, dispatch:(event:string)=>boolean, onChange:(fn:(next:string,prev:string,event:string)=>void)=>()=>void}}
 */
export function createFlow(initial = 'title') {
  let state = initial;
  const subs = new Set();
  return {
    get state() {
      return state;
    },
    dispatch(event) {
      const next = TABLE[state]?.[event];
      if (!next) return false;
      const prev = state;
      state = next;
      subs.forEach((fn) => fn(next, prev, event));
      return true;
    },
    onChange(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
}
