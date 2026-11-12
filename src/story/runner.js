// Coroutines on a virtual clock. Every animation in the story is a generator stepped by this runner, so the whole
// story is a pure function of (scenario, seed, time): scrubbing is a reset plus a fast simulation, and a headless run
// gives the same numbers every time.
//
// A task yields:
//   FRAME            resume on the next step (tweens use this)
//   number s         wait s seconds of story time (scaled by the task's duration factor k)
//   {until: t}       resume at absolute story time t
//   task             resume when that task has finished
//   [task, ...]      resume when all have finished
// Waits chain on *logical* time (when the task was due), not on when the frame happened to land, so timing does not
// depend on the frame rate.

export const FRAME = Symbol("frame");

export class Runner {
  constructor() { this.t = 0; this.tasks = []; this.cur = null; }

  spawn(gen, opts = {}) {
    const parent = this.cur;
    const task = {
      gen, done: false, wake: this.cur ? this.cur.logical : this.t, logical: this.cur ? this.cur.logical : this.t,
      wait: null, k: opts.k ?? (parent ? parent.k : 1), name: opts.name || "", cancelled: false, end: null, parent,
    };
    this.tasks.push(task);
    return task;
  }

  cancel(task) { if (task && !task.done) { task.cancelled = true; task.done = true; task.end = this.t; try { task.gen.return(); } catch (e) { /* ignore */ } } }

  // speed up a task and everything it spawned (the director hurries a beat when the next stage is due)
  rescale(root, k) {
    for (const t of this.tasks) { let p = t; while (p && p !== root) p = p.parent; if (p === root) t.k = Math.min(t.k, k); }
  }

  now() { return this.cur ? this.cur.logical : this.t; }
  k() { return this.cur ? this.cur.k : 1; }

  step(t) {
    this.t = t;
    // tasks spawned during this step also get a chance to run in it
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      let guard = 0;
      while (!task.done && guard++ < 1000) {
        if (task.wait) {
          const w = task.wait;
          const ready = Array.isArray(w) ? w.every((x) => x.done) : w.done;
          if (!ready) break;
          const end = Array.isArray(w) ? Math.max(task.logical, ...w.map((x) => x.end ?? t)) : Math.max(task.logical, w.end ?? t);
          task.wait = null; task.logical = Math.min(end, t);
        } else if (task.wake > t) break;
        else if (task.frame) { task.frame = false; task.logical = t; }
        else task.logical = task.wake;

        this.cur = task;
        let r;
        try { r = task.gen.next(); } catch (err) { console.error("story task error", task.name, err); r = { done: true }; }
        this.cur = null;
        if (r.done) { task.done = true; task.end = task.logical; break; }
        const v = r.value;
        if (v === FRAME) { task.frame = true; task.wake = t + 1e-9; break; }
        if (typeof v === "number") task.wake = task.logical + Math.max(0, v) * task.k;
        else if (v && typeof v.until === "number") task.wake = v.until;
        else if (v && (Array.isArray(v) || typeof v.done === "boolean")) { task.wait = v; }
        else task.wake = task.logical;
      }
    }
    if (this.tasks.some((x) => x.done)) this.tasks = this.tasks.filter((x) => !x.done);
  }
}

// ---------------------------------------------------------------- the verbs every station uses
export const ease = {
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  back: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  linear: (t) => t,
};

export function makeVerbs(runner) {
  const V = {
    // tween(dur, fn, e): fn(eased 0..1) every frame for dur seconds (scaled by k)
    *tween(dur, fn, e = ease.inOut) {
      const d = Math.max(0, dur * runner.k());
      const start = runner.now(), end = start + d;
      if (d <= 0) { fn(1); return; }
      while (runner.t < end) { fn(e(Math.min(1, Math.max(0, (runner.t - start) / d)))); yield FRAME; }
      fn(1);
      yield { until: end };
    },
    *wait(s) { yield s; },
    spawn: (gen, opts) => runner.spawn(gen, opts),
    // run several generators at once and wait for all
    *all(...gens) { const ts = gens.filter(Boolean).map((g) => runner.spawn(g)); if (ts.length) yield ts; },
    lerp: (a, b, t) => a + (b - a) * t,
    now: () => runner.now(),
  };
  return V;
}

// Seeded random, so variant choice and jitter replay identically.
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.range = (a, b) => a + (b - a) * r();
  return r;
}

export function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
