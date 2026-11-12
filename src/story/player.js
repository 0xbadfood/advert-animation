import { Runner, rng, hash } from "./runner.js";
import { Director } from "./director.js";
import { World } from "../world/world.js";
import { buildStations } from "../stations/index.js";
import { Metrics } from "../emulator/metrics.js";

// The story player: the canvas side. It knows nothing about where events come from. A source calls
// feed(job, event, index) when a pipeline signal arrives, and the player pulls the artifact behind it through its
// data adapter (adapter.resolve(job, event, cb)). The emulator is one source; the live page's event stream is another.
//
// Time is the player's own story clock, advanced by advance(t); the source decides how story time maps to wall time
// (1x live, any speed in the emulator).
export const DT = 1 / 30;

export class StoryPlayer {
  constructor(views, { adapter, policy, seed = 1, say, note, cast = null, set = null, props = null, onStage, onSignal }) {
    this.views = views;
    this.runner = new Runner();
    this.metrics = new Metrics();
    this.world = new World(this.runner, views, cast, set, props);
    this.world.onOverflow = (slot, text) => this.metrics.overflow(slot, text, this.runner.t);
    this.stations = buildStations(this.world);
    this.world.jumpTo("research");
    this.caption = ""; this.noteText = "";
    this.director = new Director({
      runner: this.runner, world: this.world, stations: this.stations, adapter,
      policy: policy || { hooks: "line", pick: "name" }, rng: rng(hash(String(seed)) || 1), metrics: this.metrics,
      say: (s) => { this.caption = s; say && say(s); }, note: (s) => { this.noteText = s; note && note(s); }, onStage, onSignal,
    });
    this.director.start();
    this.runner.step(0);
  }

  get t() { return this.runner.t; }

  // a pipeline signal arrived (now, on the story clock)
  feed(job, e, index) { return this.director.feed(job, e, index); }

  // run the story clock forward to t in fixed substeps; beforeStep(t) lets a source deliver signals due by then
  advance(t, beforeStep) {
    let now = this.runner.t;
    while (now < t - 1e-9) {
      const nt = Math.min(t, now + DT);
      if (beforeStep) beforeStep(nt);
      this.runner.step(nt);
      now = nt;
    }
  }

  draw() { this.world.update(this.runner.t); this.world.render(); }
  report() { return this.metrics.report(this.runner.t); }
  dispose() { this.world.dispose(); }
}
