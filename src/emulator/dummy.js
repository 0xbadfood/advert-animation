import { rng } from "../story/runner.js";
import { FONT } from "../world/paint.js";

// Dummy artifacts for the emulator: the same shapes the pipeline produces, generated so a scenario can be played with
// nothing spent. Long variants are mixed in on purpose, so slot overflow shows up here first.

const HOOKS_EN = [
  "Your calendar is lying to you about Friday.",
  "Three tabs open, zero decisions made.",
  "She booked the meeting before the coffee cooled.",
  "What if the invoice paid itself before lunch?",
  "Every Monday starts with the same spreadsheet.",
  "The best salesperson on the team never sleeps.",
  "Nobody reads the onboarding email. Here is why that is fine.",
  "He timed it: forty minutes lost to one copy-paste, every single day of the quarter.",
  "A shop owner, a ledger and a very long Sunday.",
  "Grandma's recipe, now shipping to forty cities.",
];
const HOOKS_HI = [
  "Standup में पूछा, समझ आया? मैंने कहा, हाँ, समझ गया।",
  "शाम 5:40, Zoom 5:45 पर। Loader अभी भी घूम रहा है।",
  "Month-end की meeting। Total लाल चमक रहा था।",
  "Friday रात को, मैंने चुपके से model बदल दिया।",
  "रात 3 बजे। Agent ने चुपचाप कुछ बदला।",
  "Office की chai break पर एक शिकारी घात लगाए बैठा है।",
  "दुकान खुली, ग्राहक आए, और हिसाब खुद लिख गया।",
  "मम्मी की recipe, अब चालीस शहरों तक।",
  "हर सोमवार वही spreadsheet, वही सिरदर्द, वही देर रात तक बैठना और फिर भी गलती निकलना।",
];
const FACTS = [
  "Scheduling infrastructure for teams that book meetings all day.",
  "Category: calendar and booking software",
  "Sells in India and the US",
  "Buyer: operations leads and founders who run sales calls themselves and hate the back-and-forth of finding a time",
  "Leads with: open source, self-hostable, works with every calendar",
  "Seen beside Calendly, SavvyCal, Google Calendar",
];
const NAMES = ["The Friday Ledger", "Forty Cities", "Just a Minute, Mausi", "The Quiet Agent", "Copy, Paste, Repeat"];
const PALETTES = [["#1f2a44", "#3d6fe0", "#ffc857", "#f4f3f8", "#ff7a59"], ["#14532d", "#22c55e", "#facc15", "#fefce8", "#0f172a"], ["#3b0764", "#a855f7", "#f472b6", "#fdf4ff", "#1e1b4b"]];

function canvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

export const DEFAULTS = { HOOKS_EN, HOOKS_HI, FACTS, NAMES, PALETTES };

// scenario.artifacts (text, serialisable) and uploads (images and a video, this session only) override the dummies.
export function makeDummy(scenario, uploads = {}) {
  const r = rng((scenario.seed || 1) * 7919);
  const A = scenario.artifacts || {};
  const hi = scenario.language === "hinglish";
  const pool = (hi ? HOOKS_HI : HOOKS_EN).slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const palette = A.palette && A.palette.length ? A.palette : PALETTES[(scenario.seed || 1) % PALETTES.length];
  const stillCache = {};
  const given = (A.hooks || []).map((h) => h.trim()).filter(Boolean);

  const D = {
    palette,
    hooks: (n) => (given.length ? given.slice() : Array.from({ length: n }, (_, i) => pool[i % pool.length])),
    facts: A.facts && A.facts.filter(Boolean).length ? A.facts.filter(Boolean) : FACTS,
    market: A.market || (hi ? "Sells in India · Hinglish" : "Sells in India and the US"),
    name: A.ideaName || NAMES[(scenario.seed || 1) % NAMES.length],
    scenes: (n) => (A.scenes && A.scenes.length ? A.scenes.map(Number).filter((x) => x > 0) : Array.from({ length: n }, (_, i) => +(3 + ((i * 7 + 3) % 5) * 0.9).toFixed(1))),
    uploads,

    logo() {
      if (uploads.logo) return uploads.logo;
      const c = canvas(256, 256), g = c.getContext("2d"); g.fillStyle = palette[1]; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.font = `900 130px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("D", 128, 136); return c; },

    screenshot(mobile) {
      if (mobile ? uploads.mobile : uploads.desktop) return mobile ? uploads.mobile : uploads.desktop;
      const W = mobile ? 300 : 800, H = mobile ? 600 : 500, c = canvas(W, H), g = c.getContext("2d");
      g.fillStyle = palette[3]; g.fillRect(0, 0, W, H);
      g.fillStyle = palette[0]; g.fillRect(0, 0, W, H * 0.09);
      g.fillStyle = "#fff"; g.font = `800 ${H * 0.04}px ${FONT}`; g.textBaseline = "middle"; g.fillText("demo.co", W * 0.04, H * 0.045);
      g.fillStyle = palette[0]; g.font = `900 ${mobile ? H * 0.05 : H * 0.08}px ${FONT}`; g.textBaseline = "top";
      g.fillText("Meetings,", W * 0.06, H * 0.16); g.fillText("minus the back-and-forth.", W * 0.06, H * (mobile ? 0.22 : 0.26));
      g.fillStyle = palette[2]; g.fillRect(W * 0.06, H * 0.42, W * (mobile ? 0.5 : 0.22), H * 0.07);
      for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? palette[1] : "#e6e3f2"; g.fillRect(W * 0.06 + (mobile ? 0 : i * W * 0.3), H * (mobile ? 0.55 + i * 0.14 : 0.62), W * (mobile ? 0.88 : 0.27), H * (mobile ? 0.11 : 0.3)); }
      return c;
    },

    // a 9:16 still: a soft landscape keyed to the index, labelled so it is plainly a stand-in
    still(i) {
      if (uploads.stills && uploads.stills.length && i < 90) return uploads.stills[i % uploads.stills.length];
      if (stillCache[i]) return stillCache[i];
      const W = 360, H = 640, c = canvas(W, H), g = c.getContext("2d"), h = (i * 47 + (scenario.seed || 1) * 31) % 360;
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, `hsl(${h},70%,72%)`); sky.addColorStop(1, `hsl(${(h + 40) % 360},70%,88%)`);
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = `hsl(${(h + 180) % 360},60%,80%)`; g.beginPath(); g.arc(W * 0.7, H * 0.25, 46, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 3; k++) { g.fillStyle = `hsl(${(h + 90 + k * 20) % 360},${40 + k * 10}%,${55 - k * 10}%)`; g.beginPath(); g.moveTo(0, H * (0.6 + k * 0.1)); for (let x = 0; x <= W; x += 20) g.lineTo(x, H * (0.6 + k * 0.1) - Math.sin(x / 50 + i + k) * 30); g.lineTo(W, H); g.lineTo(0, H); g.fill(); }
      g.fillStyle = "#26214a"; g.beginPath(); g.arc(W * 0.42, H * 0.62, 16, 0, Math.PI * 2); g.fill(); g.fillRect(W * 0.42 - 12, H * 0.64, 24, 50);
      g.fillStyle = "rgba(255,255,255,0.85)"; g.font = `800 28px ${FONT}`; g.fillText(`still ${String(i).padStart(2, "0")}`, 18, H - 24);
      return (stillCache[i] = c);
    },

    samples(n, seed) { const rr = rng(seed * 131 + 7); return Array.from({ length: n }, (_, i) => Math.min(1, 0.15 + 0.7 * Math.abs(Math.sin(i * 0.37 + seed)) * rr())); },

    // the finished ad (9:16) as an animation: the stills in turn with a caption bar and a progress line
    ad(n) {
      const v = uploads.ad;
      if (v) return (g, W, H) => {
        if (v.paused) { v.muted = true; v.loop = true; v.play().catch(() => {}); }
        const iw = v.videoWidth || 9, ih = v.videoHeight || 16, s = Math.max(W / iw, H / ih);
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        if (v.readyState >= 2) g.drawImage(v, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
      };
      return (g, W, H, t) => {
        const k = Math.floor(t / 2.2) % Math.max(1, n), img = D.still(k), local = (t % 2.2) / 2.2;
        const s = 1.05 + local * 0.08, dw = W * s, dh = H * s;
        g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
        g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(W * 0.08, H * 0.74, W * 0.84, H * 0.08);
        g.fillStyle = "#fff"; g.font = `800 ${Math.round(H * 0.035)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(D.name, W / 2, H * 0.78);
        g.fillStyle = "#ffc857"; g.fillRect(0, H - 6, W * ((t % (2.2 * n)) / (2.2 * n)), 6); g.textAlign = "left";
      };
    },
  };
  return D;
}

// The emulator's data adapter: what a live adapter would fetch from /story and out/, made from the dummy set.
// resolve(job, event, cb) calls cb synchronously, so the emulator stays deterministic.
export function dummyAdapter(scenario, D) {
  return {
    resolve(job, e, cb) {
      const d = e.data || {}, ref = e.ref || "";
      switch (e.kind) {
        case "research.stage": return cb(d.stage === "brief" && d.state === "done" ? { ...d, palette: D.palette, logo: D.logo() } : d);
        case "asset.landed":
          if (ref.startsWith("assets/")) return cb({ which: ref.includes("mobile") ? "mobile" : "desktop", image: D.screenshot(ref.includes("mobile")) });
          if (d.asset === "still") { const i = parseInt(String(d.name).replace(/\D/g, ""), 10) || 0; return cb({ kind: "still", index: i, image: D.still(i) }); }
          if (d.asset === "poster") return cb({ kind: "poster", image: D.still(99) });
          if (d.asset === "background") return cb({ kind: "background", image: D.still(98) });
          if (d.asset === "clip") return cb({ kind: "clip", scene: d.scene, image: D.still(d.scene) });
          return cb({});
        case "view.facts": return cb({ cards: D.facts });
        case "research.market": return cb({ market: D.market });
        case "view.ideas": return cb({ hooks: d.hooks || [] });
        case "pick": case "view.pick": return cb({ hook: d.hook, name: d.name || D.name });
        case "film.stage":
          if (d.stage === "direction" && d.state === "done") return cb({ scenes: d.scenes || [] });
          if (d.stage === "audio" && d.state === "done") return cb({ seconds: d.seconds, samples: D.samples(120, 3) });
          return cb(d);
        case "audio.line": return cb({ ...d, samples: D.samples(48, (d.scene || 0) + 1) });
        case "film.done": return cb({ ad: D.ad(Math.max(1, d.stills || 6)) });
        default: return cb(d);
      }
    },
  };
}
