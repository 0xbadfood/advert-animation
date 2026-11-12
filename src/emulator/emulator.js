import { StoryPlayer } from "../story/player.js";
import { classify, STAGES } from "../story/stages.js";
import { makeDummy, dummyAdapter } from "./dummy.js";
import { synthesize } from "./synth.js";
import { realSource, realAdapter } from "./real.js";

// The emulator is a *source*: it turns the configured stage lengths and artifacts into the pipeline's signals and
// sends each one to the player when its time comes (speed x wall time), serving the artifacts through the data
// adapter. The player (the canvas) is the same one the live page will drive from the real event stream.
// Seeking is a convenience for tuning: a fresh player fast-forwarded to the time.
export class Emulator {
  constructor(views, { onSay, onNote, onStage, onSignal, onReset } = {}) {
    this.views = views; this.onSay = onSay || (() => {}); this.onNote = onNote || (() => {});
    this.onStage = onStage || (() => {}); this.onSignal = onSignal || (() => {}); this.onReset = onReset || (() => {});
    this.seeking = false;
    this.speed = 1; this.playing = false; this.uploads = {};
  }

  // run: a finished film loaded by real.js (its artifacts); without one, the generated dummies
  load(scenario, uploads = this.uploads, run = null) {
    this.scenario = scenario; this.uploads = uploads; this.run = run;
    this.D = run ? realSource(run) : makeDummy(scenario, uploads);
    this.adapter = run ? realAdapter(run) : dummyAdapter(scenario, this.D);
    this.events = synthesize(scenario, this.D);
    this.end = (this.events.length ? this.events[this.events.length - 1].t : 0) + 12;
    this.spans = pipelineSpans(this.events, this.end);
    this.reset();
  }

  reset() {
    if (this.player) this.player.dispose();
    this.player = new StoryPlayer(this.views, {
      adapter: this.adapter, policy: this.scenario.policy, seed: JSON.stringify(this.scenario.stages) + (this.scenario.seed || 1),
      say: this.onSay, note: this.onNote, cast: this.cast || null, set: this.set || null,
      onStage: (stage, fast) => this.onStage(stage, fast || this.seeking), onSignal: (stage, e) => this.onSignal(stage, e),
    });
    this.onReset();
    this.next = 0;
  }

  get t() { return this.player.t; }
  get metrics() { return this.player.metrics; }

  // send every signal due by story time t
  send(t) {
    while (this.next < this.events.length && this.events[this.next].t <= t) {
      const e = this.events[this.next];
      this.player.feed(e.job, e, this.next);
      this.next++;
    }
  }

  advance(t) { this.player.advance(t, (nt) => this.send(nt)); }

  seek(t) {
    t = Math.max(0, Math.min(this.end, t));
    if (t < this.player.t) this.reset();
    this.seeking = true;
    this.advance(t);
    this.seeking = false;
    this.onSay(this.player.caption); this.onNote(this.player.noteText);
    this.player.draw();
  }

  tick(realDt) {
    if (this.playing) {
      this.advance(Math.min(this.end, this.player.t + realDt * this.speed));
      if (this.player.t >= this.end) this.playing = false;
    }
    this.player.draw();
  }

  report() { return this.player.report(); }
}

// the pipeline's own stage spans, from the enter signals (the timeline's upper lane)
export function pipelineSpans(events, end) {
  const starts = [];
  events.forEach((e) => { const c = classify(e.job, e); if (c && c.enter) starts.push({ stage: c.enter, t: e.t }); });
  return starts.map((s, i) => ({ stage: s.stage, t0: s.t, t1: i + 1 < starts.length ? starts[i + 1].t : end })).filter((s) => STAGES.includes(s.stage));
}
