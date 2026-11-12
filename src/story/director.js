import { STAGES, ORDER, HONEST, classify, STATION_OF, CAPTION } from "./stages.js";

// The story runtime (DESIGN.md section 6). It keeps the live engine's rules and adds what the measured timings asked for:
//  - data lands at once: every classified event is applied to its station's slots the moment it arrives;
//  - figures react on the beat: reactions queue per stage and play at the next beat boundary, folded when several wait;
//  - stages hold a minimum dwell (the pick reveal) before the next stage may interrupt;
//  - skipped stages play their enter and exit compressed (k = FAST_K) with nothing queued;
//  - idle beats are chosen by elapsed time in the stage (early / mid / late), seeded, never the same twice running.

export const FAST_K = 0.12;
export const MIN_DWELL = { pick: 4.5 };
export const MUST_SHOW_WITHIN = 8;          // seconds: an older must-see stage (a late page load) is compressed like any other
export const PHASE_AT = { mid: 20, late: 60 };
export const HURRY_K = 0.35;                 // a beat still playing when the next stage is due finishes at about 3x speed

export class Director {
  constructor({ runner, world, stations, adapter, policy, rng, metrics, say, note, onStage, onSignal }) {
    Object.assign(this, { runner, world, stations, adapter, policy, rng, metrics });
    this.onStage = onStage || (() => {}); this.onSignal = onSignal || (() => {});   // the story card listens here
    this.say = say || (() => {}); this.note = note || (() => {});
    this.cur = -1; this.want = -1; this.retryTo = null; this.failed = false; this.halted = false;
    this.entered = {}; this.enterEventT = {}; this.enteredAt = 0; this.lastBeat = null; this.bags = {};
    this.reactions = Object.fromEntries(STAGES.map((s) => [s, []]));
    this.seen = new Set();
    this.data = { facts: [], hooks: [], pick: null, scenes: [], stills: [], lines: [] };
    const d = this;
    this.ctx = {
      V: world.V, world, data: this.data, policy, rng, director: this,
      slot: (n) => world.slots[n],
      hookText: (h, i) => (policy.hooks === "line" && h ? h : `Idea ${i + 1}`),
      pickCard: (p) => (policy.pick === "name" && p && p.name
        ? { title: "Selected", text: p.name, sub: policy.hooks === "line" ? p.hook : "" }
        : { title: "Selected", text: "One of the top ideas" }),
      get stage() { return STAGES[d.cur]; },
    };
  }

  // ------------------------------------------------------------ events in (called by a source, outside the clock)
  feed(job, e, idx) {
    const key = job + "#" + idx;
    if (this.seen.has(key)) return null; this.seen.add(key);
    const c = classify(job, e);
    if (!c) return null;
    const t = this.runner.t;
    const stage = c.enter ?? c.tick;
    if (c.enter !== undefined) {
      if (ORDER[c.enter] > this.want) { this.want = ORDER[c.enter]; if (this.want > this.cur) this.hurry(); }
      this.entered[c.enter] = { job, ...e };
      if (this.enterEventT[c.enter] === undefined) this.enterEventT[c.enter] = t;
      this.metrics.enterEvent(c.enter, t);
    }
    if (stage !== undefined) {
      this.applyData(stage, job, e);
      this.onSignal(stage, e);
      if (c.tick !== undefined && ORDER[c.tick] >= this.cur) this.reactions[c.tick].push({ job, ...e, at: t });
      this.metrics.event(stage, e.kind, t);
    }
    if (c.retry !== undefined) {
      // a retried step: the target drops back now, so the rerun's own events raise it again in order
      this.retryTo = c.retry; this.want = ORDER[c.retry];
      for (const s of STAGES.slice(ORDER[c.retry] + 1)) { this.reactions[s].length = 0; delete this.enterEventT[s]; this.metrics.resetStage(s); }
    }
    if (c.fail) this.failed = true;
    return c.follow || null;
  }

  applyData(stage, job, e) {
    const st = this.stations[STATION_OF[stage]];
    if (!st || !st.apply) return;
    this.adapter.resolve(job, e, (content) => {
      try { st.apply(this.ctx, stage, e, content || {}); } catch (err) { console.error("apply", stage, e.kind, err); }
    });
  }

  start() { this.task = this.runner.spawn(this.main(), { name: "director" }); }

  // the next stage is due: the running beat wraps up quickly rather than playing out (a held stage keeps its pace)
  hurry() {
    if (!this.beatTask || this.beatTask.done) return;
    const name = STAGES[this.cur];
    if (this.runner.t - this.enteredAt < (MIN_DWELL[name] || 0)) return;
    this.runner.rescale(this.beatTask, HURRY_K);
  }

  // ------------------------------------------------------------ the loop (a coroutine on the story clock)
  *sub(gen, k = 1) { if (!gen) return; const t = this.runner.spawn(gen, { k }); yield t; }

  *main() {
    while (true) {
      if (this.halted) { yield 1; continue; }
      if (this.retryTo !== null) {
        const to = this.retryTo; this.retryTo = null;
        yield* this.sub(this.stationOf(this.cur)?.retry?.(this.ctx));
        this.metrics.retry(STAGES[this.cur], this.runner.now());
        this.cur = ORDER[to]; this.want = Math.max(this.want, this.cur);
        this.metrics.enter(STAGES[this.cur], this.runner.now(), true);   // back at the stage before the retried step
        continue;
      }
      if (this.want > this.cur && this.dwellOk()) {
        let target = this.want;
        // a stage that must be seen (a minimum dwell: the pick) is played in full, not compressed, while its signal
        // is fresh; pick and direction share a timestamp, so without this the reveal would be skipped every time
        for (let i = this.cur + 1; i < target; i++) {
          const s = STAGES[i], at = this.enterEventT[s];
          if (MIN_DWELL[s] && at !== undefined && this.runner.now() - at <= MUST_SHOW_WITHIN) { target = i; break; }
        }
        if (this.cur >= 0) yield* this.exitStage(this.cur, false);
        for (let i = this.cur + 1; i < target; i++) { yield* this.enterStage(i, true); yield* this.exitStage(i, true); }
        this.cur = target;
        yield* this.enterStage(this.cur, false);
        continue;
      }
      if (this.failed) {
        this.failed = false; this.halted = true;
        this.say("Something went wrong; we are on it");
        yield* this.sub(this.stationOf(this.cur)?.fail?.(this.ctx));
        continue;
      }
      if (this.cur < 0) { yield 0.25; continue; }
      const name = STAGES[this.cur], sd = this.stageDef(this.cur), q = this.reactions[name];
      if (q.length && sd.react) {
        const evs = q.splice(0);
        this.metrics.react(name, evs, this.runner.now());
        yield* this.sub(sd.react(this.ctx, evs));
        continue;
      }
      q.length = 0;
      yield* this.beat(name, sd);
    }
  }

  dwellOk() {
    const name = STAGES[this.cur];
    return this.cur < 0 || this.runner.now() - this.enteredAt >= (MIN_DWELL[name] || 0);
  }

  stationOf(i) { return i >= 0 ? this.stations[STATION_OF[STAGES[i]]] : null; }
  stageDef(i) { const st = this.stationOf(i); return (st && st.stages && st.stages[STAGES[i]]) || {}; }

  *enterStage(i, fast) {
    const name = STAGES[i], stName = STATION_OF[name], sd = this.stageDef(i), k = fast ? FAST_K : 1;
    const now = this.runner.now();
    this.metrics.enter(name, now, fast);
    this.enteredAt = now;                                   // dwell and loop phases count from the start of the entrance
    this.onStage(name, fast);                               // the story card
    this.say(CAPTION[name]);
    if (name === "judge") this.note(HONEST.more);
    else if (name === "pick") this.note(HONEST.pick);
    else if (!fast) this.note("");
    this.world.silent = fast;
    if (this.world.cameraStation !== stName) yield* this.sub(this.world.moveTo(stName, 1.8), k);
    if (sd.enter) yield* this.sub(sd.enter(this.ctx, this.entered[name] || {}), k);
    this.world.silent = false;
    if (fast) this.reactions[name].length = 0;
    this.lastBeat = null;
  }

  *exitStage(i, fast) {
    if (i < 0) return;
    const sd = this.stageDef(i);
    this.world.silent = fast;
    if (sd.exit) yield* this.sub(sd.exit(this.ctx), fast ? FAST_K : 1);
    this.world.silent = false;
    this.metrics.exit(STAGES[i], this.runner.now());
  }

  *beat(name, sd) {
    const beats = sd.beats || {};
    const el = this.runner.now() - this.enteredAt;
    const phase = el >= PHASE_AT.late ? "late" : el >= PHASE_AT.mid ? "mid" : "early";
    const phases = sd.phases || {};
    let pool = phases[phase] || phases.mid || phases.early || Object.keys(beats);
    pool = pool.filter((b) => beats[b]);
    if (!pool.length) { yield 0.5; return; }
    // a shuffle bag per stage and phase: every beat in the pool plays once before any plays again, never twice running
    const key = name + ":" + phase;
    let bag = this.bags[key];
    if (!bag || !bag.length) {
      bag = pool.slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag.length > 1 && bag[bag.length - 1] === this.lastBeat) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      this.bags[key] = bag;
    }
    const pick = bag.pop();
    this.lastBeat = pick;
    this.metrics.beat(name, pick, phase, this.runner.now());
    const t0 = this.runner.now();
    const task = this.runner.spawn(beats[pick](this.ctx));
    this.beatTask = task;
    if (this.want > this.cur) this.hurry();
    yield task;
    this.beatTask = null;
    if (this.runner.now() - t0 < 0.05) yield 0.5;          // a beat must take time, or the loop would spin
  }
}
