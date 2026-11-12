import { STAGES } from "../story/stages.js";

// What the emulator measures while a scenario plays (DESIGN.md section 7). Every number is in story seconds.
export const LIMITS = { lag: 8, shortStage: 3, repeats: 6, repeatEvery: 40 };   // repeats: at most 6, or one per 40 s on screen

export class Metrics {
  constructor() { this.reset(); }
  reset() {
    this.stages = Object.fromEntries(STAGES.map((s) => [s, { enterEvent: null, enter: null, exit: null, fast: false, beats: {}, phases: {}, reacts: 0, folded: 0, events: 0, entries: 0 }]));
    this.overflows = []; this.retries = []; this.log = [];
  }
  enterEvent(stage, t) { const s = this.stages[stage]; if (s.enterEvent === null) s.enterEvent = t; }
  event(stage, kind, t) { this.stages[stage].events++; this.log.push({ t, stage, kind }); }
  enter(stage, t, fast) { const s = this.stages[stage]; if (s.enter === null || s.exit !== null) { s.enter = t; s.exit = null; } s.fast = fast; s.entries++; }
  exit(stage, t) { this.stages[stage].exit = t; }
  beat(stage, name, phase, t) { const s = this.stages[stage]; s.beats[name] = (s.beats[name] || 0) + 1; s.phases[phase] = (s.phases[phase] || 0) + 1; }
  react(stage, evs, t) { const s = this.stages[stage]; s.reacts++; s.folded += evs.length - 1; }
  overflow(slot, text, t) { this.overflows.push({ slot, text, t }); }
  retry(stage, t) { this.retries.push({ stage, t }); }
  // a retried step replays its stages: keep the counts, measure lag and dwell on the rerun
  resetStage(stage) { const s = this.stages[stage]; s.enterEvent = null; s.enter = null; s.exit = null; s.fast = false; }

  // the table and the warnings, with the scenario's own stage spans for the timeline
  report(now) {
    const rows = [], warnings = [];
    for (const name of STAGES) {
      const s = this.stages[name];
      if (s.enter === null && s.enterEvent === null) continue;
      const lag = s.enter !== null && s.enterEvent !== null && !s.fast ? s.enter - s.enterEvent : null;
      const dwell = s.enter !== null ? (s.exit ?? now) - s.enter : null;
      const beatCounts = Object.values(s.beats), maxRep = beatCounts.length ? Math.max(...beatCounts) : 0;
      const worst = Object.entries(s.beats).sort((a, b) => b[1] - a[1])[0];
      rows.push({ stage: name, enterEvent: s.enterEvent, enter: s.enter, exit: s.exit, fast: s.fast, lag, dwell, beats: beatCounts.reduce((a, b) => a + b, 0), maxRep, worst: worst ? worst[0] : "", reacts: s.reacts, folded: s.folded, events: s.events, phases: s.phases });
      if (lag !== null && lag > LIMITS.lag) warnings.push({ level: "lag", stage: name, text: `${name}: entered ${lag.toFixed(1)} s after its event (budget ${LIMITS.lag} s)` });
      if (dwell !== null && s.exit !== null && !s.fast && dwell < LIMITS.shortStage && name !== "done") warnings.push({ level: "short", stage: name, text: `${name}: on screen ${dwell.toFixed(1)} s, too short to read` });
      const allowed = Math.max(LIMITS.repeats, Math.ceil((dwell || 0) / LIMITS.repeatEvery));   // a 6-minute wait may repeat more
      if (maxRep > allowed) warnings.push({ level: "repeat", stage: name, text: `${name}: beat "${worst[0]}" played ${maxRep} times in ${Math.round(dwell)} s (allowed ${allowed}); the loop pool is thin for this length` });
      if (s.folded > 0) warnings.push({ level: "info", stage: name, text: `${name}: ${s.folded} reactions folded into group reactions` });
    }
    for (const o of this.overflows) warnings.push({ level: "overflow", stage: "", text: `slot ${o.slot}: text cut ("${String(o.text).slice(0, 40)}…")` });
    return { rows, warnings };
  }
}
