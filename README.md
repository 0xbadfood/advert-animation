# advert-animation

The live story for the advert pipeline: a figurine studio that plays the pipeline's progress as it happens, with
fixed, code-owned motion and slots that fill with the run's real artifacts. Design: `DESIGN.md`.

```bash
source ~/.nvm/nvm.sh && npm install
npm run dev                                   # the emulator on http://localhost:5190
~/advert/.venv/bin/python tools/smoke.py      # every preset headless: the checks, exit 1 on a problem
~/advert/.venv/bin/python tools/smoke.py --only cloud-fast --shots 0.1,0.5,0.97   # plus screenshots in out/smoke/
blender -b --factory-startup -P blender/cast.py -- --out public/models/cast      # rebuild the seven figurines (~7 s)
```

Pages: `/` the emulator (`?greybox=1` for the primitive figures), `/cast.html` the cast lineup cycling the pose
library (`?pose=<name>` holds one), `/spike.html` the Blender spike. Blender notes: `blender/NOTES.md`.

| path | what |
|---|---|
| `src/story/` | the runtime: `stages.js` (the engine contract from ~/advert, verbatim), `runner.js` (coroutines on a story clock), `director.js` (stage loop, beats, reactions, dwell, catch-up), `player.js` (the canvas: receives signals) |
| `src/world/` | Three.js studio, figurines (greybox, the Blender rig's joint layout), slots (live canvas textures), painters |
| `src/stations/` | the seven stations: their set, slots, figures, and per stage `enter`, `beats`, `react`, `exit`, `apply` |
| `src/emulator/` | the source: scenario → signals (`synth.js`), dummy and uploaded artifacts (`dummy.js`), checks (`metrics.js`) |
| `scenarios/` | dummy presets from the measured timings (offline, for the smoke tests) |
| `server/api.js` | Vite plugin: the access key (`.api_key`, or ADANIME_API_KEY; /login sets a cookie; scripts send `X-API-Key`), `/api/films`, `/api/films/<id>`, `/files/<id>/<path>` (whitelisted) |
| `tools/bundle.py` | a finished ~/advert film as a story bundle: only what the story may show (hook lines, pick name, counts, seconds, screenshots, colours, fact cards via advert's `story_facts`, stills, voice, the ad), plus its recorded stage timing |
| URL | `?film=<id>&speed=<n>&at=<s>&play=1`; `?scenario=<preset>` for the dummies; `&auto=1` simulates to the end and sets `window.__report` |

The page: pick a finished film, drag a slider per stage (x0.25 to x4 of the film's recorded timing, or the GB10 medians
where it has none; "Cloud timing" sets pictures and final cut to the cloud targets), Play. `tools/smoke.py --film <id>`
checks a real film headless. Only complete films are listed (`tools/bundle.py --gaps` says why a film is in or out),
and 4 s after "Your film is ready" the finished ad opens in a modal (play, download, watch the story again).

## Served

User service `advert-animation` (`deploy/advert-animation.service`, the Vite dev server on :5190, so edits go live
without a deploy), reached as https://adanime.photovault.live through Caddy on the VPN master (10.8.0.1 →
10.8.0.4:5190; the site block is at the end of /etc/caddy/Caddyfile there, with a backup taken before the change).

```bash
systemctl --user status advert-animation        # restart after changing vite.config.js or package.json
journalctl --user -u advert-animation -f
```
