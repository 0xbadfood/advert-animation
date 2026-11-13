// The live page: what a first-time user watches while their film is made. One layout for desktop and phone (container
// queries switch the placement only): a header with the time left and the six-step rail, the current step's
// explainer card with its live status, and the feed of finished pieces, newest first. Draws a LiveModel
// (live/model.js); catch-up (a reload, a seek) shows everything already settled, without entrances.
import { STEPS, DONE } from "./steps.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NOW_EVERY = 5.5;                  // seconds between the rotating "what's happening now" lines
const NOW_AFTER = 6;                    // a step this old starts rotating them (a short step never needs them)

const TITLES = {
  site: "Your website", brand: "Your brand", facts: "What we learned", angles: "Angles found", lines: "Opening lines",
  weigh: "Comparing ideas", pick: "The chosen idea", scenes: "Scene plan", voice: "Voice recorded", pictures: "Pictures", film: "Your film",
};

export class LiveView {
  constructor(host, { title = true, onWatch = null } = {}) {
    this.host = host; this.setTitle = title; this.onWatch = onWatch;
    if (!document.getElementById("lv-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "lv-css", textContent: LIVE_CSS }));
    host.classList.add("lv");
    host.innerHTML = `
      <header class="lv-top">
        <div class="lv-head">
          <div class="lv-where"><span class="lv-stepno"></span><span class="lv-steptitle"></span></div>
          <div class="lv-eta"><b></b><span class="lv-slow">Taking a little longer than usual</span></div>
        </div>
        <ol class="lv-rail">${STEPS.map((s) => `<li data-n="${s.n}"><i><u></u></i><span>${esc(s.title)}</span></li>`).join("")}</ol>
      </header>
      <div class="lv-body">
        <section class="lv-card">
          <div class="lv-badge"><span></span></div>
          <div class="lv-kicker"></div>
          <h2 class="lv-title"></h2>
          <p class="lv-text"></p>
          <div class="lv-status"><i></i><span></span></div>
          <div class="lv-now"><span></span></div>
          <button class="lv-watch" type="button">Watch your film</button>
        </section>
        <section class="lv-feed">
          <h3 class="lv-feedh">Ready so far</h3>
          <div class="lv-items"></div>
          <p class="lv-empty">The pieces of your film will appear here as they are made.</p>
        </section>
      </div>
      <div class="lv-modal" hidden>
        <div class="lv-mbox">
          <h2>Your film is ready</h2><p class="lv-msub"></p>
          <video controls playsinline></video>
          <div class="lv-macts"><a class="lv-btn lv-dl" download>Download</a><button class="lv-btn lv-mclose" type="button">Close</button></div>
        </div>
      </div>`;
    this.q = (s) => host.querySelector(s);
    this.nodes = new Map();
    this.cardKey = null; this.nowI = 0; this.nowAt = 0;
    this.q(".lv-watch").onclick = () => this.watch();
    this.q(".lv-mclose").onclick = () => this.closeModal();
    this.q(".lv-modal").onclick = (e) => { if (e.target === this.q(".lv-modal")) this.closeModal(); };
  }

  reset() { this.q(".lv-items").innerHTML = ""; this.nodes.clear(); this.cardKey = null; this.closeModal(); this.film = null; }

  render(m) {
    const step = m.step, n = step ? step.n : 0, done = m.stage === "done";
    this.host.classList.toggle("lv-done", done); this.host.classList.toggle("lv-failed", !!m.failed);
    // header: where we are, the time left, the rail
    this.text(".lv-stepno", done ? "Done" : n ? `Step ${n} of ${STEPS.length}` : "Starting");
    this.text(".lv-steptitle", step ? step.title : "Setting up your run");
    this.text(".lv-eta b", m.failed ? "" : m.eta.text || (m.typical ? `Usually about ${Math.round(m.typical / 60)} min` : ""));
    this.q(".lv-eta").classList.toggle("slow", !!m.eta.slow && !done);
    const frac = m.stepProgress;
    this.host.querySelectorAll(".lv-rail li").forEach((li) => {
      const k = +li.dataset.n, st = done || k < n ? "done" : k === n ? "now" : "";
      if (li.className !== st) li.className = st;
      li.querySelector("u").style.width = st === "done" ? "100%" : st === "now" ? `${(frac * 100).toFixed(1)}%` : "0%";
    });
    // the card: re-enters when the step changes
    const key = done ? "done" : step ? step.key : "start";
    if (key !== this.cardKey) {
      this.cardKey = key; this.nowI = 0; this.nowAt = m.t;
      const s = done ? DONE : step;
      this.text(".lv-badge span", done ? "✓" : s ? String(s.n) : "·");
      this.text(".lv-kicker", done ? "All done" : s ? `Step ${s.n} of ${STEPS.length}` : "Starting");
      this.q(".lv-title").innerHTML = (s ? s.title : "Setting up your run").split(" ").map((w, i) => `<span style="--i:${i}">${esc(w)}</span>`).join(" ");
      this.text(".lv-text", s ? s.body : "Your film is being set up. This page updates by itself.");
      this.text(".lv-now span", "");
      this.q(".lv-card").classList.remove("in"); this.q(".lv-card").classList.toggle("instant", m.catchup);
      void this.q(".lv-card").offsetWidth; this.q(".lv-card").classList.add("in");
    }
    const status = done ? "" : m.statusOf(step);
    const st = this.q(".lv-status");
    if (st.dataset.v !== status) {
      st.dataset.v = status; this.text(".lv-status span", status); st.classList.toggle("empty", !status);
      if (!m.catchup) { st.classList.remove("tick"); void st.offsetWidth; st.classList.add("tick"); }
    }
    // the rotating line keeps a long step alive; it says what this step does, never what it found
    if (step && step.now && !done && m.t - m.stepStart > NOW_AFTER && m.t - this.nowAt >= NOW_EVERY) {
      this.nowAt = m.t; const line = step.now[this.nowI++ % step.now.length], el = this.q(".lv-now");
      el.classList.remove("show"); void el.offsetWidth; this.text(".lv-now span", line); el.classList.add("show");
    }
    // the feed
    const box = this.q(".lv-items"), feed = m.pieces;
    this.q(".lv-empty").hidden = feed.length > 0;
    feed.forEach((it, i) => {
      let node = this.nodes.get(it.id);
      if (!node) {
        node = document.createElement("article");
        node.className = `lv-it lv-${it.kind}` + (it.fresh && !m.catchup ? " enter" : "");
        node.innerHTML = `<div class="lv-itin"><div class="lv-ith"><span class="lv-itdot" style="--c:var(--s${it.step.n})"></span>${esc(TITLES[it.kind] || it.kind)}<em></em></div><div class="lv-itb"></div></div>`;
        node.rev = -1; this.nodes.set(it.id, node);
      }
      if (box.children[i] !== node) box.insertBefore(node, box.children[i] || null);
      if (node.rev !== it.rev) { node.rev = it.rev; this.fill(node, it, m.catchup); }
    });
    for (const [id, node] of this.nodes) if (!m.items.has(id)) { node.remove(); this.nodes.delete(id); }
    // the film: the end of the flow
    const film = m.items.get("film");
    this.film = film && film.data.video ? film.data : null;
    this.q(".lv-watch").hidden = !this.film;
    if (this.film && !this.opened && !m.catchup && this.autoOpen) { this.opened = true; this.watch(); }
    if (this.setTitle) document.title = done ? "✓ Your film is ready" : m.failed ? "Your film · paused" : n ? `(${n}/${STEPS.length}) ${m.eta.text ? m.eta.text.replace(" left", "") + " · " : ""}Making your film` : "Making your film";
  }

  text(sel, v) { const el = this.q(sel); if (el.textContent !== v) el.textContent = v; }

  // one feed item's body, by kind; lists keep their nodes so only the new entries animate
  fill(node, it, instant) {
    const d = it.data, b = node.querySelector(".lv-itb"), em = node.querySelector(".lv-ith em");
    const keyed = (cls, list, key, html) => {
      let wrap = b.querySelector("." + cls);
      if (!wrap) { b.innerHTML = `<div class="${cls}"></div>`; wrap = b.firstChild; }
      const have = new Map([...wrap.children].map((c) => [c.dataset.k, c]));
      list.forEach((x, i) => {
        const k = String(key(x, i));
        let c = have.get(k);
        if (!c) { c = document.createElement("div"); c.dataset.k = k; c.innerHTML = html(x, i); if (!instant) c.classList.add("new"); }
        else if (c.dataset.h !== html(x, i)) c.innerHTML = html(x, i);
        c.dataset.h = html(x, i);
        if (wrap.children[i] !== c) wrap.insertBefore(c, wrap.children[i] || null);
        have.delete(k);
      });
      for (const c of have.values()) c.remove();
    };
    switch (it.kind) {
      case "site":
        b.innerHTML = `<div class="lv-shots">${d.desktop ? `<img class="lv-desk" src="${esc(d.desktop)}" alt="">` : ""}${d.mobile ? `<img class="lv-mob" src="${esc(d.mobile)}" alt="">` : ""}</div>`;
        em.textContent = "captured"; break;
      case "brand":
        b.innerHTML = `<div class="lv-brandrow">${d.logo ? `<img class="lv-logo" src="${esc(d.logo)}" alt="">` : ""}<div class="lv-swatches">${(d.palette || []).map((c) => `<span style="background:${esc(c)}"><b>${esc(c)}</b></span>`).join("")}</div></div>`;
        break;
      case "facts":
        b.innerHTML = `${d.market ? `<div class="lv-market">${esc(d.market)}</div>` : ""}${(d.cards || []).map((c) => `<p class="lv-fact">${esc(c)}</p>`).join("")}`;
        break;
      case "angles":
        b.innerHTML = `<div class="lv-big"><b>${d.n}</b><span>true things worth saying about your business</span></div>`; break;
      case "lines":
        em.textContent = `${(d.hooks || []).length} written`;
        keyed("lv-hooks", d.hooks || [], (x, i) => i, (x) => `<q>${esc(x)}</q>`); break;
      case "weigh":
        em.textContent = d.total ? `${d.done} of ${d.total}` : "";
        b.innerHTML = `<div class="lv-meter"><i style="width:${d.total ? (100 * d.done / d.total).toFixed(1) : 0}%"></i></div><p class="lv-note">Each pair is judged twice, in both orders.</p>`; break;
      case "pick":
        b.innerHTML = `${d.name ? `<div class="lv-pickname">“${esc(d.name)}”</div>` : ""}${d.hook ? `<q class="lv-pickhook">${esc(d.hook)}</q>` : ""}<p class="lv-note">${esc(d.honest || "")}</p>`; break;
      case "scenes": {
        const sc = (d.scenes || []).filter((x) => x !== undefined), tot = sc.reduce((a, x) => a + (x || 0), 0);
        em.textContent = `${sc.length} scene${sc.length === 1 ? "" : "s"}${d.done && tot ? ` · ${Math.round(tot)} s` : ""}`;
        keyed("lv-strip", sc, (x, i) => i, (x, i) => `<span>${i + 1}</span>`);
        const avg = tot / Math.max(1, sc.length) || 1;      // a very short scene still gets room for its number
        b.querySelectorAll(".lv-strip > div").forEach((c, i) => (c.style.flexGrow = String(Math.max(avg * 0.5, sc[i] || avg)))); break;
      }
      case "voice": {
        const lines = (d.lines || []).filter(Boolean);
        em.textContent = d.done ? `${Math.round(d.seconds || 0)} s` : `${lines.length} line${lines.length === 1 ? "" : "s"}`;
        keyed("lv-wave", lines, (x, i) => i, (x) => (x.samples || fakeWave(x.seconds)).map((v) => `<i style="height:${(12 + 88 * v).toFixed(0)}%"></i>`).join(""));
        const avgL = lines.reduce((a, x) => a + (x.seconds || 0), 0) / Math.max(1, lines.length) || 1;
        b.querySelectorAll(".lv-wave > div").forEach((c, i) => (c.style.flexGrow = String(Math.max(avgL * 0.5, lines[i].seconds || avgL)))); break;
      }
      case "pictures": {
        const list = d.list || [], moving = list.filter((p) => p.moving).length;
        em.textContent = `${list.length} painted${moving ? ` · ${moving} moving` : ""}`;
        keyed("lv-pics", list, (x) => x.i, (x) => `<img src="${esc(x.image)}" alt="" loading="lazy">${x.moving ? "<b>moving</b>" : ""}`); break;
      }
      case "film":
        if (!d.video) { b.innerHTML = `<p class="lv-note">Finishing up…</p>`; break; }
        b.innerHTML = `<button class="lv-filmbtn" type="button"><img src="${esc(d.poster || "")}" alt=""><span>▶</span></button><div class="lv-filmmeta"><b>${esc(d.product || "")}</b>${d.name ? ` · “${esc(d.name)}”` : ""}</div>`;
        b.querySelector("button").onclick = () => this.watch(); break;
    }
  }

  watch() {
    const f = this.film; if (!f) return;
    if (this.onWatch) return this.onWatch(f);
    const mod = this.q(".lv-modal"), v = mod.querySelector("video");
    mod.querySelector(".lv-msub").textContent = `${f.product || ""}${f.name ? ` · “${f.name}”` : ""}`;
    const dl = mod.querySelector(".lv-dl"); dl.href = f.video; dl.setAttribute("download", f.download || "film.mp4");
    if (v.getAttribute("src") !== f.video) v.src = f.video;
    mod.hidden = false; v.currentTime = 0; v.muted = false;
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
  }
  closeModal() { const mod = this.q(".lv-modal"); mod.hidden = true; mod.querySelector("video").pause(); }
}

// a plausible waveform when the line's own is not decoded yet (deterministic per length)
function fakeWave(seconds = 3) {
  const n = 28, out = []; let x = Math.floor((seconds || 3) * 1000) % 9973;
  for (let i = 0; i < n; i++) { x = (x * 16807) % 2147483647; const env = Math.sin((Math.PI * (i + 0.5)) / n); out.push(0.25 + 0.6 * env * ((x % 1000) / 1000)); }
  return out;
}

export const LIVE_CSS = `
.lv { --ink: #1d1a33; --muted: #6e6a86; --line: #e7e4f0; --panel: #ffffff; --bg: #f6f5fa; --accent: #5b3fd1; --accent2: #7b5cd6;
  --good: #1f9d63; --gold: #e9a21f;
  --s1: #4c9be8; --s2: #e8a53a; --s3: #e0607e; --s4: #8b6ce0; --s5: #2fb4a4; --s6: #c86fd6; --s7: #e9a21f;
  container-type: inline-size; position: relative; background: var(--bg); color: var(--ink);
  font-family: "Inter", "Noto Sans Devanagari", system-ui, -apple-system, sans-serif; font-size: 15px; line-height: 1.45;
  -webkit-font-smoothing: antialiased; }
.lv *, .lv *::before, .lv *::after { box-sizing: border-box; }
.lv [hidden] { display: none !important; }

/* header: where we are, time left, the rail */
.lv-top { position: sticky; top: 0; z-index: 4; background: var(--bg);
  padding: 14px 16px 12px; border-bottom: 1px solid var(--line); }
.lv-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.lv-where { min-width: 0; display: flex; gap: 8px; align-items: baseline; font-weight: 600; overflow: hidden; }
.lv-stepno { color: var(--accent); font-weight: 700; white-space: nowrap; font-size: 13px; letter-spacing: .02em; text-transform: uppercase; }
.lv-steptitle { display: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--ink); }
.lv-eta { text-align: right; white-space: nowrap; display: flex; flex-direction: column; align-items: flex-end; }
.lv-eta b { font-weight: 750; font-variant-numeric: tabular-nums; font-size: 15px; }
.lv-slow { display: none; font-size: 12px; color: var(--muted); }
.lv-eta.slow .lv-slow { display: block; }
.lv-rail { list-style: none; margin: 10px 0 0; padding: 0; display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
.lv-rail li i { display: block; height: 5px; border-radius: 3px; background: var(--line); overflow: hidden; }
.lv-rail li u { display: block; height: 100%; width: 0; background: var(--accent); border-radius: 3px; transition: width .8s ease; }
.lv-rail li.now u { background: linear-gradient(90deg, var(--accent), var(--accent2)); }
.lv-rail li span { display: none; }
.lv.lv-done .lv-rail li u { background: var(--good); }

/* body: the card, then the feed */
.lv-body { padding: 16px; display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
.lv-card { position: relative; background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 20px 20px 18px;
  box-shadow: 0 1px 2px rgba(29,26,51,.04), 0 10px 30px rgba(29,26,51,.06); }
.lv-badge { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 19px;
  background: linear-gradient(140deg, var(--accent2), var(--accent)); box-shadow: 0 6px 16px rgba(91,63,209,.28); margin-bottom: 14px; }
.lv.lv-done .lv-badge { background: linear-gradient(140deg, #f6c35b, var(--gold)); box-shadow: 0 6px 16px rgba(233,162,31,.32); }
.lv-kicker { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.lv-title { margin: 4px 0 8px; font-size: 24px; line-height: 1.15; font-weight: 800; letter-spacing: -.02em; }
.lv-title span { display: inline-block; opacity: 0; transform: translateY(8px); }
.lv-card.in .lv-title span { animation: lv-word .5s cubic-bezier(.2,1.2,.4,1) forwards; animation-delay: calc(.08s + var(--i) * .06s); }
.lv-card.instant .lv-title span { animation: none; opacity: 1; transform: none; }
@keyframes lv-word { to { opacity: 1; transform: none; } }
.lv-text { margin: 0; color: var(--muted); }
.lv-card.in .lv-text { animation: lv-fade .5s ease .3s both; }
.lv-card.instant .lv-text { animation: none; }
@keyframes lv-fade { from { opacity: 0; } }
.lv-status { display: inline-flex; align-items: center; gap: 8px; margin-top: 14px; padding: 5px 12px 5px 10px; border-radius: 999px;
  background: #f0ecff; color: #4529b8; font-weight: 650; font-size: 14px; }
.lv-status.empty { display: none; }
.lv.lv-failed .lv-status { background: #fff1e0; color: #8a4600; }
.lv.lv-failed .lv-status i { background: #e08a1e; animation: none; }
.lv-status i { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: lv-pulse 1.4s ease-in-out infinite; }
.lv-status.tick { animation: lv-tick .4s ease; }
@keyframes lv-pulse { 50% { opacity: .3; transform: scale(.7); } }
@keyframes lv-tick { 40% { transform: scale(1.05); } }
.lv-now { margin-top: 10px; min-height: 18px; font-size: 13px; color: var(--muted); }
.lv-now:has(span:empty) { margin-top: 0; min-height: 0; }
.lv-now span:not(:empty)::before { content: ""; display: inline-block; width: 14px; height: 1px; background: currentColor; vertical-align: middle; margin-right: 8px; opacity: .6; }
.lv-now.show span { animation: lv-now .6s ease both; }
@keyframes lv-now { from { opacity: 0; transform: translateY(4px); } }
.lv.lv-done .lv-status, .lv.lv-done .lv-now { display: none; }
.lv-watch { margin-top: 16px; font: inherit; font-weight: 700; font-size: 16px; color: #fff; background: var(--accent); border: 0; border-radius: 12px;
  padding: 12px 20px; cursor: pointer; box-shadow: 0 8px 20px rgba(91,63,209,.3); width: 100%; }

/* the feed */
.lv-feedh { margin: 0 0 10px; font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.lv-empty { margin: 0; color: var(--muted); font-size: 14px; padding: 18px; border: 1px dashed var(--line); border-radius: 14px; text-align: center; }
.lv-items { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.lv-it { display: grid; grid-template-rows: 1fr; grid-template-columns: minmax(0, 1fr); }
.lv-it.enter { animation: lv-grow .55s cubic-bezier(.3,1,.4,1) both; }
.lv-it.enter .lv-itin { animation: lv-in .55s cubic-bezier(.2,1.2,.4,1) .1s both; }
@keyframes lv-grow { from { grid-template-rows: 0fr; } }
@keyframes lv-in { from { opacity: 0; transform: translateY(-10px) scale(.98); } }
.lv-itin { min-height: 0; overflow: hidden; background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
.lv-ith { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; margin-bottom: 10px; }
.lv-ith em { margin-left: auto; font-style: normal; font-weight: 600; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
.lv-itdot { width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.lv-note { margin: 8px 0 0; color: var(--muted); font-size: 13px; }
.new { animation: lv-pop .45s cubic-bezier(.2,1.3,.4,1) both; }
@keyframes lv-pop { from { opacity: 0; transform: translateY(6px) scale(.96); } }

.lv-shots { display: flex; gap: 10px; align-items: flex-start; }
.lv-shots img { display: block; min-width: 0; height: auto; border-radius: 8px; border: 1px solid var(--line); object-fit: cover; object-position: top; background: #eee; }
.lv-desk { flex: 1; min-width: 0; aspect-ratio: 16 / 10; width: 100%; }
.lv-mob { flex: 0 0 26%; width: 26%; aspect-ratio: 9 / 18; }
.lv-brandrow { display: flex; gap: 12px; align-items: center; }
.lv-logo { width: 48px; height: 48px; object-fit: contain; border-radius: 10px; border: 1px solid var(--line); background: #fff; padding: 4px; }
.lv-swatches { display: flex; flex: 1; gap: 6px; }
.lv-swatches span { flex: 1; height: 48px; border-radius: 10px; position: relative; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
.lv-swatches b { position: absolute; left: 0; right: 0; bottom: -18px; font-size: 11px; font-weight: 600; color: var(--muted); text-align: center; text-transform: uppercase; }
.lv-brand .lv-itin { padding-bottom: 26px; }
.lv-market { font-weight: 650; margin-bottom: 6px; }
.lv-market::before { content: "◉ "; color: var(--s1); }
.lv-fact { margin: 4px 0 0; color: var(--muted); }
.lv-big { display: flex; align-items: center; gap: 14px; }
.lv-big b { font-size: 40px; font-weight: 800; letter-spacing: -.03em; color: var(--s2); line-height: 1; }
.lv-big span { color: var(--muted); }
.lv-hooks { display: grid; gap: 8px; }
.lv-hooks q { display: block; quotes: "“" "”"; padding: 9px 12px; border-radius: 10px; background: #fbf7ef; border-left: 3px solid var(--s2); font-weight: 550; }
.lv-meter { height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }
.lv-meter i { display: block; height: 100%; background: var(--s3); border-radius: 4px; transition: width .4s ease; }
.lv-pick .lv-itin { border-color: color-mix(in srgb, var(--good) 40%, var(--line)); background: linear-gradient(180deg, #f1fbf6, #fff 60%); }
.lv-pickname { font-size: 22px; font-weight: 800; letter-spacing: -.01em; }
.lv-pickhook { display: block; quotes: "“" "”"; margin-top: 6px; font-weight: 550; }
.lv-pick .lv-note { color: var(--good); font-weight: 600; }
.lv-strip { display: flex; gap: 4px; }
.lv-strip > div { flex: 1 1 0; min-width: 0; height: 44px; border-radius: 8px; background: color-mix(in srgb, var(--s4) 16%, #fff); border: 1px solid color-mix(in srgb, var(--s4) 35%, #fff);
  display: grid; place-items: center; font-weight: 700; color: var(--s4); font-size: 13px; transition: flex-grow .5s ease; }
.lv-wave { display: flex; gap: 6px; height: 46px; }
.lv-wave > div { flex: 1 1 0; min-width: 0; display: flex; align-items: center; gap: 2px; padding: 0 4px; border-radius: 8px; background: color-mix(in srgb, var(--s5) 10%, #fff); }
.lv-wave i { flex: 1; min-width: 1px; border-radius: 2px; background: var(--s5); }
.lv-pics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.lv-pics > div { position: relative; aspect-ratio: 9 / 16; border-radius: 8px; overflow: hidden; background: #eee; }
.lv-pics img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lv-pics b { position: absolute; left: 4px; bottom: 4px; font-size: 10px; font-weight: 700; color: #fff; background: rgba(0,0,0,.55); padding: 1px 6px; border-radius: 999px; }
.lv-film .lv-itin { border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
.lv-filmbtn { position: relative; display: block; width: 100%; max-width: 280px; margin: 0 auto; aspect-ratio: 9 / 16; border: 0; padding: 0; border-radius: 12px; overflow: hidden; cursor: pointer; background: #000; }
.lv-filmbtn img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: .92; }
.lv-filmbtn span { position: absolute; inset: 0; margin: auto; width: 64px; height: 64px; border-radius: 50%; background: rgba(255,255,255,.92); display: grid; place-items: center; font-size: 24px; color: var(--accent); padding-left: 4px; }
.lv-filmmeta { text-align: center; margin-top: 10px; color: var(--muted); }
.lv-filmmeta b { color: var(--ink); }

/* the film modal */
.lv-modal { position: fixed; inset: 0; z-index: 50; background: rgba(20,16,40,.72); display: flex; align-items: center; justify-content: center; padding: 16px; }
.lv-mbox { background: #fff; border-radius: 18px; padding: 16px; width: min(420px, 100%); max-height: 96vh; display: grid; gap: 10px; box-shadow: 0 24px 60px rgba(0,0,0,.35); }
.lv-mbox h2 { margin: 0; font-size: 19px; font-weight: 800; }
.lv-msub { margin: 0; color: var(--muted); font-size: 14px; }
.lv-mbox video { width: 100%; max-height: 72vh; aspect-ratio: 9 / 16; background: #000; border-radius: 12px; object-fit: contain; }
.lv-macts { display: flex; gap: 8px; justify-content: flex-end; }
.lv-btn { font: inherit; font-weight: 700; padding: 8px 16px; border-radius: 10px; border: 1px solid var(--line); background: #fff; color: var(--ink); text-decoration: none; cursor: pointer; }
.lv-dl { background: var(--accent); color: #fff; border-color: var(--accent); }

/* desktop placement: the card stays in view on the left, the feed fills the right; the rail gets its labels */
@container (min-width: 860px) {
  .lv-top { padding: 18px 28px 14px; }
  .lv-steptitle { display: inline; font-size: 17px; }
  .lv-eta b { font-size: 20px; }
  .lv-rail { gap: 8px; margin-top: 14px; }
  .lv-rail li span { display: block; margin-top: 6px; font-size: 12px; font-weight: 600; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lv-rail li.now span { color: var(--ink); }
  .lv-body { grid-template-columns: minmax(320px, 400px) minmax(0, 1fr); gap: 28px; padding: 24px 28px 40px; align-items: start; }
  .lv-card { position: sticky; top: 112px; padding: 26px 26px 22px; }
  .lv-title { font-size: 30px; }
  .lv-feed { max-width: 760px; }
  .lv-pics { grid-template-columns: repeat(6, 1fr); }
  .lv-mob { flex-basis: 18%; width: 18%; }
  .lv-watch { width: auto; }
  .lv-filmbtn { max-width: 240px; }
}
`;
