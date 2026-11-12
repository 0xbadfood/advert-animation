// The emulator's server side, as a Vite plugin: an access key in front of everything, and a read-only view of
// finished advert films (tools/bundle.py) with a whitelist for their files.
//
// Access (same scheme as ~/advert/advert/web/auth.py): one key from ADANIME_API_KEY or `.api_key` in this folder
// (created on first start, mode 600). A browser signs in once at /login (cookie); scripts send `X-API-Key: <key>`,
// `Authorization: Bearer <key>` or `?key=<key>` (a ?key= link also sets the cookie).
//
//   GET /api/films              finished films, newest first
//   GET /api/films/<id>         the story bundle for one film (only what the story may show)
//   GET /files/<id>/<path>      a file from ~/advert/out, only if the film's bundle lists it (Range supported)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(os.homedir(), "advert", "out");
const PY = path.join(os.homedir(), "advert", ".venv", "bin", "python");
const KEY_FILE = path.join(ROOT, ".api_key");
const COOKIE = "adanime_key";
const CACHE = path.join(ROOT, "out", "bundles");

function key() {
  const env = (process.env.ADANIME_API_KEY || "").trim();
  if (env) return env;
  if (!fs.existsSync(KEY_FILE)) fs.writeFileSync(KEY_FILE, crypto.randomBytes(18).toString("base64url") + "\n", { mode: 0o600 });
  return fs.readFileSync(KEY_FILE, "utf8").trim();
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map((c) => c.trim().split("=")).filter((p) => p.length === 2).map(([k, v]) => [k, decodeURIComponent(v)]));
}

function presented(req, url) {
  const h = req.headers["x-api-key"] || "";
  const auth = req.headers.authorization || "";
  return h || (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "") || url.searchParams.get("key") || cookies(req)[COOKIE] || "";
}

function same(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }

function setCookie(res, req) {
  const secure = (req.headers["x-forwarded-proto"] || "") === "https" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(key())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${180 * 86400}${secure}`);
}

const LOGIN = (bad, next) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sign in</title>
<style>body{font:15px/1.4 system-ui,sans-serif;background:#f4f1fb;color:#26214a;margin:0}form{max-width:360px;margin:80px auto;background:#fff;border:1px solid #e3ddf6;border-radius:12px;padding:20px}
input{width:100%;box-sizing:border-box;padding:8px;border:1px solid #e3ddf6;border-radius:8px;font:inherit}button{margin-top:12px;padding:8px 16px;border:0;border-radius:8px;background:#5b3fd1;color:#fff;font:inherit;font-weight:700;cursor:pointer}
.bad{color:#c2410c;font-weight:700}small{color:#7d77a3;display:block;margin-top:12px}</style></head><body>
<form method="post" action="/login"><h2>Story emulator</h2>${bad ? '<p class="bad">wrong key</p>' : ""}
<input type="hidden" name="next" value="${String(next || "/").replace(/[^\w/?=&.-]/g, "")}"><label>Access key<br><input type="password" name="key" autofocus autocomplete="current-password"></label>
<button type="submit">Sign in</button><small>The key is in <code>.api_key</code> in ~/advert-animation (or ADANIME_API_KEY). Scripts send it as X-API-Key.</small></form></body></html>`;

function run(args) {
  return new Promise((resolve, reject) => execFile(PY, [path.join(ROOT, "tools", "bundle.py"), ...args], { maxBuffer: 64 << 20, timeout: 60000 }, (err, out, errOut) => (err ? reject(new Error(errOut || err.message)) : resolve(out))));
}

// a bundle is cached until anything in the film's folder is newer
async function bundleOf(id) {
  if (!/^[0-9a-f]{6,16}$/.test(id)) throw new Error("bad film id");
  const dir = path.join(OUT, "films", id), cache = path.join(CACHE, id + ".json");
  const newest = fs.existsSync(dir) ? Math.max(...fs.readdirSync(dir).map((f) => fs.statSync(path.join(dir, f)).mtimeMs)) : 0;
  if (fs.existsSync(cache) && fs.statSync(cache).mtimeMs > newest) return JSON.parse(fs.readFileSync(cache, "utf8"));
  const b = JSON.parse(await run([id]));
  fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(cache, JSON.stringify(b));
  return b;
}

let listCache = { t: 0, body: "" };
async function listing() {
  if (Date.now() - listCache.t < 60000) return listCache.body;
  listCache = { t: Date.now(), body: await run(["--list"]) };
  return listCache.body;
}

const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".wav": "audio/wav" };

function sendFile(req, res, file) {
  const st = fs.statSync(file), type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.setHeader("Content-Type", type); res.setHeader("Accept-Ranges", "bytes"); res.setHeader("Cache-Control", "private, max-age=3600");
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) {
    const start = m[1] ? +m[1] : 0, end = m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
    res.statusCode = 206; res.setHeader("Content-Range", `bytes ${start}-${end}/${st.size}`); res.setHeader("Content-Length", end - start + 1);
    fs.createReadStream(file, { start, end }).pipe(res);
  } else { res.setHeader("Content-Length", st.size); fs.createReadStream(file).pipe(res); }
}

function json(res, code, body) { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(typeof body === "string" ? body : JSON.stringify(body)); }

export default function adanimeApi() {
  return {
    name: "adanime-api",
    configureServer(server) {
      key();
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://x");
        // ---- sign in / out
        if (url.pathname === "/login" && req.method === "GET") { res.setHeader("Content-Type", "text/html"); return res.end(LOGIN(false, url.searchParams.get("next"))); }
        if (url.pathname === "/login" && req.method === "POST") {
          let body = ""; req.on("data", (c) => (body += c)); await new Promise((r) => req.on("end", r));
          const f = new URLSearchParams(body);
          if (same(f.get("key") || "", key())) { setCookie(res, req); res.statusCode = 303; res.setHeader("Location", f.get("next") || "/"); return res.end(); }
          res.statusCode = 401; res.setHeader("Content-Type", "text/html"); return res.end(LOGIN(true, f.get("next")));
        }
        if (url.pathname === "/logout") { res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0`); res.statusCode = 303; res.setHeader("Location", "/login"); return res.end(); }
        // ---- the key, for everything else
        const k = presented(req, url);
        if (!k || !same(k, key())) {
          if (req.method === "GET" && (req.headers.accept || "").includes("text/html")) { res.statusCode = 303; res.setHeader("Location", "/login?next=" + encodeURIComponent(url.pathname + url.search)); return res.end(); }
          res.statusCode = 401; res.setHeader("WWW-Authenticate", "Bearer"); return res.end("missing or wrong API key");
        }
        if (url.searchParams.get("key")) setCookie(res, req);
        // ---- the films
        try {
          if (url.pathname === "/api/films") return json(res, 200, await listing());
          let m = /^\/api\/films\/([0-9a-f]+)$/.exec(url.pathname);
          if (m) return json(res, 200, await bundleOf(m[1]));
          m = /^\/files\/([0-9a-f]+)\/(.+)$/.exec(url.pathname);
          if (m) {
            const b = await bundleOf(m[1]), rel = decodeURIComponent(m[2]);
            if (!b.files.includes(rel)) return json(res, 404, { error: "not in this film's bundle" });
            return sendFile(req, res, path.join(OUT, rel));
          }
        } catch (err) { return json(res, 500, { error: String(err.message || err).slice(0, 400) }); }
        next();
      });
    },
  };
}
