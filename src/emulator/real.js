import { FONT } from "../world/paint.js";

// A finished advert film as the emulator's source of artifacts. The bundle (server: tools/bundle.py) carries only what
// the story may show; everything it names is fetched and decoded up front (pictures, the voice for the waveforms, the
// ad as a video), so playback stays deterministic and seeking stays instant.

const fileUrl = (film, rel) => `/files/${film}/${rel.split("/").map(encodeURIComponent).join("/")}`;
const loadImage = (url) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url; });

// peak envelope of an audio file, n buckets 0..1
async function envelope(actx, url, n) {
  try {
    const buf = await (await fetch(url)).arrayBuffer();
    const a = await actx.decodeAudioData(buf), ch = a.getChannelData(0), step = Math.max(1, Math.floor(ch.length / n)), out = [];
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < Math.min(ch.length, (i + 1) * step); j += 8) m = Math.max(m, Math.abs(ch[j])); out.push(m); }
    const top = Math.max(0.05, ...out); return out.map((v) => Math.min(1, v / top));
  } catch (e) { return new Array(n).fill(0.2); }
}

function letterLogo(name, color) {
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
  g.fillStyle = color || "#5b3fd1"; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff"; g.font = `900 130px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText((name || "?").trim()[0].toUpperCase(), 128, 136);
  return c;
}

export async function loadFilm(film, onProgress = () => {}) {
  const b = await (await fetch(`/api/films/${film}`)).json();
  if (b.error) throw new Error(b.error);
  const url = (rel) => (rel ? fileUrl(film, rel) : null);
  onProgress("pictures");
  const R = b.research, V = b.visuals;
  const [desktop, mobile, logo, poster] = await Promise.all([R.desktop, R.mobile, R.logo, V.poster].map((r) => (r ? loadImage(url(r)) : null)));
  const stills = {};
  await Promise.all(V.stills.map(async (s) => { stills[s.index] = await loadImage(url(s.file)); }));
  onProgress("voice");
  const actx = new (window.AudioContext || window.webkitAudioContext)();
  const lineWaves = await Promise.all(b.audio.lines.map((l) => envelope(actx, url(l.file), 48)));
  actx.close && actx.close();
  const main = []; lineWaves.forEach((w) => { for (let i = 0; i < w.length; i += 2) main.push(w[i]); });
  onProgress("the ad");
  const video = document.createElement("video");
  video.muted = true; video.loop = true; video.playsInline = true; video.preload = "auto"; video.src = url(b.ad);
  await new Promise((res) => { video.onloadeddata = res; video.onerror = res; setTimeout(res, 8000); });
  const anyStill = Object.values(stills).find(Boolean);
  return { bundle: b, desktop, mobile, logo: logo || letterLogo(b.product_name, R.palette[1] || R.palette[0]), poster: poster || anyStill, stills, lineWaves, main, video };
}

// the run in the shape synth.js reads (the dummy set has the same shape)
export function realSource(run) {
  const b = run.bundle;
  return {
    real: true,
    palette: b.research.palette.length ? b.research.palette : ["#5b3fd1"],
    hooks: () => b.concepts.hooks.slice(),
    facts: b.research.facts,
    market: b.research.market,
    name: b.pick.name,
    scenes: () => b.direction.scenes.map((s) => s.seconds),
    truthsN: b.truths.n, pairs: b.judge.pairs, pickIndex: b.pick.index,
    shots: (b.research.desktop ? 1 : 0) + (b.research.mobile ? 1 : 0),
    stillIndices: b.visuals.stills.map((s) => s.index),
    clipScenes: b.visuals.clips.map((c) => c.scene),
    ticks: b.recorded ? b.recorded.ticks : null,
    uploads: {},
  };
}

// the data adapter: what the live page will fetch, served from the preloaded run
export function realAdapter(run) {
  const b = run.bundle;
  const still = (i) => run.stills[i] || run.poster;
  const ad = (g, W, H) => {
    const v = run.video;
    if (v.paused) v.play().catch(() => {});
    const iw = v.videoWidth || 9, ih = v.videoHeight || 16, s = Math.max(W / iw, H / ih);
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    if (v.readyState >= 2) g.drawImage(v, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
  };
  return {
    resolve(job, e, cb) {
      const d = e.data || {}, ref = e.ref || "";
      switch (e.kind) {
        case "research.stage": return cb(d.stage === "brief" && d.state === "done" ? { ...d, palette: b.research.palette, logo: run.logo } : d);
        case "asset.landed":
          if (ref.startsWith("assets/")) { const m = ref.includes("mobile"); return cb({ which: m ? "mobile" : "desktop", image: m ? run.mobile : run.desktop }); }
          if (d.asset === "still") return cb({ kind: "still", index: parseInt(String(d.name).replace(/\D/g, ""), 10) || 0, image: still(parseInt(String(d.name).replace(/\D/g, ""), 10) || 0) });
          if (d.asset === "poster") return cb({ kind: "poster", image: run.poster });
          if (d.asset === "background") return cb({ kind: "background", image: null });
          if (d.asset === "clip") return cb({ kind: "clip", scene: d.scene, image: still(d.scene) });
          return cb({});
        case "view.facts": return cb({ cards: b.research.facts });
        case "research.market": return cb({ market: b.research.market });
        case "view.ideas": return cb({ hooks: b.concepts.hooks });
        case "pick": case "view.pick": return cb({ hook: b.pick.hook, name: b.pick.name });
        case "film.stage":
          if (d.stage === "direction" && d.state === "done") return cb({ scenes: b.direction.scenes });
          if (d.stage === "audio" && d.state === "done") return cb({ seconds: b.audio.seconds, samples: run.main });
          return cb(d);
        case "audio.line": return cb({ ...d, samples: run.lineWaves[d.scene] || [] });
        case "film.done": return cb({ ad });
        default: return cb(d);
      }
    },
  };
}
