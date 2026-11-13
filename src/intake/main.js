// The intake page: where a business owner tells us where to find them, and the first film starts. Six short steps
// (sources, offer, audience, photos, about you, where to send the film), one question per screen on a phone, one calm
// column on desktop. Research starts as soon as the first source is usable and shows itself in the side panel
// ("Found it": their name, logo, colours) while the rest is answered, so a third of the wait is spent here.
// The design and the request it sends are specified for the pipeline in HANDOVER.md.
//
// URL: ?film=<id> the finished film whose research the mock replays (default Tweaklogic, 17d6c3a8ff);
//      &lang=en|hinglish ; &research=<s> how long the mock's research takes (default 72) ; &speed=<n>
import { COPY, LANGS, COUNTRIES } from "./copy.js";
import * as S from "./sources.js";
import { mockBackend } from "./backend.js";

const qs = new URLSearchParams(location.search);
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };

const backend = mockBackend({ film: qs.get("film") || "17d6c3a8ff", research: +(qs.get("research") || 72), speed: +(qs.get("speed") || 1) });
const STEPS = 6;
const st = {
  lang: qs.get("lang") || store.get("adtwist.lang") || "en", step: 1, dir: 1,
  src: { ig: "", web: "", fb: "", maps: "" }, more: false,
  offer: { has: null, what: "", until: "", cond: "", where: [] },
  country: "", filmLang: "en", notes: "", photos: [],
  role: "", heard: "", fav: "", wa: "", email: "",
  err: {}, started: false, sending: false,
  r: { state: "idle", label: "", desktop: null, mobile: null, logo: null, palette: [], facts: [], market: "", name: "" },
};
if (!COPY[st.lang]) st.lang = "en";
const T = () => COPY[st.lang];

// ---------------------------------------------------------------- the frame
const root = $("#intake");
root.className = "ik";
root.innerHTML = `
  <header class="ik-top">
    <div class="ik-logo"><span class="ik-mark"></span><b></b></div>
    <div class="ik-lang" role="group">${LANGS.map(([k, label]) => `<button type="button" data-lang="${k}">${label}</button>`).join("")}</div>
  </header>
  <div class="ik-main">
    <section class="ik-form">
      <div class="ik-prog"><ol>${Array.from({ length: STEPS }, (_, i) => `<li data-n="${i + 1}"></li>`).join("")}</ol><span class="ik-count"></span></div>
      <div class="ik-stage"></div>
      <div class="ik-nav"><button type="button" class="ik-back"></button><button type="button" class="ik-next"></button></div>
    </section>
    <aside class="ik-panel"></aside>
  </div>`;
root.querySelectorAll(".ik-lang button").forEach((b) => (b.onclick = () => { st.lang = b.dataset.lang; store.set("adtwist.lang", st.lang); renderAll(); }));
$(".ik-back", root).onclick = () => go(st.step - 1);
$(".ik-next", root).onclick = () => next();
root.querySelectorAll(".ik-prog li").forEach((li) => (li.onclick = () => { const n = +li.dataset.n; if (n < st.step) go(n); }));

// ---------------------------------------------------------------- steps
const field = (id, label, value, ph, { type = "text", help = "", err = "", pre = "", mode = "" } = {}) => `
  <label class="ik-field ${err ? "bad" : ""}"><span class="ik-label">${esc(label)}</span>
    <span class="ik-input">${pre ? `<i>${esc(pre)}</i>` : ""}<input id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(ph)}" ${mode ? `inputmode="${mode}"` : ""} autocomplete="off" autocapitalize="off" spellcheck="false"></span>
    ${err ? `<span class="ik-err">${esc(err)}</span>` : help ? `<span class="ik-help">${esc(help)}</span>` : ""}</label>`;
const chips = (name, opts, value, multi = false) => `<div class="ik-chips" data-chips="${name}" ${multi ? "data-multi" : ""}>${opts.map((o) => {
  const [k, label] = Array.isArray(o) ? o : [o, o]; const on = multi ? value.includes(k) : value === k;
  return `<button type="button" data-v="${esc(k)}" class="${on ? "on" : ""}">${esc(label)}</button>`;
}).join("")}</div>`;

const VIEWS = {
  1: (t) => `<h1>${t.s1.title}</h1><p class="ik-sub">${t.s1.sub}</p>
    ${field("ig", t.s1.ig, st.src.ig, t.s1.igPh, { help: t.s1.igHelp, err: st.err.ig, pre: "" })}
    ${field("web", t.s1.web, st.src.web, t.s1.webPh, { err: st.err.web, mode: "url" })}
    ${st.more ? field("fb", t.s1.fb, st.src.fb, t.s1.fbPh, { err: st.err.fb }) + field("maps", t.s1.maps, st.src.maps, t.s1.mapsPh, { help: t.s1.mapsHelp, err: st.err.maps }) : `<button type="button" class="ik-link" data-act="more">+ ${t.s1.more}</button>`}
    ${st.err.s1 ? `<p class="ik-err big">${t.s1.need}</p>` : ""}`,
  2: (t) => `<h1>${t.s2.title}</h1><p class="ik-sub">${t.s2.sub}</p>
    ${chips("offer", [["yes", t.s2.yes], ["no", t.s2.no]], st.offer.has === true ? "yes" : st.offer.has === false ? "no" : "")}
    ${st.offer.has ? `<div class="ik-reveal">
      ${field("what", t.s2.what, st.offer.what, t.s2.whatPh, { err: st.err.what ? t.s2.need : "" })}
      <div class="ik-row">${field("until", t.s2.until, st.offer.until, "", { type: "date" })}${field("cond", t.s2.cond, st.offer.cond, t.s2.condPh)}</div>
      <div class="ik-field"><span class="ik-label">${t.s2.where}</span>${chips("where", t.s2.whereOpts.map((o, i) => [["store", "website", "dm", "app"][i], o]), st.offer.where, true)}</div></div>` : ""}`,
  3: (t) => `<h1>${t.s3.title}</h1>
    <label class="ik-field"><span class="ik-label">${t.s3.country}</span><span class="ik-input"><select id="country"><option value="" ${st.country ? "" : "selected"}>${esc(t.s3.auto)}</option>${COUNTRIES.map((c) => `<option ${c === st.country ? "selected" : ""}>${c}</option>`).join("")}</select></span></label>
    <div class="ik-field"><span class="ik-label">${t.s3.lang}</span>${chips("filmLang", Object.entries(t.s3.langs), st.filmLang)}</div>
    <label class="ik-field"><span class="ik-label">${t.s3.notes}</span><textarea id="notes" rows="3" placeholder="${esc(t.s3.notesPh)}">${esc(st.notes)}</textarea></label>`,
  4: (t) => `<h1>${t.s4.title}</h1><p class="ik-sub">${t.s4.sub}</p>
    <label class="ik-drop" tabindex="0"><input id="photos" type="file" accept="image/*" multiple hidden><b>${t.s4.drop}</b><span>${t.s4.limit}</span></label>
    <div class="ik-thumbs">${st.photos.map((p, i) => `<figure><img src="${p.url}" alt=""><button type="button" data-rm="${i}" aria-label="${t.s4.remove}">×</button></figure>`).join("")}</div>`,
  5: (t) => `<h1>${t.s5.title}</h1>
    <div class="ik-field"><span class="ik-label">${t.s5.role}</span>${chips("role", t.s5.roles.map((r, i) => [["owner", "marketing", "agency", "other"][i], r]), st.role)}</div>
    <div class="ik-field"><span class="ik-label">${t.s5.heard}</span>${chips("heard", t.s5.heards.map((r, i) => [["instagram", "friend", "google", "whatsapp", "other"][i], r]), st.heard)}</div>
    ${field("fav", t.s5.fav, st.fav, t.s5.favPh)}`,
  6: (t) => `<h1>${t.s6.title}</h1><p class="ik-sub">${t.s6.sub}</p>
    ${field("wa", t.s6.wa, st.wa, t.s6.waPh, { type: "tel", pre: "+91", mode: "tel", err: st.err.wa })}
    <div class="ik-or"><span>${t.s6.or}</span></div>
    ${field("email", t.s6.email, st.email, t.s6.emailPh, { type: "email", mode: "email", err: st.err.email })}
    ${st.err.s6 ? `<p class="ik-err big">${t.s6.need}</p>` : ""}<p class="ik-help">${t.s6.consent}</p>`,
};

// every input writes straight into the state (no re-render while typing)
const BIND = { ig: (v) => (st.src.ig = v), web: (v) => (st.src.web = v), fb: (v) => (st.src.fb = v), maps: (v) => (st.src.maps = v),
  what: (v) => (st.offer.what = v), until: (v) => (st.offer.until = v), cond: (v) => (st.offer.cond = v),
  country: (v) => (st.country = v), notes: (v) => (st.notes = v), fav: (v) => (st.fav = v), wa: (v) => (st.wa = v), email: (v) => (st.email = v) };

function renderStep(animate = true) {
  const t = T(), stage = $(".ik-stage", root);
  stage.innerHTML = `<div class="ik-step ${animate ? (st.dir > 0 ? "fwd" : "bwd") : ""}">${VIEWS[st.step](t)}</div>`;
  stage.querySelectorAll("input, select, textarea").forEach((el) => {
    if (BIND[el.id]) el.addEventListener("input", () => {
      BIND[el.id](el.value);
      if (st.err[el.id]) { delete st.err[el.id]; const f = el.closest(".ik-field"); f.classList.remove("bad"); const m = f.querySelector(".ik-err"); if (m) m.remove(); }
      if (st.err.s1 || st.err.s6) { delete st.err.s1; delete st.err.s6; stage.querySelectorAll(".ik-err.big").forEach((m) => m.remove()); }
      if (st.step === 1) soonStart();
    });
    if (el.tagName === "INPUT" && el.type !== "file") el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); next(); } });
  });
  stage.querySelectorAll("[data-chips]").forEach((g) => g.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const name = g.dataset.chips, v = b.dataset.v;
    if (name === "offer") { st.offer.has = v === "yes"; delete st.err.what; renderStep(false); if (st.offer.has) $("#what").focus(); return; }
    if (name === "where") { const w = st.offer.where; w.includes(v) ? w.splice(w.indexOf(v), 1) : w.push(v); }
    else st[name] = st[name] === v && name !== "filmLang" ? "" : v;
    g.querySelectorAll("button").forEach((x) => x.classList.toggle("on", name === "where" ? st.offer.where.includes(x.dataset.v) : st[name] === x.dataset.v));
    if (name === "filmLang") backend.update({ market: market() });
  }));
  const more = stage.querySelector("[data-act=more]"); if (more) more.onclick = () => { st.more = true; renderStep(false); $("#fb").focus(); };
  const photos = $("#photos", stage);
  if (photos) {
    const drop = stage.querySelector(".ik-drop");
    const add = (files) => { for (const f of [...files].filter((f) => f.type.startsWith("image/")).slice(0, 6 - st.photos.length)) st.photos.push({ name: f.name, url: URL.createObjectURL(f), file: f }); renderStep(false); };
    photos.onchange = () => add(photos.files);
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); add(e.dataTransfer.files); });
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); photos.click(); } });
    stage.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { const [p] = st.photos.splice(+b.dataset.rm, 1); URL.revokeObjectURL(p.url); renderStep(false); }));
  }
  const first = stage.querySelector("input:not([type=file]):not([type=date]), textarea");
  if (animate && first && matchMedia("(pointer: fine)").matches) first.focus({ preventScroll: true });
}

function renderChrome() {
  const t = T();
  document.documentElement.lang = st.lang === "en" ? "en" : "hi-Latn";
  $(".ik-logo b", root).textContent = t.brand;
  root.querySelectorAll(".ik-lang button").forEach((b) => b.classList.toggle("on", b.dataset.lang === st.lang));
  root.querySelectorAll(".ik-prog li").forEach((li) => { const n = +li.dataset.n; li.className = n < st.step ? "done" : n === st.step ? "now" : ""; });
  $(".ik-count", root).textContent = t.step(st.step, STEPS);
  const back = $(".ik-back", root), nxt = $(".ik-next", root);
  back.textContent = t.back; back.style.visibility = st.step > 1 ? "visible" : "hidden";
  const optional = st.step === 4 && !st.photos.length || st.step === 5 && !st.role && !st.heard && !st.fav;
  nxt.textContent = st.step === STEPS ? t.s6.go : optional ? t.skip : t.next;
  nxt.classList.toggle("go", st.step === STEPS); nxt.disabled = st.sending;
}

function renderAll() { renderChrome(); renderStep(false); renderPanel(); }

// ---------------------------------------------------------------- moving between steps
function go(n) { if (n < 1 || n > STEPS || n === st.step) return; st.dir = n > st.step ? 1 : -1; st.step = n; st.err = {}; renderChrome(); renderStep(); window.scrollTo({ top: 0, behavior: "smooth" }); }

function validate(step) {
  const err = {};
  if (step === 1) {
    const got = { ig: S.instagram(st.src.ig), web: S.website(st.src.web), fb: S.facebook(st.src.fb), maps: S.maps(st.src.maps) };
    for (const [k, v] of Object.entries(got)) if (v && v.error) err[k] = st.lang === "en" ? "That doesn't look right." : "Yeh sahi nahi lag raha.";
    if (!Object.values(got).some((v) => v && !v.error) && !Object.keys(err).length) err.s1 = true;
  }
  if (step === 2 && st.offer.has && !st.offer.what.trim()) err.what = true;
  if (step === 6) {
    const w = S.whatsapp(st.wa), e = S.email(st.email);
    if (w && w.error) err.wa = st.lang === "en" ? "Check the number." : "Number check karein.";
    if (e && e.error) err.email = st.lang === "en" ? "Check the email." : "Email check karein.";
    if (!w && !e) err.s6 = true;
  }
  return err;
}

function next() {
  const err = validate(st.step);
  if (Object.keys(err).length) { st.err = err; renderStep(false); const bad = $(".ik-field.bad input", root); if (bad) bad.focus(); return; }
  if (st.step === 1) startResearch();
  if (st.step === STEPS) return submit();
  go(st.step + 1);
}

// ---------------------------------------------------------------- research: starts on the first usable source
let soon = null;
function soonStart() {
  clearTimeout(soon);
  soon = setTimeout(() => { const s = sources(); if (s.instagram || s.website) startResearch(); }, 1200);
}
function sources() {
  const ok = (v) => (v && !v.error ? v : null);
  const ig = ok(S.instagram(st.src.ig)), web = ok(S.website(st.src.web)), fb = ok(S.facebook(st.src.fb)), mp = ok(S.maps(st.src.maps));
  return { instagram: ig && ig.value, website: web && web.value, facebook: fb && fb.value, maps: mp && mp.value, _label: (web || ig || fb || mp || {}).label };
}
async function startResearch() {
  if (st.started) return;
  const s = sources(); if (!s._label) return;
  st.started = true; st.r.state = "reading"; st.r.label = s._label; renderPanel();
  const { product } = await backend.start(s);
  st.r.name = product;
}
backend.onEvent((job, e, data, bundle) => {
  const r = st.r, d = e.data || {}, ref = e.ref || "";
  if (e.kind === "asset.landed" && ref.startsWith("assets/") && data.image) r[data.which || "desktop"] = data.image;
  if (e.kind === "research.stage" && data.palette) { r.palette = data.palette; r.logo = data.logo; r.state = "found"; if (bundle) r.name = bundle.product_name; }
  if (e.kind === "research.market" && data.market) r.market = data.market;
  if (e.kind === "view.facts" && data.cards) r.facts = data.cards;
  if (e.kind === "research.stage" && d.stage === "digest" && d.state === "done") r.state = "done";
  renderPanel();
});

// the panel: what research has found so far (their own site, name, logo, colours, a few facts)
function renderPanel() {
  const t = T().panel, r = st.r, p = $(".ik-panel", root);
  p.classList.toggle("live", r.state !== "idle"); p.dataset.state = r.state;
  if (r.state === "idle") { p.innerHTML = `<div class="ik-pidle"><span class="ik-pulse"></span><p>${t.idle}</p></div>`; return; }
  const facts = r.facts.filter((f) => !/^Sells /.test(f)).slice(0, 3).map((f) => f.length > 110 ? f.slice(0, 108).replace(/\s+\S*$/, "") + "…" : f);
  const html = `
    <div class="ik-phead"><span class="ik-pdot"></span><b>${t.title}</b><em>${r.state === "done" ? "✓" : ""}</em></div>
    ${r.state === "reading" && !r.desktop ? `<p class="ik-pline">${esc(t.reading(r.label))}</p><div class="ik-skel"></div>` : ""}
    ${r.desktop ? `<div class="ik-browser"><i></i><i></i><i></i><span>${esc(r.label)}</span><img src="${esc(r.desktop)}" alt=""></div>` : ""}
    ${r.state !== "reading" ? `<div class="ik-found">${r.logo ? `<img src="${esc(r.logo)}" alt="">` : ""}<div><span>${t.found}</span><b>${esc(r.name)}</b></div></div>
      <div class="ik-pblock"><span class="ik-plabel">${t.colours}</span><div class="ik-sw">${r.palette.map((c) => `<i style="background:${esc(c)}"></i>`).join("")}</div></div>` : ""}
    ${facts.length ? `<div class="ik-pblock"><span class="ik-plabel">${t.facts}</span>${r.market ? `<p class="ik-mk">${esc(r.market)}</p>` : ""}${facts.map((f) => `<p class="ik-fact">${esc(f)}</p>`).join("")}</div>` : ""}
    <p class="ik-pfoot ${r.state === "done" ? "ok" : ""}">${r.state === "done" ? t.ready : r.state === "found" ? t.working : ""}</p>
    ${r.state !== "reading" ? `<p class="ik-wrong">${t.wrong}</p>` : ""}`;
  // keep the images that already loaded; only swap when the content changed
  if (p.dataset.html !== html) { p.dataset.html = html; p.innerHTML = html; const lg = p.querySelector(".ik-found img"); if (lg) backLogo(lg); }
}

// a white logo on a white tile disappears: measure the logo's own pixels and put a light one on a dark tile
function backLogo(img) {
  const run = () => {
    try {
      const c = document.createElement("canvas"); c.width = c.height = 24; const g = c.getContext("2d");
      g.drawImage(img, 0, 0, 24, 24); const px = g.getImageData(0, 0, 24, 24).data;
      let lum = 0, w = 0;
      for (let i = 0; i < px.length; i += 4) { const a = px[i + 3] / 255; lum += a * (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255; w += a; }
      const dark = st.r.palette.slice().sort((x, y) => luma(x) - luma(y))[0] || "#1d1a33";
      if (w > 4 && lum / w > 0.72) img.style.background = luma(dark) < 0.35 ? dark : "#1d1a33";
    } catch (e) { /* a cross-origin logo cannot be read; leave the white tile */ }
  };
  img.complete ? run() : img.addEventListener("load", run, { once: true });
}
const luma = (hex) => { const n = parseInt(String(hex).slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; };

// ---------------------------------------------------------------- the request
// the country is discovered by research (advert: POST /products/{slug}/market); the form only overrides it when named
const market = () => ({ language: st.filmLang, drama: 1, country_override: st.country || "" });
function request() {
  const s = sources(), w = S.whatsapp(st.wa), e = S.email(st.email);
  return {
    urls: [s.website].filter(Boolean),                             // today's request.json field, kept
    sources: { instagram: s.instagram || null, website: s.website || null, facebook: s.facebook || null, maps: s.maps || null },
    offer: st.offer.has ? { what: st.offer.what.trim(), valid_until: st.offer.until || null, condition: st.offer.cond.trim() || null, redeem: st.offer.where.slice() } : null,
    market: market(), notes: st.notes.trim(), photos: st.photos.map((p) => p.name), name: "",
    about: { role: st.role || null, heard_from: st.heard || null, remembered_ad: st.fav.trim() || null },
    contact: { whatsapp: w && !w.error ? w.value : null, email: e && !e.error ? e.value : null },
    ui_language: st.lang, created: Date.now() / 1000,
  };
}
async function submit() {
  st.sending = true; renderChrome();
  root.classList.add("ik-sending");
  const { next: url } = await backend.submit(request());
  setTimeout(() => (location.href = url), 900);
}

renderAll(); renderStep(true);
window.__intake = { st, request };
