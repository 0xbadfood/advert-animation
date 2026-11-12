import { rng } from "../story/runner.js";

// A scenario becomes the event stream the real chain would write (~/advert/advert/progress.py kinds, data and refs),
// across the three jobs the live page follows: the product, the batch, the film. Times are story seconds from 0.
//
// scenario.stages: { research, truths, concepts, judge, direction, audio, visuals, render } each {duration, ...counts,
// pattern}; scenario.start: "digest" | "batch"; scenario.newEvents: play the events proposed in DESIGN.md section 2;
// scenario.fail: {stage, at (0..1), retry} optional; scenario.timeline: an explicit event list instead (imports).

export const PATTERNS = ["spread", "burst", "end", "front"];

// times for n ticks inside [t0, t0 + dur] by pattern (seeded jitter)
function ticks(n, t0, dur, pattern, r) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0.5 : i / (n - 1), j = (r() - 0.5) * 0.04;
    let f;
    if (pattern === "burst") f = 0.62 + 0.33 * u + j * 0.5;
    else if (pattern === "end") f = 0.96 + 0.035 * u;
    else if (pattern === "front") f = 0.04 + 0.3 * u + j * 0.5;
    else f = 0.08 + 0.86 * u + j;
    out.push(t0 + Math.max(0.01, Math.min(0.995, f)) * dur);
  }
  return out.sort((a, b) => a - b);
}

export function synthesize(sc, D) {
  if (sc.timeline) return sc.timeline.map((e) => ({ ...e })).sort((a, b) => a.t - b.t);
  const r = rng((sc.seed || 1) * 104729);
  const S = sc.stages, ev = [], P = "products/demo", B = "products/demo/ideas/b1", F = "films/f1";
  const push = (t, job, kind, data = {}, ref = "") => ev.push({ t: +t.toFixed(3), job, kind, data, ref });
  const ne = sc.newEvents !== false;
  let t = 0;

  push(0, P, "chain.start", { start: sc.start || "digest" });
  if ((sc.start || "digest") === "digest") {
    const d = S.research.duration;
    push(0, P, "chain.step", { step: "research", state: "running" });
    push(0, P, "research.stage", { stage: "ingest", state: "running" });
    const shots = D.shots ?? S.research.screenshots ?? 2;
    for (let i = 0; i < shots; i++) push(d * (0.12 + i * 0.04), P, "asset.landed", { asset: "screenshot", name: i ? "mobile" : "desktop" }, i ? "assets/mobile.png" : "assets/desktop.png");
    push(d * 0.18, P, "research.stage", { stage: "ingest", state: "done" });
    push(d * 0.18, P, "research.stage", { stage: "brief", state: "running" });
    push(d * 0.3, P, "research.stage", { stage: "brief", state: "done" });
    push(d * 0.3, P, "research.stage", { stage: "digest", state: "running" });
    push(d * 0.95, P, "research.market", { market: D.market });
    push(d * 0.96, P, "view.facts", {}, "story/facts.json");
    push(d, P, "research.stage", { stage: "digest", state: "done" });
    push(d, P, "chain.step", { step: "research", state: "done" });
    t = d;
  }

  const runBatch = (t0, failFrac) => {
    let t = t0;
    push(t, P, "chain.step", { step: "batch", state: "running", batch: "b1" });
    push(t, B, "batch.start", { source: "chain" });
    const td = S.truths.duration;
    if (ne) for (let i = 1; i <= 5; i++) push(t + td * (i / 6), B, "truths.progress", { p: +(i / 6).toFixed(2) });
    t += td; push(t, B, "truths.done", { n: D.truthsN ?? S.truths.n ?? 9 });
    if (failFrac !== null && failFrac !== undefined) { push(t + 2, B, "batch.failed", { error: "emulated" }); return { t: t + 2, failed: true }; }
    const hooks = D.hooks(S.concepts.n || 8), n = hooks.length;
    const rc = D.ticks && D.ticks.concepts && D.ticks.concepts.length === n ? D.ticks.concepts : null;   // where they fell in the real run
    (rc ? rc.map((f) => t + Math.min(0.995, f) * S.concepts.duration) : ticks(n, t, S.concepts.duration, S.concepts.pattern || "burst", r)).forEach((x, k) => push(x, B, "concept.done", { k, hook: hooks[k] }));
    t += S.concepts.duration; push(t, B, "concepts.done", { n });
    const pairs = D.pairs ?? S.judge.pairs ?? 56;
    ticks(pairs, t, S.judge.duration, "spread", r).forEach((x, i) => push(x, B, "judge.pair", { done: i + 1, total: pairs }));
    t += S.judge.duration;
    push(t, B, "view.ideas", { hooks, n }, "story/ideas.json");
    push(t, B, "batch.done", { n });
    push(t, B, "pick", { film: "f1", hook: hooks[(D.pickIndex ?? sc.artifacts?.pickIndex ?? 0) % hooks.length] });
    push(t, P, "chain.step", { step: "pick", state: "done" });
    return { t, hooks };
  };

  const runFilm = (t0, hook, failStage, failAt) => {
    let t = t0;
    push(t, P, "chain.step", { step: "film", state: "running", film: "f1" });
    push(t, F, "view.pick", { hook, name: D.name }, "story/pick.json");
    const secs = D.scenes(S.direction.scenes || 7), scenesN = secs.length;
    const stage = (name, dur, inner) => {
      push(t, F, "film.stage", { stage: name, state: "running" });
      if (failStage === name) { push(t + dur * failAt, F, "film.failed", { stage: name, error: "emulated" }); t += dur * failAt; return false; }
      inner(t, dur);
      t += dur; return true;
    };
    if (!stage("direction", S.direction.duration, (t0, d) => {
      if (ne) ticks(scenesN, t0 + d * 0.55, d * 0.42, "spread", r).forEach((x, i) => push(x, F, "direction.scene", { i, seconds: secs[i] }));
    })) return { t, failed: true };
    push(t, F, "film.stage", { stage: "direction", state: "done", scenes: secs.map((s) => ({ seconds: s })) }, "plan.json");
    if (!stage("audio", S.audio.duration, (t0, d) => {
      if (ne) ticks(scenesN, t0, d, "spread", r).forEach((x, i) => push(x, F, "audio.line", { scene: i, seconds: secs[i] }));
    })) return { t, failed: true };
    push(t, F, "film.stage", { stage: "audio", state: "done", seconds: secs.reduce((a, b) => a + b, 0) }, "audio/audio.json");
    const stills = D.stillIndices ? D.stillIndices.length : D.uploads.stills && D.uploads.stills.length ? D.uploads.stills.length : S.visuals.stills ?? 8;
    const clips = D.clipScenes ? D.clipScenes.length : S.visuals.clips ?? 0;
    if (!stage("visuals", S.visuals.duration, (t0, d) => {
      const rv = D.ticks && D.ticks.visuals && D.ticks.visuals.length ? D.ticks.visuals : null;
      if (rv) {                                                  // a real run: its own pictures, in the order and spacing they landed
        for (const x of rv) {
          const name = x.ref.split("/").pop().replace(/\.\w+$/, ""), at = t0 + Math.min(0.995, x.f) * d;
          if (name === "poster") push(at, F, "asset.landed", { asset: "poster", name }, x.ref);
          else if (name === "bg") push(at, F, "asset.landed", { asset: "background", name }, x.ref);
          else if (name.startsWith("still_") && !name.includes("_after")) push(at, F, "asset.landed", { asset: "still", name }, x.ref);
          else if (name.startsWith("clip_")) push(at, F, "asset.landed", { asset: "clip", scene: parseInt(name.slice(5), 10) || 0 }, x.ref);
        }
        return;
      }
      const vd = clips ? d * 0.55 : d;
      push(t0 + Math.min(20, vd * 0.15), F, "asset.landed", { asset: "poster", name: "poster" }, "visuals/poster.jpg");
      push(t0 + Math.min(24, vd * 0.18), F, "asset.landed", { asset: "background", name: "bg" }, "visuals/bg.jpg");
      const idx = D.stillIndices || Array.from({ length: stills }, (_, i) => i), pad = (i) => String(i).padStart(2, "0");
      ticks(stills, t0 + vd * 0.2, vd * 0.8, S.visuals.pattern || "spread", r).forEach((x, i) => push(x, F, "asset.landed", { asset: "still", name: "still_" + pad(idx[i]) }, `visuals/still_${pad(idx[i])}.jpg`));
      const cs = D.clipScenes || Array.from({ length: clips }, (_, i) => (i * 2) % Math.max(1, stills));
      if (clips) ticks(clips, t0 + vd, d - vd, "spread", r).forEach((x, i) => push(x, F, "asset.landed", { asset: "clip", scene: cs[i] }, `visuals/clip_${pad(cs[i])}.mp4`));
    })) return { t, failed: true };
    push(t, F, "film.stage", { stage: "visuals", state: "done" }, "visuals/visuals.json");
    if (!stage("render", S.render.duration, (t0, d) => {
      if (ne) {
        for (let i = 1; i <= 9; i++) push(t0 + d * 0.75 * (i / 9), F, "render.progress", { p: +(i / 10).toFixed(2) });
        push(t0 + d * 0.82, F, "film.stage", { stage: "music", state: "done" });
        push(t0 + d * 0.95, F, "film.stage", { stage: "qa", state: "done" });
      }
    })) return { t, failed: true };
    push(t, F, "film.stage", { stage: "render", state: "done" }, "ad.mp4");
    push(t, F, "film.done", { stills }, "ad.mp4");
    return { t };
  };

  const f = sc.fail || null;
  const batchStages = ["truths", "concepts", "judge"];
  let b = runBatch(t, f && batchStages.includes(f.stage) ? f.at : null);
  if (b.failed) {
    if (!f.retry) { push(b.t, P, "chain.failed", { step: "batch" }); return ev.sort((a, c) => a.t - c.t); }
    push(b.t, P, "chain.retry", { step: "batch" });
    b = runBatch(b.t + 1, null);
  }
  let fr = runFilm(b.t, b.hooks[(D.pickIndex ?? sc.artifacts?.pickIndex ?? 0) % b.hooks.length], f && !batchStages.includes(f.stage) ? f.stage : null, f ? f.at : 0);
  if (fr.failed) {
    if (!f.retry) { push(fr.t, P, "chain.failed", { step: "film" }); return ev.sort((a, c) => a.t - c.t); }
    push(fr.t, P, "chain.retry", { step: "film" });
    fr = runFilm(fr.t + 1, b.hooks[(D.pickIndex ?? sc.artifacts?.pickIndex ?? 0) % b.hooks.length], null, 0);
  }
  push(fr.t + 0.5, P, "chain.done", { film: "f1" });
  return ev.sort((a, c) => a.t - c.t);
}
