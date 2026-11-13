// The live page's data adapter for a finished advert film (the emulator's source of artifacts): the bundle the server
// builds (tools/bundle.py, only what the story may show), served as URLs so nothing is preloaded. The portal's adapter
// will have the same shape, reading the run's story views and files as they land.
const fileUrl = (film, rel) => (rel ? `/files/${film}/${rel.split("/").map(encodeURIComponent).join("/")}` : null);

// a voice line's loudness, n buckets 0..1 (decoded offline: no audio plays and no user gesture is needed)
const waves = new Map();
function envelope(url, n = 40) {
  if (!url) return Promise.resolve(null);
  if (!waves.has(url)) waves.set(url, (async () => {
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      const a = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(buf), ch = a.getChannelData(0);
      const step = Math.max(1, Math.floor(ch.length / n)), out = [];
      for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < Math.min(ch.length, (i + 1) * step); j += 16) m = Math.max(m, Math.abs(ch[j])); out.push(m); }
      const top = Math.max(0.05, ...out); return out.map((v) => Math.min(1, v / top));
    } catch (e) { return null; }
  })());
  return waves.get(url);
}

export async function fetchBundle(film) {
  const r = await fetch(`/api/films/${film}`);
  if (r.status === 401) { location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search); throw new Error("login"); }
  const b = await r.json();
  if (b.error) throw new Error(b.error);
  return b;
}

export function bundleAdapter(b) {
  const url = (rel) => fileUrl(b.film, rel), V = b.visuals, R = b.research;
  const stillOf = (i) => { const s = V.stills.find((x) => x.index === i); return url(s ? s.file : V.poster || (V.stills[0] && V.stills[0].file)); };
  const num = (name) => parseInt(String(name || "").replace(/\D/g, ""), 10) || 0;
  return {
    resolve(job, e, cb) {
      const d = e.data || {}, ref = e.ref || "";
      switch (e.kind) {
        case "research.stage": return cb(d.stage === "brief" && d.state === "done" ? { palette: R.palette, logo: url(R.logo) } : {});
        case "asset.landed":
          if (ref.startsWith("assets/")) { const m = ref.includes("mobile"); return cb({ which: m ? "mobile" : "desktop", image: url(m ? R.mobile : R.desktop) }); }
          if (d.asset === "still") return cb({ kind: "still", index: num(d.name), image: stillOf(num(d.name)) });
          if (d.asset === "clip") return cb({ kind: "clip", scene: d.scene, image: stillOf(d.scene) });
          return cb({});
        case "view.facts": return cb({ cards: R.facts });
        case "research.market": return cb({ market: R.market });
        case "view.ideas": return cb({ hooks: b.concepts.hooks });
        case "pick": case "view.pick": return cb({ hook: b.pick.hook, name: b.pick.name });
        case "film.stage":
          if (d.stage === "direction" && d.state === "done") return cb({ scenes: b.direction.scenes });
          if (d.stage === "audio" && d.state === "done") return cb({ seconds: b.audio.seconds });
          return cb({});
        case "audio.line": { const l = b.audio.lines[d.scene]; return envelope(l && url(l.file)).then((samples) => cb({ samples })); }
        case "film.done": return cb({ video: url(b.ad), poster: url(V.poster) || stillOf(0), name: b.pick.name, product: b.product_name, download: `${b.product}-${b.film}.mp4` });
        default: return cb({});
      }
    },
  };
}
