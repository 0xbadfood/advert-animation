// The live page's state, from the pipeline's signals: the current step, its live status and progress, the time
// estimate, and the feed of finished pieces. DOM-free; live/view.js draws it. The same object is driven by the real
// event stream (the portal) and by the emulator (live/main.js). Data arrives through the adapter, as on the studio
// page: an event only notifies, the adapter fetches what may be shown.
import { classify, ORDER as STAGE_ORDER, RETRY_RESETS, HONEST } from "../story/stages.js";
import { StatusTracker } from "../story/narration.js";
import { STEPS, STEP_OF, DONE } from "./steps.js";
import { Estimator, typical } from "./estimate.js";

// the studio's status lines are keyed by its eight cards; the live page shows them on its six steps
const CARD_STEP = { research: "know", truths: "ideas", concepts: "ideas", judge: "pick", pick: "pick", direction: "plan", audio: "make", visuals: "make", render: "cut" };

export class LiveModel {
  constructor({ adapter, profile = "local", onChange = () => {} } = {}) {
    this.adapter = adapter; this.onChange = onChange;
    this.est = new Estimator(profile); this.typical = typical(profile);
    this.tracker = new StatusTracker();
    this.reset();
  }

  reset() {
    this.t = 0; this.stage = null; this.stageStart = 0; this.step = null; this.stepStart = 0;
    this.status = {}; this.frac = null; this.items = new Map(); this.seq = 0;
    this.failed = false; this.retrying = false; this.audioN = 0; this.expect = { scenes: 0 };
    this.est.reset(); this.tracker.reset(); this.eta = this.est.view();
    this.catchup = false; this.epoch = (this.epoch || 0) + 1;
  }

  setProfile(p) { this.est.setProfile(p); this.typical = typical(p); }

  // an item in the feed: created once, updated in place; the newest first
  item(id, kind, step, patch) {
    let it = this.items.get(id);
    if (!it) { it = { id, kind, step, at: this.t, seq: this.seq++, data: {}, rev: 0, fresh: !this.catchup }; this.items.set(id, it); }
    if (typeof patch === "function") patch(it.data); else Object.assign(it.data, patch);
    it.rev++;
    return it;
  }

  // one pipeline event at time t (catchup: replaying a log on reload or seek; the view skips the entrances)
  feed(job, e, t = this.t) {
    this.t = Math.max(this.t, t);
    const c = classify(job, e) || {}, d = e.data || {}, k = e.kind, ref = e.ref || "";
    if (c.retry) this.retry(c.retry);
    if (c.fail) { this.failed = true; this.status[this.step ? this.step.key : "know"] = "This step hit a problem, so the run has stopped here."; }
    if (c.retry || c.enter) this.failed = false;
    if (c.enter) this.enter(c.enter);
    else if (c.tick && this.stage && !/failed$/.test(k) && STAGE_ORDER[c.tick] > STAGE_ORDER[this.stage]) this.enter(c.tick);   // a missed enter; a failure is never progress
    const s = this.tracker.feed(e);
    if (s && CARD_STEP[s.card]) this.status[CARD_STEP[s.card]] = s.text;
    this.progress(k, d);
    const epoch = this.epoch;
    if (this.adapter) this.adapter.resolve(job, e, (data) => { if (epoch === this.epoch) { this.land(k, e, data || {}); this.onChange(this); } });
    this.tick(this.t);
  }

  enter(stage) {
    if (this.stage && STAGE_ORDER[stage] <= STAGE_ORDER[this.stage] && !this.retrying) return;
    this.retrying = false;
    this.stage = stage; this.stageStart = this.t;
    const step = STEP_OF[stage];
    if (step && step !== this.step) { this.step = step; this.stepStart = this.t; }
    this.frac = stage === "done" ? 1 : null;
    if (stage === "done") this.item("film", "film", DONE, {});
  }

  retry(to) {
    // a retried step replays its stages: drop what that attempt had shown, keep what came before it
    const keepUpTo = STEP_OF[to] ? STEP_OF[to].n : 1;
    for (const [id, it] of this.items) if (it.step.n > keepUpTo) this.items.delete(id);
    this.audioN = 0; this.expect = { scenes: 0 };
    this.retrying = true; this.stage = null;
    this.enter(to === "pick" ? "pick" : to);
    if (this.step) this.status[this.step.key] = "trying that again…";
  }

  // within-stage progress, when the pipeline reports one (0..1)
  progress(k, d) {
    if (k === "truths.progress") this.frac = d.p;
    if (k === "judge.pair" && d.total) this.frac = d.done / d.total;
    if (k === "direction.scene") this.expect.scenes = Math.max(this.expect.scenes, (d.i || 0) + 1);
    if (k === "film.stage" && d.stage === "direction" && d.state === "done" && d.scenes) this.expect.scenes = d.scenes.length;
    if (k === "audio.line" && this.expect.scenes) { this.audioN = (this.audioN || 0) + 1; this.frac = Math.min(1, this.audioN / this.expect.scenes); }
    // pictures: no fraction; the moving clips follow the stills and their count is not known ahead, so a picture count
    // would claim the stage nearly done too early. The estimate runs on the stage's prior.
    if (k === "render.progress") this.frac = d.p;
  }

  // the data behind an event lands: the feed's pieces
  land(k, e, x) {
    const d = e.data || {}, ref = e.ref || "", [know, ideas, pick, plan, make] = STEPS;
    if (k === "asset.landed" && ref.startsWith("assets/") && x.image) this.item("site", "site", know, (o) => { o[x.which || "desktop"] = x.image; });
    if (k === "research.stage" && x.palette) this.item("brand", "brand", know, { palette: x.palette, logo: x.logo || null });
    if (k === "research.market" && x.market) this.item("facts", "facts", know, { market: x.market });
    if (k === "view.facts" && x.cards) this.item("facts", "facts", know, { cards: x.cards });
    if (k === "truths.done") this.item("angles", "angles", ideas, { n: d.n || 0 });
    if (k === "concept.done" && (d.hook || x.hook)) this.item("lines", "lines", ideas, (o) => { (o.hooks ||= []).push(d.hook || x.hook); });
    if (k === "view.ideas" && x.hooks) this.item("lines", "lines", ideas, (o) => { if (!o.hooks || o.hooks.length < x.hooks.length) o.hooks = x.hooks.slice(); });
    if (k === "judge.pair") this.item("weigh", "weigh", pick, { done: d.done, total: d.total });
    if ((k === "pick" || k === "view.pick") && (x.name || x.hook)) this.item("pick", "pick", pick, (o) => { if (x.name) o.name = x.name; if (x.hook) o.hook = x.hook; o.honest = HONEST.pick; });
    if (k === "direction.scene") this.item("scenes", "scenes", plan, (o) => { (o.scenes ||= [])[d.i || 0] = d.seconds || 0; });
    if (k === "film.stage" && d.stage === "direction" && d.state === "done" && x.scenes) this.item("scenes", "scenes", plan, { scenes: x.scenes.map((s) => s.seconds || 0), done: true });
    if (k === "audio.line") this.item("voice", "voice", make, (o) => { (o.lines ||= [])[d.scene || 0] = { seconds: d.seconds || 0, samples: x.samples || null }; });
    if (k === "film.stage" && d.stage === "audio" && d.state === "done") this.item("voice", "voice", make, { seconds: x.seconds || d.seconds || 0, done: true, samples: x.samples || null });
    if (k === "asset.landed" && ref.startsWith("visuals/") && x.image && (x.kind === "still" || x.kind === "clip")) {
      this.item("pictures", "pictures", make, (o) => {
        o.list ||= [];
        const i = x.kind === "still" ? x.index : x.scene, have = o.list.find((p) => p.i === i);
        if (have) { if (x.kind === "clip") have.moving = true; } else o.list.push({ i, image: x.image, moving: x.kind === "clip" });
        o.list.sort((a, b) => a.i - b.i);
      });
    }
    if (k === "film.done" && x.video) this.item("film", "film", DONE, { video: x.video, poster: x.poster, name: x.name, product: x.product, download: x.download });
  }

  // the clock: the estimate and the time-based step progress
  tick(t) {
    this.t = Math.max(this.t, t);
    if (this.stage) this.eta = this.est.update(this.t, this.stage, this.stageStart, this.frac, this.catchup);
    this.onChange(this);
  }

  // how far through the current step, 0..1: its finished stages in full, the running one by its own progress or by
  // time against its prior (held under 0.92 so the bar never claims done before the pipeline does)
  get stepProgress() {
    if (!this.step || !this.step.stages) return this.stage === "done" ? 1 : 0;
    const P = this.est.P, st = this.step.stages.filter((s) => P[s] || s === this.stage);
    const w = (s) => (P[s] ? P[s].mid : 1), total = st.reduce((a, s) => a + w(s), 0) || 1;
    let got = 0;
    for (const s of st) {
      if (STAGE_ORDER[s] < STAGE_ORDER[this.stage]) got += w(s);
      else if (s === this.stage) got += w(s) * Math.min(0.92, this.frac ?? (this.t - this.stageStart) / w(s));
    }
    return Math.min(0.97, got / total);
  }

  get stepIndex() { return this.step ? this.step.n : 0; }
  statusOf(step) { return step ? this.status[step.key] || "" : ""; }
  get pieces() { return [...this.items.values()].sort((a, b) => b.seq - a.seq); }
}
