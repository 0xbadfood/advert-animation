// What the story cards say (DESIGN.md section 6): one card per step in plain words, and a live status line computed
// from the pipeline's signals. The trailer rule holds: counts, names the story may show and progress only; never
// truths, plan text, scene text, judge reasons, costs or model names.
import { HONEST } from "./stages.js";

export const STEPS = [
  { key: "research", n: 1, title: "Getting to know your business", body: "We read your website and your pages, pick up your brand colours, and check where you sell and who buys." },
  { key: "truths", n: 2, title: "Finding the angles", body: "Our writer studies what we learned and looks for true things worth saying about your business." },
  { key: "concepts", n: 3, title: "Writing opening lines", body: "Each angle becomes an opening line: the first words of a possible ad." },
  { key: "judge", n: 4, title: "Weighing the ideas", body: "A panel compares the ideas two at a time, both ways round, so no idea wins by going first." },
  { key: "direction", n: 5, title: "Directing the scenes", body: "The chosen idea becomes scenes, and every beat gets its timing." },
  { key: "audio", n: 6, title: "Recording the voice", body: "Every line of the script is voiced, scene by scene." },
  { key: "visuals", n: 7, title: "Painting the pictures", body: "Each scene gets its own picture, made for this film." },
  { key: "render", n: 8, title: "Cutting your film", body: "Pictures, voice and music are cut together, then checked before it reaches you." },
];

// engine stage -> the card it belongs to (pick shares the weighing card; arrive shares research)
const CARD_OF = { arrive: "research", research: "research", truths: "truths", concepts: "concepts", judge: "judge", pick: "pick",
  direction: "direction", audio: "audio", visuals: "visuals", render: "render", done: "done" };

export function cardFor(stage) {
  const key = CARD_OF[stage];
  if (key === "pick") return { key, n: 4, title: "One idea goes forward", body: HONEST.pick, honest: true };
  if (key === "done") return { key, n: 8, title: "Your film is ready", body: "Here it is.", final: true };
  const s = STEPS.find((x) => x.key === key);
  return s ? { ...s, honest: false } : null;
}

// live status per card, from the signals as they arrive
export class StatusTracker {
  constructor() { this.reset(); }
  reset() { this.s = { lines: 0, pairs: null, scenes: 0, voiced: 0, pictures: 0, clips: 0, p: 0, research: "", angles: 0, name: "", facts: 0 }; this.by = {}; }
  feed(e) {
    const d = e.data || {}, s = this.s, k = e.kind;
    const set = (card, text) => { this.by[card] = text; return { card, text }; };
    if (k === "research.stage") return set("research", { ingest: "reading your pages", brief: "understanding your offer", digest: "checking your market" }[d.stage] + (d.state === "done" ? " ✓" : "…"));
    if (k === "asset.landed" && (e.ref || "").startsWith("assets/")) return set("research", "your site, captured");
    if (k === "view.facts") return set("research", "facts gathered");
    if (k === "batch.start") { Object.assign(s, { lines: 0, pairs: null, angles: 0 }); return set("truths", "thinking…"); }
    if (k === "truths.progress") return set("truths", `thinking… ${Math.round((d.p || 0) * 100)}%`);
    if (k === "truths.done") { s.angles = d.n || 0; return set("concepts", `${s.angles} angles found`); }
    if (k === "concept.done") { s.lines++; return set("concepts", `${s.lines} opening line${s.lines === 1 ? "" : "s"} written`); }
    if (k === "judge.pair") { s.pairs = d; return set("judge", `${d.done} of ${d.total} comparisons`); }
    if (k === "pick" || k === "view.pick") { if (d.name) s.name = d.name; return set("pick", s.name ? `“${s.name}”` : "chosen"); }
    if (k === "film.stage" && d.stage === "direction" && d.state === "running") { s.scenes = 0; return set("direction", "planning the scenes…"); }
    if (k === "direction.scene") { s.scenes = Math.max(s.scenes, (d.i || 0) + 1); return set("direction", `${s.scenes} scene${s.scenes === 1 ? "" : "s"} timed`); }
    if (k === "film.stage" && d.stage === "direction" && d.state === "done") { const n = (d.scenes || []).length || s.scenes; s.scenes = n; const sec = (d.scenes || []).reduce((a, x) => a + (x.seconds || 0), 0); return set("direction", `${n} scenes${sec ? ` · ${Math.round(sec)} s` : ""}`); }
    if (k === "film.stage" && d.stage === "audio" && d.state === "running") { s.voiced = 0; return set("audio", "in the booth…"); }
    if (k === "audio.line") { s.voiced++; return set("audio", `${s.voiced}${s.scenes ? ` of ${s.scenes}` : ""} lines recorded`); }
    if (k === "film.stage" && d.stage === "audio" && d.state === "done") return set("audio", `voice ready${d.seconds ? ` · ${Math.round(d.seconds)} s` : ""}`);
    if (k === "film.stage" && d.stage === "visuals" && d.state === "running") { s.pictures = 0; s.clips = 0; return set("visuals", "at the easels…"); }
    if (k === "asset.landed" && (e.ref || "").startsWith("visuals/")) {
      if (d.asset === "still") s.pictures++; else if (d.asset === "clip") s.clips++; else return null;
      return set("visuals", `${s.pictures} picture${s.pictures === 1 ? "" : "s"} painted${s.clips ? ` · ${s.clips} moving` : ""}`);
    }
    if (k === "film.stage" && d.stage === "render" && d.state === "running") return set("render", "cutting…");
    if (k === "render.progress") return set("render", `cutting · ${Math.round((d.p || 0) * 100)}%`);
    if (k === "film.stage" && d.stage === "music" && d.state === "done") return set("render", "music laid in ✓");
    if (k === "film.stage" && d.stage === "qa" && d.state === "done") return set("render", "checked ✓");
    if (k === "film.done") return set("render", "done ✓");
    return null;
  }
  for(card) { return this.by[card] || ""; }
}
