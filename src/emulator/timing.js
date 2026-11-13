// Stage lengths for an emulated run: a base per stage (the film's own recording, else the medians), times a scale
// per stage (the emulator's sliders). Shared by the studio page (main.js) and the live page (live/main.js).
export const SLIDERS = [
  ["research", "Research"], ["truths", "Angles"], ["concepts", "Opening lines"], ["judge", "Weighing"],
  ["direction", "Direction"], ["audio", "Voice"], ["visuals", "Pictures"], ["render", "Final cut"],
];
// medians of the recorded GB10 runs, for stages a film has no recording of; and the cloud targets (DESIGN.md section 2)
export const MEDIAN = { research: 60, truths: 45, concepts: 22, judge: 10, direction: 35, audio: 28, visuals: 150, render: 160 };
export const CLOUD = { visuals: (clips) => (clips ? 100 : 18), render: () => 45 };

// the base lengths for a loaded film (real.js run or a bare bundle), and which of them were recorded
export function baseFor(bundle) {
  const rec = bundle && bundle.recorded ? bundle.recorded.stages : {};
  const base = { ...MEDIAN }, recordedFrom = {};
  for (const [s] of SLIDERS) if (rec[s]) { base[s] = rec[s]; recordedFrom[s] = true; }
  if (bundle && !rec.visuals) base.visuals = bundle.visuals.clips.length ? 150 : 110;
  return { base, recordedFrom };
}

// scales that turn a film's local lengths into the cloud targets
export function cloudScale(base, clips) {
  const scale = Object.fromEntries(SLIDERS.map(([s]) => [s, 1]));
  for (const [s, f] of Object.entries(CLOUD)) scale[s] = Math.min(4, Math.max(0.25, f(clips) / base[s]));
  return scale;
}

export const secondsOf = (base, scale, s) => Math.max(1, Math.round(base[s] * scale[s] * 2) / 2);

// the scenario handed to the emulator: a preset's shape with these lengths
export function scenarioFor(preset, bundle, base, scale) {
  const d = JSON.parse(JSON.stringify(preset));
  d.name = bundle ? bundle.film : "dummy"; d.language = bundle ? bundle.language : d.language;
  d.policy = { hooks: "line", pick: "name" }; d.start = "digest"; d.fail = null; d.newEvents = true;
  for (const [s] of SLIDERS) d.stages[s].duration = secondsOf(base, scale, s);
  return d;
}
