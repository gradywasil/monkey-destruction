/**
 * Job timer and score.
 * @param {{duration?:number, quota:number, onEnd?:(job:object)=>void}} opts
 */
export function createJob({ duration = 900, quota, onEnd } = {}) {
  const job = {
    duration,
    timeLeft: duration,
    quota,
    delivered: 0,
    fines: 0,
    /** @returns {number} delivered value minus fines */
    net: () => Math.max(0, job.delivered - job.fines),
    state: 'running',
    /** @returns {number} 0..3 */
    stars() {
      const q = job.quota;
      const v = job.net();
      if (!(q > 0)) return v > 0 ? 3 : 0;
      if (v >= 1.5 * q) return 3;
      if (v >= 1.25 * q) return 2;
      return v >= q ? 1 : 0;
    },
    tick(dt) {
      if (job.state !== 'running') return;
      job.timeLeft = Math.max(0, job.timeLeft - dt);
      if (job.timeLeft <= 1e-9) {
        job.timeLeft = 0;
        job.state = 'ended';
        onEnd?.(job);
      }
    },
  };
  return job;
}
