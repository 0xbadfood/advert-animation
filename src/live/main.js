// The live page in the emulator: a finished advert film plays as a run, its signals sent at their times (story
// seconds x speed), into the same LiveModel and LiveView the portal will drive from the real event stream.
// URL: ?film=<id>&profile=local|cloud&view=desk|phone&speed=<n>&at=<s>&play=1&fail=<stage>&retry=1 ; &auto=1 seeks to the end and
// exposes window.__live (tools/smoke.py).
import { LiveModel } from "./model.js";
import { LiveView } from "./view.js";
import { bundleAdapter, fetchBundle } from "./adapter.js";
import { synthesize } from "../emulator/synth.js";
import { realSource } from "../emulator/real.js";
import { baseFor, cloudScale, scenarioFor, SLIDERS } from "../emulator/timing.js";

const PRESET = Object.values(import.meta.glob("../../scenarios/local-typical.json", { eager: true, import: "default" }))[0];
const qs = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);

const view = new LiveView($("#stage"));
let dirty = true;
const model = new LiveModel({ onChange: () => (dirty = true) });
let bundle = null, events = [], end = 0, next = 0, t = 0, playing = false, speed = 5;
let profile = qs.get("profile") === "cloud" ? "cloud" : "local";

function build() {
  const { base } = baseFor(bundle);
  const scale = profile === "cloud" ? cloudScale(base, bundle.visuals.clips.length) : Object.fromEntries(SLIDERS.map(([s]) => [s, 1]));
  const sc = scenarioFor(PRESET, bundle, base, scale);
  if (qs.get("fail")) sc.fail = { stage: qs.get("fail"), at: 0.5, retry: qs.get("retry") === "1" };   // a failed step, retried or not
  events = synthesize(sc, realSource({ bundle }));
  end = (events.length ? events[events.length - 1].t : 0) + 6;
  model.adapter = bundleAdapter(bundle); model.setProfile(profile);
  $("#info").textContent = `${bundle.product_name} · “${bundle.pick.name}” · ${bundle.language} · ${bundle.direction.scenes.length} scenes · ${bundle.visuals.stills.length} pictures · ${bundle.visuals.clips.length} moving · run length ${fmt(end)} (${profile})`;
}

// replay the log up to time `to` without entrances: what a reload (or the email link) shows
function seek(to) {
  to = Math.max(0, Math.min(end, to));
  model.reset(); view.reset(); next = 0; t = to;
  model.catchup = true;
  send(to);
  model.tick(to);
  model.catchup = false;
  view.render(model); dirty = false;
}

function send(to) {
  while (next < events.length && events[next].t <= to) { const e = events[next++]; model.feed(e.job, e, e.t); }
}

const setText = (sel, v) => { const el = $(sel); if (el.textContent !== v) el.textContent = v; };
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ?debug=1: a line of the loop's own numbers under the controls, and every page error, so a browser that will not play
// (Safari, 2026-11-13) can be diagnosed from a screenshot
const debug = qs.get("debug") === "1";
let frames = 0, clicks = 0, lastNow = 0, lastDt = 0, hit = "none yet";
// what a press actually lands on (the element, its parents, the point): Safari 26 sent Play clicks elsewhere
const describe = (el) => { const out = []; for (let n = el; n && n !== document.body && out.length < 4; n = n.parentElement) out.push(n.tagName.toLowerCase() + (n.id ? "#" + n.id : "") + (n.classList && n.classList.length ? "." + [...n.classList].join(".") : "")); return out.join(" < "); };
document.addEventListener("pointerdown", (e) => { hit = `${describe(e.target)} @${Math.round(e.clientX)},${Math.round(e.clientY)}`; }, true);
const showErr = (msg) => { const el = $("#info"); el.innerHTML = `<b style="color:#b42318">page error: ${String(msg).replace(/</g, "&lt;")}</b>`; };
window.addEventListener("error", (e) => showErr(e.message + (e.filename ? ` (${e.filename.split("/").pop()}:${e.lineno})` : "")));
window.addEventListener("unhandledrejection", (e) => showErr("promise: " + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
// the loop runs from page load and survives an error in one frame (it shows in the bar instead of stopping playback)
let last = performance.now(), shownError = "";
function frame(now) {
  requestAnimationFrame(frame);
  try { step(now); } catch (err) {
    console.error(err);
    if (String(err) !== shownError) { shownError = String(err); $("#info").innerHTML = `<b style="color:#b42318">page error: ${shownError}</b>`; }
  }
}
function step(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
  frames++; lastNow = now; lastDt = dt;
  if (debug && frames % 10 === 0) $("#dbg").textContent = `frames ${frames} · now ${Math.round(now)} · perf ${Math.round(performance.now())} · dt ${dt.toFixed(3)} · playing ${playing} · speed ${speed} · t ${t.toFixed(2)} · next ${next}/${events.length} · clicks ${clicks} · last press: ${hit} · ${navigator.userAgent.replace(/^.*?\) /, "")}`;
  if (playing && bundle) {
    t = Math.min(end, t + dt * speed);
    send(t); model.tick(t);
    if (t >= end) playing = false;
  }
  if (dirty) { view.render(model); dirty = false; }
  // write only what changed: replacing a button's text node every frame makes Safari drop the click (press and
  // release land on different nodes), 2026-11-13
  setText("#clock", `${fmt(t)} / ${fmt(end)}`);
  const sv = String(end ? Math.round((t / end) * 1000) : 0);
  if (document.activeElement !== $("#seek") && $("#seek").value !== sv) $("#seek").value = sv;
  setText("#play", playing ? "Pause" : t >= end ? "Play again" : "Play");
  $("#play").classList.toggle("on", playing);
}

async function pick(id) {
  playing = false; document.body.classList.add("loading");
  try { bundle = await fetchBundle(id); } catch (e) { $("#loading").textContent = "could not load: " + e.message; return; }
  document.body.classList.remove("loading");
  build(); seek(0);
  const u = new URL(location.href); u.searchParams.set("film", id); history.replaceState(null, "", u);
}

function setProfile(p) {
  profile = p; $("#local").classList.toggle("on", p === "local"); $("#cloud").classList.toggle("on", p === "cloud");
  const frac = end ? t / end : 0; build(); seek(frac * end);
}
function setView(v) {
  document.body.classList.toggle("phone", v === "phone"); $("#desk").classList.toggle("on", v !== "phone"); $("#phone").classList.toggle("on", v === "phone");
}

$("#play").onclick = () => { clicks++; if (!bundle) return; if (t >= end) seek(0); playing = !playing; last = performance.now(); };
$("#restart").onclick = () => seek(0);
$("#reload").onclick = () => seek(t);
// space toggles Play (outside text fields), whatever the pointer does
document.addEventListener("keydown", (e) => { if (e.code === "Space" && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) { e.preventDefault(); $("#play").onclick(); } });
$("#speed").onchange = () => (speed = +$("#speed").value);
$("#seek").oninput = () => seek((+$("#seek").value / 1000) * end);
$("#local").onclick = () => setProfile("local");
$("#cloud").onclick = () => setProfile("cloud");
$("#desk").onclick = () => setView("desk");
$("#phone").onclick = () => setView("phone");

async function start() {
  speed = +(qs.get("speed") || 5); $("#speed").value = String(speed);
  setView(qs.get("view") === "phone" ? "phone" : "desk");
  $("#local").classList.toggle("on", profile === "local"); $("#cloud").classList.toggle("on", profile === "cloud");
  const r = await fetch("/api/films");
  if (r.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search); return; }
  const list = await r.json(), sel = $("#film");
  for (const f of list) sel.add(new Option(`${f.product_name} · ${f.name || f.film}${f.language !== "en" ? " · " + f.language : ""}${f.recorded ? " · real timing" : ""}`, f.film));
  sel.onchange = () => pick(sel.value);
  const want = qs.get("film");
  sel.value = want && list.some((f) => f.film === want) ? want : (list.find((f) => f.recorded) || list[0]).film;
  await pick(sel.value);
  if (qs.get("at")) seek(+qs.get("at"));
  if (qs.get("auto")) { seek(end); window.__live = { end, events: events.length, items: model.pieces.map((i) => i.kind), stage: model.stage, eta: model.eta }; }
  if (qs.get("play")) playing = true;
}
requestAnimationFrame(frame);
start();
window.__model = model;
// the estimate against the truth over a whole run, one sample per story second (tools/smoke.py --live)
window.__trace = () => {
  seek(0); const out = [], last = events.length ? events[events.length - 1].t : 0;
  for (let x = 0; x <= last; x += 1) { send(x); model.tick(x); out.push({ t: x, stage: model.stage, mid: model.eta.mid, hi: model.eta.hi, left: last - x, text: model.eta.text }); }
  return out;
};
