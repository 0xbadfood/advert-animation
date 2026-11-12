// The pipeline-owned stage graph, ported verbatim from ~/advert/advert/web/static/story/engine.js so this runtime
// reads the same event streams as the live story page. Keep in step with that file.

export const STAGES = ["arrive", "research", "truths", "concepts", "judge", "pick", "direction", "audio", "visuals", "render", "done"];
export const ORDER = Object.fromEntries(STAGES.map((s, i) => [s, i]));
export const HONEST = {
  pick: "We chose one of the top ideas; the rest stay in your bin.",
  more: "After you take the film, ten more teams mine 20-25 further openings for this business.",
};
export const RETRY_RESETS = { batch: "research", film: "pick" };

// Returns {enter: stage} | {tick: stage} | {retry: stage} | {fail: true} | null, plus `follow` for streams to join.
// Additions over the live engine are marked NEW: events proposed in DESIGN.md section 2 (the emulator plays them).
export function classify(job, e) {
  const d = e.data || {}, k = e.kind, ref = e.ref || "";
  const out = {};
  if (k === "chain.step") {
    if (d.batch && d.step === "batch") out.follow = job.split("/").slice(0, 2).join("/") + "/ideas/" + d.batch;
    if (d.film) out.follow = "films/" + d.film;
    if (d.step === "research" && d.state === "running") out.enter = "research";
    return out;
  }
  if (k === "chain.start") return { enter: "arrive" };
  if (k === "chain.retry") return { retry: RETRY_RESETS[d.step] || "arrive" };
  if (k === "chain.failed") return { fail: true };
  if (k === "chain.done") return { enter: "done" };
  if (k === "research.stage" || k === "research.market" || k === "view.facts" || k === "research.failed") return { tick: "research" };
  if (k === "asset.landed" && ref.startsWith("assets/")) return { tick: "research" };
  if (k === "batch.start") return { enter: "truths" };
  if (k === "truths.progress") return { tick: "truths" };                                   // NEW
  if (k === "truths.done") return { enter: "concepts" };
  if (k === "concept.done") return { tick: "concepts" };
  if (k === "concepts.done") return { enter: "judge" };
  if (k === "judge.pair" || k === "view.ideas" || k === "batch.done" || k === "batch.failed") return { tick: "judge" };
  if (k === "pick") return { enter: "pick", follow: d.film ? "films/" + d.film : "" };
  if (k === "view.pick") return { tick: "pick" };
  if (k === "direction.scene") return { tick: "direction" };                                // NEW
  if (k === "audio.line") return { tick: "audio" };                                         // NEW
  if (k === "render.progress") return { tick: "render" };                                   // NEW
  if (k === "film.stage") {
    if (d.state === "running" && ORDER[d.stage] !== undefined) return { enter: d.stage };
    return { tick: ORDER[d.stage] !== undefined ? d.stage : "render" };
  }
  if (k === "asset.landed" && ref.startsWith("visuals/")) return { tick: "visuals" };
  if (k === "film.done" || k === "film.failed") return { tick: "render" };
  return null;
}

// Which station (place in the studio) shows each engine stage.
export const STATION_OF = {
  arrive: "research", research: "research",
  truths: "hooks", concepts: "hooks",
  judge: "review", pick: "review",
  direction: "direction", audio: "voice", visuals: "visuals",
  render: "assembly", done: "assembly",
};

// Plain-word captions, one per stage (localisable; never names a model or a cost).
export const CAPTION = {
  arrive: "Getting to know your business",
  research: "Reading your website",
  truths: "Finding the angles",
  concepts: "Writing opening lines",
  judge: "Weighing the ideas",
  pick: "One idea goes forward",
  direction: "Directing the scenes",
  audio: "Recording the voice",
  visuals: "Painting the pictures",
  render: "Cutting your film",
  done: "Your film is ready",
};
