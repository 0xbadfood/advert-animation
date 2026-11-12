import { World } from "./world/world.js";
import { Emulator } from "./emulator/emulator.js";
import { loadFilm } from "./emulator/real.js";
import { tryLoadCast, tryLoadSet, tryLoadProps } from "./world/models.js";
import { StoryCard, STORY_CARD_CSS } from "./ui/storycard.js";
import { cardFor, StatusTracker } from "./story/narration.js";
import { STAGES } from "./story/stages.js";
import { LIMITS } from "./emulator/metrics.js";

// The emulator page: the story canvas on top; below it, pick a finished advert film and set each stage's length.
// Play runs the emulator, which sends that run's signals and its real artifacts to the canvas at the set times.
// URL: ?film=<id>&speed=<n>&at=<s>&play=1 ; ?scenario=<preset> plays generated dummies instead (no film needed);
// &auto=1 simulates to the end and exposes window.__report (tools/smoke.py).

const PRESETS = Object.fromEntries(Object.entries(import.meta.glob("../scenarios/*.json", { eager: true, import: "default" }))
  .map(([p, s]) => [p.split("/").pop().replace(".json", ""), s]));
const qs = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const clone = (o) => JSON.parse(JSON.stringify(o));

const views = ["#wide"].map((id) => ({ ...World.makeView($(id + " canvas")), root: $(id) }));
// the story card explains each step over the canvas, with a live status from the signals (story/narration.js)
document.head.appendChild(Object.assign(document.createElement("style"), { textContent: STORY_CARD_CSS }));
const card = new StoryCard($("#wide")), tracker = new StatusTracker();
const emu = new Emulator(views, {
  onStage: (stage, fast) => { const c = cardFor(stage); if (!c) return; card.show(c, { animate: !fast }); card.status(tracker.for(c.key)); },
  onSignal: (stage, e) => { const r = tracker.feed(e); if (r && r.card === card.key) card.status(r.text); },
  onReset: () => { card.reset(); tracker.reset(); },
});
window.__emu = emu;

// ---------------------------------------------------------------- stage lengths: a base per stage, a slider scales it
const SLIDERS = [
  ["research", "Research"], ["truths", "Angles"], ["concepts", "Opening lines"], ["judge", "Weighing"],
  ["direction", "Direction"], ["audio", "Voice"], ["visuals", "Pictures"], ["render", "Final cut"],
];
// medians of the recorded GB10 runs, for stages a film has no recording of; and the cloud targets (DESIGN.md section 2)
const MEDIAN = { research: 60, truths: 45, concepts: 22, judge: 10, direction: 35, audio: 28, visuals: 150, render: 160 };
const CLOUD = { visuals: (clips) => (clips ? 100 : 18), render: () => 45 };
const COLORS = { arrive: "#c9c0f0", research: "#7cc4ff", truths: "#ffd36e", concepts: "#ffb07c", judge: "#ff9db5", pick: "#2bb673", direction: "#b49cff", audio: "#7ce0d8", visuals: "#7ee0a1", render: "#e7a6ff", done: "#ffc857" };

let run = null;                        // the loaded film (real.js), or null for generated dummies
let base = { ...MEDIAN }, recordedFrom = {};
const scale = Object.fromEntries(SLIDERS.map(([s]) => [s, 1]));
let sc = null;                         // the scenario handed to the emulator (durations from base x scale)

function scenarioFor() {
  const d = clone(PRESETS["local-typical"]);
  d.name = run ? run.bundle.film : "dummy"; d.language = run ? run.bundle.language : d.language;
  d.policy = { hooks: "line", pick: "name" }; d.start = "digest"; d.fail = null; d.newEvents = true;
  for (const [s] of SLIDERS) d.stages[s].duration = Math.max(1, Math.round(base[s] * scale[s] * 2) / 2);
  return d;
}

function buildSliders() {
  const box = $("#sliders"); box.innerHTML = "";
  for (const [s, label] of SLIDERS) {
    const row = document.createElement("div"); row.className = "sl";
    row.innerHTML = `<label><span class="dot" style="background:${COLORS[s]}"></span>${label}</label><input type="range" min="-2" max="2" step="0.05" value="${Math.log2(scale[s])}"><div class="val"></div>`;
    const input = row.querySelector("input"), val = row.querySelector(".val");
    const show = () => {
      const secs = Math.max(1, Math.round(base[s] * scale[s] * 2) / 2);
      val.innerHTML = `<b>${secs} s</b> <span>×${scale[s].toFixed(2)} of ${Math.round(base[s])} s ${recordedFrom[s] ? "real" : "median"}</span>`;
    };
    input.oninput = () => { scale[s] = Math.pow(2, +input.value); show(); };
    input.onchange = () => rebuild();
    show(); box.appendChild(row);
  }
}

function rebuild(at = null) {
  const t = at ?? (emu.player ? emu.t : 0), playing = emu.playing;
  sc = scenarioFor();
  emu.load(sc, {}, run);
  emu.seek(Math.min(t, emu.end));
  emu.playing = playing && at === null;
  writeLog();
}

$("#pReal").onclick = () => { for (const [s] of SLIDERS) scale[s] = 1; buildSliders(); rebuild(); };
$("#pCloud").onclick = () => {
  for (const [s] of SLIDERS) scale[s] = 1;
  const clips = run ? run.bundle.visuals.clips.length : 0;
  for (const [s, f] of Object.entries(CLOUD)) scale[s] = Math.min(4, Math.max(0.25, f(clips) / base[s]));
  buildSliders(); rebuild();
};

// ---------------------------------------------------------------- the film picker
async function films() {
  const r = await fetch("/api/films");
  if (r.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search); return []; }
  return r.json();
}

async function pick(id) {
  emu.playing = false; closeReveal(); revealed = false;
  document.body.classList.add("loading");
  try {
    if (id === "dummy") { run = null; }
    else run = await loadFilm(id, (what) => ($("#loading").textContent = `loading the film: ${what}…`));
  } catch (err) { $("#loading").textContent = "could not load: " + err.message; return; }
  document.body.classList.remove("loading");
  const rec = run && run.bundle.recorded ? run.bundle.recorded.stages : {};
  base = { ...MEDIAN }; recordedFrom = {};
  for (const [s] of SLIDERS) if (rec[s]) { base[s] = rec[s]; recordedFrom[s] = true; }
  if (run && !rec.visuals) base.visuals = run.bundle.visuals.clips.length ? 150 : 110;
  for (const [s] of SLIDERS) scale[s] = 1;
  const b = run && run.bundle;
  $("#filmInfo").innerHTML = b
    ? `<b>${b.product_name}</b> · “${b.pick.name}” · ${b.language}<br>${b.concepts.hooks.length} hooks · ${b.direction.scenes.length} scenes · ${b.visuals.stills.length} stills · ${b.visuals.clips.length} clips · ${b.recorded ? "real timing recorded" : "timing: medians"}`
    : "Generated dummy run: no film data.";
  buildSliders();
  rebuild(0);
  const u = new URL(location.href); u.searchParams.set("film", id); u.searchParams.delete("scenario"); history.replaceState(null, "", u);
}

// ---------------------------------------------------------------- transport
$("#play").onclick = () => { if (emu.t >= emu.end) emu.seek(0); emu.playing = !emu.playing; };
$("#restart").onclick = () => emu.seek(0);
$("#speed").onchange = () => (emu.speed = +$("#speed").value);

// ---------------------------------------------------------------- timeline: pipeline above, story below, signals at the bottom
const tl = $("#timeline");
tl.onclick = (ev) => { const r = tl.getBoundingClientRect(); emu.seek(((ev.clientX - r.left - 70) / (r.width - 80)) * emu.end); };
function drawTimeline() {
  const W = tl.clientWidth, H = tl.clientHeight, dpr = window.devicePixelRatio || 1;
  if (tl.width !== Math.round(W * dpr)) { tl.width = Math.round(W * dpr); tl.height = Math.round(H * dpr); }
  const g = tl.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!emu.events) return;
  const x = (t) => 70 + (t / emu.end) * (W - 80);
  g.font = "700 11px Nunito, sans-serif"; g.fillStyle = "#7d77a3"; g.textBaseline = "middle";
  g.fillText("pipeline", 8, 24); g.fillText("story", 8, 58); g.fillText("signals", 8, 90);
  for (const s of emu.spans) { g.fillStyle = COLORS[s.stage] || "#ddd"; g.fillRect(x(s.t0), 12, Math.max(1, x(s.t1) - x(s.t0) - 1), 24); }
  for (const s of emu.spans) if (x(s.t1) - x(s.t0) > 40) { g.fillStyle = "#26214a"; g.fillText(s.stage, x(s.t0) + 4, 24); }
  const m = emu.metrics.stages;
  for (const st of STAGES) {
    const s = m[st]; if (s.enter === null) continue;
    g.fillStyle = COLORS[st]; g.globalAlpha = s.fast ? 0.4 : 1;
    g.fillRect(x(s.enter), 46, Math.max(2, x(s.exit ?? emu.t) - x(s.enter) - 1), 24); g.globalAlpha = 1;
  }
  g.fillStyle = "#5b3fd1";
  for (const e of emu.events) g.fillRect(x(e.t), 82, 1, e.t <= emu.t ? 16 : 7);
  g.fillStyle = "#c2410c"; g.fillRect(x(emu.t) - 1, 4, 2, H - 8);
  g.fillStyle = "#7d77a3"; g.textAlign = "right"; g.fillText(`${Math.round(emu.end)} s`, W - 8, H - 7); g.textAlign = "left";
}

// ---------------------------------------------------------------- checks and the signal log
function writeChecks() {
  if (!emu.player) return;
  const { rows, warnings } = emu.report();
  const f = (v) => (v === null || v === undefined ? "–" : typeof v === "number" ? v.toFixed(1) : v);
  let h = "<tr><th>stage</th><th>signal at</th><th>shown at</th><th>lag</th><th>on screen</th><th>beats</th><th>most repeated</th><th>reactions</th><th>folded</th></tr>";
  for (const r of rows) {
    h += `<tr><td class="l">${r.stage}${r.fast ? " (compressed)" : ""}</td><td>${f(r.enterEvent)}</td><td>${f(r.enter)}</td>`
      + `<td class="${r.lag > LIMITS.lag ? "bad" : ""}">${f(r.lag)}</td><td class="${r.exit !== null && !r.fast && r.dwell < LIMITS.shortStage && r.stage !== "done" ? "bad" : ""}">${f(r.dwell)}</td>`
      + `<td>${r.beats}</td><td class="l ${r.maxRep > Math.max(LIMITS.repeats, Math.ceil((r.dwell || 0) / LIMITS.repeatEvery)) ? "bad" : ""}">${r.worst ? `${r.worst} ×${r.maxRep}` : "–"}</td><td>${r.reacts}</td><td>${r.folded}</td></tr>`;
  }
  $("#table").innerHTML = h;
  $("#warnings").innerHTML = warnings.map((w) => `<li class="${w.level}">${w.text}</li>`).join("") || "<li class='info'>no warnings so far</li>";
}
function writeLog() {
  $("#log").textContent = emu.events.map((e) => `${e.t.toFixed(1).padStart(7)}  ${e.job.padEnd(26)} ${e.kind.padEnd(16)} ${JSON.stringify(e.data).slice(0, 100)}`).join("\n");
}

// ---------------------------------------------------------------- the reveal: the ad in a modal once the story is done
const REVEAL_AFTER = 4;                // story seconds of celebration before the modal opens
let revealed = false;
const reveal = $("#reveal"), rv = $("#revealVideo");
function openReveal() {
  revealed = true; emu.playing = false;
  const b = run && run.bundle;
  if (!b) { return; }                  // the dummy run has no film to show
  const src = `/files/${b.film}/${b.ad.split("/").map(encodeURIComponent).join("/")}`;
  $("#revealSub").textContent = `${b.product_name} · “${b.pick.name}”`;
  $("#revealDownload").href = src; $("#revealDownload").setAttribute("download", `${b.product}-${b.film}.mp4`);
  if (rv.getAttribute("src") !== src) rv.src = src;
  reveal.classList.add("open");
  rv.currentTime = 0; rv.muted = false;
  rv.play().catch(() => { rv.muted = true; rv.play().catch(() => {}); });   // with sound when the browser allows it
}
function closeReveal() { reveal.classList.remove("open"); rv.pause(); }
$("#revealClose").onclick = closeReveal;
$("#revealReplay").onclick = () => { closeReveal(); revealed = false; emu.seek(0); emu.playing = true; };
reveal.onclick = (e) => { if (e.target === reveal) closeReveal(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && reveal.classList.contains("open")) closeReveal(); });

// ---------------------------------------------------------------- loop
let last = performance.now(), lastChecks = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (emu.player) {
    emu.tick(dt);
    const done = emu.metrics.stages.done.enter;
    if (done === null || emu.t < done + REVEAL_AFTER) revealed = false;             // a seek back before the end re-arms it
    else if (!revealed && !qs.get("auto")) openReveal();
    $("#clock").textContent = `${emu.t.toFixed(1)} / ${Math.round(emu.end)} s`;
    $("#play").textContent = emu.playing ? "Pause" : emu.t >= emu.end ? "Play again" : "Play";
    drawTimeline();
    if (now - lastChecks > 300) { writeChecks(); lastChecks = now; }
  }
  requestAnimationFrame(frame);
}

async function start() {
  try { await Promise.race([Promise.all([document.fonts.load("800 20px Nunito"), document.fonts.load("700 20px 'Noto Sans Devanagari'", "हिंदी")]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* fonts are a nicety */ }
  emu.speed = +(qs.get("speed") || $("#speed").value); $("#speed").value = String(emu.speed);
  if (!qs.get("greybox")) [emu.cast, emu.set, emu.props] = await Promise.all([tryLoadCast(), tryLoadSet(), tryLoadProps()]);   // Blender cast, set, props; ?greybox=1 for none
  requestAnimationFrame(frame);

  // a dummy preset (tools/smoke.py, offline): the generated set, no film
  if (qs.get("scenario")) {
    sc = clone(PRESETS[qs.get("scenario")] || PRESETS["local-typical"]);
    $("#film").add(new Option("Generated dummy run (" + sc.name + ")", "dummy")); $("#film").disabled = true;
    $("#filmInfo").textContent = sc.note || ""; $("#run").querySelector(".profiles").style.display = "none"; $("#sliders").textContent = "Preset durations (smoke test).";
    emu.load(sc, {}, null); emu.seek(+(qs.get("at") || 0)); writeLog();
  } else {
    const list = await films();
    const sel = $("#film");
    for (const f of list) sel.add(new Option(`${f.product_name} · ${f.name || f.film}${f.language !== "en" ? " · " + f.language : ""}${f.recorded ? " · real timing" : ""}`, f.film));
    sel.add(new Option("Generated dummy run", "dummy"));
    sel.onchange = () => pick(sel.value);
    const want = qs.get("film");
    sel.value = want && list.some((f) => f.film === want) ? want : (list.find((f) => f.recorded) || list[0] || { film: "dummy" }).film;
    await pick(sel.value);
    if (qs.get("at")) emu.seek(+qs.get("at"));
  }
  if (qs.get("auto")) { emu.seek(emu.end); window.__report = { ...emu.report(), end: emu.end, events: emu.events.length, overflows: emu.metrics.overflows }; }
  if (qs.get("play")) emu.playing = true;
}
start();
