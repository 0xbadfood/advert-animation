// The time estimate. Each stage has a typical length (mid) and a long-but-normal one (hi), measured from past runs
// (tools/priors.py -> priors.json). Remaining time = what is left of the current stage + the later stages' lengths.
// The current stage's remainder comes from its prior, refined by its own progress when the pipeline reports one
// (comparisons done, pictures landed, render percent): elapsed x (1 - f) / f, weighted in as f grows.
//
// What the user sees must never jump around: the shown number counts down with the clock, follows a lower target at
// once (a pleasant surprise) and rises only slowly (at most RISE seconds per second) when the run slips. A range is
// shown when the spread is a minute or more. Times are seconds on whatever clock the caller uses.
import PRIORS from "./priors.json";

export const ORDER = ["research", "truths", "concepts", "judge", "direction", "audio", "visuals", "render"];
const RISE = 0.25;

export class Estimator {
  constructor(profile = "local") { this.setProfile(profile); this.reset(); }
  setProfile(p) { this.P = PRIORS[p] || PRIORS.local; this.profile = p; }
  reset() { this.shown = null; this.shownHi = null; this.lastT = null; this.slow = false; }

  // the raw estimate: { mid, hi } seconds left, given the current engine stage, when it started and its progress f
  target(stage, elapsed, f = null) {
    if (stage === "done") return { mid: 0, hi: 0 };
    const i = ORDER.indexOf(stage === "arrive" ? "research" : stage === "pick" ? "direction" : stage);
    if (i < 0) return null;
    const cur = stage === "pick" ? null : ORDER[i];
    const later = ORDER.slice(i + (cur ? 1 : 0));
    const sum = (k) => later.reduce((a, s) => a + (this.P[s] ? this.P[s][k] : 0), 0);
    let mid = 0, hi = 0;
    this.slow = false;
    if (cur && this.P[cur]) {
      const p = this.P[cur];
      const tail = Math.max(5, p.mid * 0.1);                 // a stage running past its prior still has a little left
      mid = Math.max(p.mid - elapsed, tail);
      hi = Math.max(p.hi - elapsed, tail * 1.5);
      if (f !== null && f > 0.05 && f < 1 && elapsed > 3) {   // its own progress, trusted more as it grows
        const rate = (elapsed * (1 - f)) / f, w = Math.min(0.85, f);
        mid = mid * (1 - w) + rate * w; hi = Math.max(mid * 1.15, hi * (1 - w) + rate * 1.3 * w);
      }
      this.slow = elapsed > p.hi;
    }
    return { mid: mid + sum("mid"), hi: Math.max(mid, hi) + sum("hi") };
  }

  // advance the shown estimate to time t; snap = true on a catch-up (a reload, a seek): no smoothing
  update(t, stage, stageStart, f = null, snap = false) {
    const g = this.target(stage, t - stageStart, f);
    if (!g) return this.view();
    if (this.shown === null || snap || this.lastT === null) { this.shown = g.mid; this.shownHi = g.hi; }
    else {
      const dt = Math.max(0, t - this.lastT);
      const step = (shown, want) => {
        const down = shown - dt;                              // the clock runs
        if (want <= down) return Math.max(want, down - dt * 2);  // follow a lower target, quickly but not in one jump
        return Math.min(want, down + dt * (1 + RISE));        // rise only slowly
      };
      this.shown = Math.max(0, step(this.shown, g.mid));
      this.shownHi = Math.max(this.shown, step(this.shownHi, g.hi));
    }
    this.lastT = t;
    return this.view(stage);
  }

  view(stage) {
    if (stage === "done") return { text: "Ready", mid: 0, hi: 0 };
    if (this.shown === null) return { text: "", mid: null, hi: null };
    const m = this.shown, h = this.shownHi;
    let text;
    if (m < 25) text = "Almost there";
    else if (m < 90) text = "About a minute left";
    else {
      const a = Math.round(m / 60), b = Math.round(h / 60);
      text = b - a >= 1 ? `${a}–${b} min left` : `About ${a} min left`;
    }
    return { text, mid: m, hi: h, slow: this.slow };
  }
}

// a whole run's expected length up front, for the page before anything happens ("usually about 9 minutes")
export function typical(profile = "local") {
  const P = PRIORS[profile] || PRIORS.local;
  return ORDER.reduce((a, s) => a + (P[s] ? P[s].mid : 0), 0);
}
