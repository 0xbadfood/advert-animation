# advert-animation: the pipeline as a live figurine film

Design note, 2026-11-12. Settled with the user over the first session. Who works on this: Claude (this repo) and
Fable 5.1, the owner of the ~/advert pipeline. The notes are written for an agent picking the work up: contracts,
commands and paths over prose. This replaces the Linkwork SVG skins in
`~/advert/advert/web/static/story/` with a polished 3D story whose **motion is fixed and owned in code** and whose
**artifact slots fill in with real pipeline output as it lands**. The ChatGPT images in this folder are mood only.
The hard rules come from `~/advert/docs` (first-run-story.md, trial-film.md, production-architecture.md).

## 1. Purpose and rules

- **Now:** the live progress page for a first run (and later runs). It loops and is interruptible. It is the story
  page the chain lands on.
- **Later, if it proves worthwhile:** the same scene in the ads (an offline render of the same source).
- **Rules carried over unchanged** (first-run-story.md):
  1. Every beat is a real event, and nothing is shown before it exists. Stretching completed work is honest.
  2. It's a trailer, not the guts. Never show truths, plan text, scene text, judge reasons, costs or model names.
  3. It's resumable. A reload replays the event log and lands on the current beat, with skipped stages compressed.
  4. Two honest lines belong to the engine, not the scene: "We chose one of the top ideas; the rest stay in your
     bin." and "After you take the film, ten more teams mine 20-25 further openings for this business."
- **What a run may show is a policy, not scene code.** trial-film.md says "the owner never sees the batch". The later
  first-run-story.md allows the hook line only. The runtime takes `policy = {hooks: line | count, pick: name | honest}`,
  and the scene is identical under both.

## 2. Timings: design for a range, not today's numbers

Measured from the recorded runs in `~/advert/out` (2026-11-11/12), and the cloud targets from
production-architecture.md:

| Engine stages | Local now | Cloud | Events during the stage |
|---|---|---|---|
| research (shown only when the story starts at digest) | 50-70 s | same | stage changes, screenshots, facts, market |
| truths | 30-75 s | same (LLM) | none, only a count at the end |
| concepts | 13-29 s | same | 8 hooks, in a burst |
| judge | about 10 s | same | 56 pairs, in a burst |
| pick | 0 s (direction starts at the same moment) | same | 1 |
| direction | 25-70 s | same (LLM) | none |
| audio | 20-32 s | same (TTS) | none |
| visuals | 110-220 s, assets 3-35 s apart | stills land within about 10-20 s in a burst; clips about 100 s until Wan or cloud video | 8-16 |
| render (with music and QA) | 140-200 s | 30-60 s on Remotion Lambda | none |

What follows from this:

- **Every stage works at two lengths.** In a short run, enter, one beat and exit take 6-8 s and still read as
  complete. In a long run, the stage stays interesting for 3-4 minutes, using loop variants that change with elapsed
  time (early, mid, late) and avoid repeating.
- **The polish goes where the cloud wait goes**: the writer (truths), the director, and the voice booth. Visuals and
  render get short, punchy choreography and a payoff.
- **Bursts fold.** When several ticks are queued at a beat boundary, the station plays one group reaction for all of
  them. The lag budget is that a stage enter may start at most 8 s after its event.
- **Minimum dwell.** The pick reveal holds for at least 4.5 s before direction may interrupt. Direction lasts over
  25 s, so the delay never shows at the end.
- **Idle loops last 2-6 s and reactions 1.5-2.5 s**, which keeps the interrupt latency to a few seconds.

### New pipeline events this asks for (small emits, no forbidden content)

| Event | Where | Why |
|---|---|---|
| `truths.progress {p}` | streamed output length / expected | the writer's bulb charges honestly through the longest blind wait |
| `direction.scene {i, seconds}` and view `story/plan.json {scenes:[{seconds}]}` | as the plan is parsed | storyboard slots light with counts and durations only |
| `audio.line {scene, seconds}` | as each scene's TTS returns | waveform segments land one by one |
| `film.stage {stage: music \| qa}` and `render.progress {p}` | render worker | the render stage gets ticks (`classify` already maps unknown `film.stage` stages to a render tick) |

The emulator already plays all of these, so their value can be judged before anyone adds them to the pipeline.

## 3. Technology

**Blender authors and Three.js plays.**

- **Blender (bpy, headless, code in this repo)** is the single source for the set, the figurines, the shared rig,
  the pose library, every action, the camera framings and the baked lighting. It exports **one glTF**: meshes,
  baked lightmaps and AO, a skeleton, named actions, and empties that mark the slots and cameras.
- **Three.js in the page** loads the glTF and plays it. A station's beat is a named action, and actions crossfade at
  beat boundaries. **Slots are live textures**: canvas-drawn cards, images and video, updated the moment their data
  lands. Bloom is a post-processing pass. The camera is framed for the page's 16:9 canvas from
  framing boxes, not fixed shots.
- **Why not pre-rendered video plates.** Live, interruptible, variable-count, instant slot updates are what a
  real-time scene does well, and video clips do badly. Gapless clip switching on mobile Safari, tens of MB of video,
  fixed aspect ratios and masks are all avoided. Figurine styling keeps the real-time look close to an offline
  render.
- **Text never goes through Blender or glTF.** Hook lines can be Devanagari. The browser's canvas shapes it, using
  Noto Sans and Noto Sans Devanagari, as Remotion already does.
- **For ads later:** render the same Blender scene offline (EEVEE), or capture the Three.js frames.

## 4. The cast: figurines

These aren't human faces. They are **lacquered figurines on round bases**, like game pieces that came alive. The role
is carried by the silhouette, the props and the colour. Faces are painted decals: dot eyes, a brow and a small mouth.
Blinks and smiles are decal swaps, and emotion comes from body language (lean, head tilt, hop, squash and stretch,
anticipation and overshoot). Our own proportions: the cast must not drift toward LEGO minifigures or Playmobil.

All seven figurines share one rig of about 12 bones: base, hop, body (2), head, two arms each with shoulder, elbow
and mitten. Every pose and action plays on every figure.

| Figure | Silhouette and colour | Prop | Stations |
|---|---|---|---|
| **Researcher** | curly hair, round glasses, white coat over blue | magnifier, laptop | research; cues the voice booth; cheers |
| **Writer** | ponytail, mustard | notebook, pen, mug | hooks; hands the pick to the director |
| **Director** | flat cap, red scarf, brown vest | pointer, megaphone, clapper | direction, visuals, assembly |
| **Crew 1-4** | purple hoodie and headphones / maroon cap / green / red beret and apron | stamp, mic, brush | judges, voices, painters, crowd |

Polish comes from the materials (lacquer clearcoat, a slight seam on the base, soft subsurface on the paint), from
lighting baked in Blender, and from the timing of the motion. The emulator's greybox figures use the same joint
layout, so the pacing work carries over.

## 5. The world: one studio, stations left to right

The pipeline is a walk through one lilac studio. The camera trucks from station to station, so the exit of one stage
is a camera move into the next.

| Station | Engine stages | Fixed motion | Slots (live) |
|---|---|---|---|
| 1 Research | arrive, research | the researcher hops in, scans the panels with the magnifier, threads pull them into the collector | site desktop, site mobile, logo, palette (5), fact card (cycling), market chip, checklist (3) |
| 2 Hooks | truths, concepts | the writer reads notes, thinks, scribbles, the bulb charges; a bubble pops per hook | notes card (facts cycling), angles count, bulb charge, hook bubbles (8) |
| 3 Review | judge, pick | three judges compare pairs, nod and stamp; one card lifts, the rest fly to the bin | idea cards (8), pairs counter, chosen card, bin count |
| 4 Direction | direction | the writer hands the card over; the director paces and points along the storyboard | selected card, storyboard slots (9) with durations |
| 5 Voice | audio | four singers at mics, the researcher conducts, the waveform sweeps | main waveform, three lanes, WAV card with duration |
| 6 Visuals | visuals | five painters at portrait easels; each canvas goes blank → sketch → painted, then flies to the gallery | easel canvases (5), gallery frames (9), poster |
| 7 Assembly | render, done | the director's wand sends inputs into the reel drum, the strip runs, the phone lights; everyone cheers | input cards, strip frames, progress ring, phone (the ad, 9:16) |

Variable counts never change the motion. Each slot group has a fixed maximum, unused slots stay dark, and overflow
cycles.

## 6. Runtime model (the engine contract, extended)

- `stages.js` keeps `~/advert`'s `STAGES`, `ORDER`, `HONEST` and `classify` verbatim, so the runtime plugs into the
  live page and the event sources unchanged.
- **Stations** give each stage `enter`, `beats {early, mid, late}`, `react(events)` and `exit`, plus a synchronous
  `apply(event)` for data.
- **Data lands at once and characters react on the beat.** `apply` runs the moment an event arrives: the slot
  updates with its own reveal (flip or pop). The figures' reaction (look, point, cheer) is queued for the next beat
  boundary and folds when several are waiting. This is what makes the canvas "updatable with pipeline progress"
  while the motion stays fixed.
- **Scheduler**: generator coroutines on a virtual clock, so the story is a pure function of
  `(scenario, seed, time)`. Scrubbing is a reset plus fast simulation, and the headless runs are deterministic.
- **Catch-up**: skipped stages play enter and exit at 0.12x duration with their data applied silently.
- **Variant choice**: by elapsed time in the stage (early under 20 s, mid under 60 s, late after that), from a
  seeded shuffle bag per stage and phase. Every beat in the pool plays once before any repeats, and never twice
  running.
- **Hurry**: when the next stage's signal arrives mid-beat, the running beat and everything it spawned finish at
  0.35x duration (`HURRY_K`), rather than being cut off or holding the stage's entrance past the lag budget. A stage
  still inside its minimum dwell (the pick) keeps its pace.
- **Long waits carry more, longer beats**, including cameos (`visit()` in `stations/common.js`): a figure from
  another station drops by (the writer with coffee, the researcher with the magnifier at the gallery, a crew member
  peeking at the phone). Beats are 3-7 s in the long stages, so a 3-minute wait plays about 35 beats over 12-16
  variants.

### Story cards (2026-11-13)

The small caption on top is replaced by an explainer card, HTML over the canvas (`src/ui/storycard.js`, copy in
`src/story/narration.js`):

- **Steps:** 8 (research, angles, opening lines, weighing, direction, voice, pictures, final cut). The pick and the
  end have cards of their own.
- **On entry**, a card slides in on the left with the step number, the title revealed word by word, a plain
  explanation and a live status from the signals (`StatusTracker`: "24 of 56 comparisons", "5 opening lines
  written", "cutting · 40%"). An 8-segment rail shows progress.
- **After about 5 s** the card settles into a compact pill in the corner, and the status keeps updating, so a long
  wait is never covered.
- **The honest lines live in the card:** the pick card carries "one of the top ideas…", and the weighing card's
  wording carries the fairness.
- **Seeking** and catch-up show the current card settled, without the entrance.
- **Placement, revised 2026-11-13** (the big card hid parts of the set): the layout is fixed per station, so each
  station names its card spots, chosen by eye from its framing (`cards: { full, strip }` in the station; a spot name
  `tl tc tr ml mr bl bc br` or an explicit `{x, y}`). The big card is narrower and holds about 4 s, then collapses into
  the strip, which slides to its own spot. `world.freeSpot()` (projected panels and figures, scored per candidate)
  is the fallback for a station without chosen spots.
- **English only.** Cards and status lines stay in English on every run, Hinglish included (the user, 2026-11-13).
  Only the artifacts themselves (hook lines, names) carry the run's language.

## 7. The emulator (the deliverable's shape)

The page (settled with the user, 2026-11-12):

- **The canvas on top**, 16:9. It is a desktop tool: phones are out of scope (settled 2026-11-12); if a phone
  experience is ever wanted, it would be an app, not this page.
- **Controls below it.** One card per stage, each with its **length** and its **artifacts**:
  - research: site and phone screenshots, logo, brand colours, facts, market;
  - angles: the count;
  - opening lines: the hook lines and how they arrive;
  - weighing: pairs, which idea is chosen, its name;
  - direction: scene lengths;
  - voice: length;
  - pictures: counts, clips, arrival pattern, uploaded stills;
  - final cut: an uploaded ad video.

  Empty fields fall back to generated dummies, and Hinglish dummies when the run is Hinglish. A Run card sets the
  start point, language, the policy (hook lines shown or numbered, idea name or "one of the top ideas"), the proposed
  new signals, and an optional failure with or without a retry.
- **Play.** The emulator turns the settings into the pipeline's signals (the exact kinds, data and refs of
  `~/advert/advert/progress.py`) and sends each one to the canvas at its time, at any speed. The canvas is a
  `StoryPlayer` that only receives signals (`feed`) and pulls the artifact behind each through a data adapter. The
  live page will drive the same player from the real event stream with a fetch adapter.
- **A timeline** shows the pipeline's stages over the story's stages and the signals, and a click seeks.
- **Checks**: stage-enter lag against 8 s, stages on screen under 3 s, a beat repeated more than 6 times in a stage,
  reactions folded, text cut in a slot.
- **Presets** in `scenarios/` (local-typical, local-today, cloud-fast, cloud-clips, trial-from-batch, hinglish-slow,
  fail-retry-visuals, fail-final). Any configuration can be copied out as scenario JSON.
- `tools/smoke.py` plays every preset headless and prints the checks (exit 1 on lag, short, repeat or overflow, or a
  page error). These are the regression tests for any change to the motion.

**Revised the same day (the user): real films, durations only.** The artifact controls are gone. The page picks a
finished ~/advert film; `tools/bundle.py` serves it as a story bundle that carries only what the story may show (the
rules are enforced server-side), with its recorded stage timing where an event log exists. One slider per stage
scales that timing (x0.25 to x4; the GB10 medians where there is no recording), and "Cloud timing" sets pictures and
final cut to the cloud targets. Ticks keep their recorded positions inside a stage when it is squeezed. The canvas
fetches through a data adapter of the live shape. Everything is behind an access key (advert's scheme). Films that cannot carry the whole story (no site screenshots,
fewer than 3 stills or voice lines, an idea without a spoken line or name, no fact cards) stay out of the picker. The
flow ends as beat 12 of first-run-story.md: after the celebration the finished ad opens in a modal (play with sound,
download, watch the story again).

Findings so far (greybox, 2026-11-12):

- **Pick and direction share a timestamp.** The pick was being compressed away, so a must-see stage (one with a
  minimum dwell) now plays in full while its signal is under 8 s old.
- **The dwell counts from the start of the entrance.** Direction now enters about 6.6 s after its signal, inside
  the budget.
- **Long local stages** (visuals, render at 2-3 min) repeated their beats up to 20 times. Fixed with the shuffle
  bag, 8-10 more beats each (cameos included) and the hurry. Every preset and the six films tried (including
  4fd59e8014, whose retried direction ran 6 minutes) pass with no warnings.

## 8. Build order

1. **Emulator plus greybox.** *(Built 2026-11-12.)* All seven stations, the beats, reactions, group reactions and
   camera moves, primitive figurines, and the page above. Next comes pacing: more late-phase variants for the long
   local stages.
2. **Blender spike on the GB10:** headless runs, a lightmap bake, glTF export into this runtime. *(Done 2026-11-13:
   Ubuntu Blender 4.0.2, CPU bakes, GLB with skeleton, clips and baked AO plays in Three.js. Findings and gotchas
   in `blender/NOTES.md`.)*
3. **Figurine kit in bpy:** the shared rig, the pose library, then the three leads, then four crew members built
   from their parts. *(Done 2026-11-13: `blender/kit.py` + `blender/cast.py` build all seven in ~7 s; the runtime
   uses them when `public/models/cast/*.glb` load, else the greybox. Joints are axis-free pivots, so every beat plays
   unchanged. Open: the cast is about 4.6 MB (compress), and the figurines read small in the station framings.)*
4. **The final set and look**, station by station, each checked against every scenario. *(First pass done
   2026-11-13.)*
   - Cards are layered: a thick lacquered card with rounded edges on the station's accent backing. Floating panels
     drift, and a reveal pops the card out toward the camera, turns it over and settles it back.
   - Each station has a theme (`src/world/themes.js`): its own wall, rug and accent, with white pillars between
     stations and a sky that blends as the camera trucks.
   - Set dressing comes from `blender/set.py` (`public/models/set.glb`, one group per station: shelves, globe, string
     lights, cork board, round window, trophy, spotlights, posters, foam, ON AIR, canvases, jars, curtains, marquee
     bulbs, plants).
   - Bloom touches only pixels brighter than white, with neutral tone mapping, so cards keep their colours.
   - Framing is tightened (`ZOOM` 0.85).
   - Station props (`blender/props.py` -> `public/models/props.glb`, 12 templates) replace the runtime primitives:
     panel stands, easels, the collector, the side table, the judges' board and round table, the idea vault, the
     storyboard legs, the director's chair, mic stands, the reel drum and its plinth, the phone. Each station keeps
     its primitive as the fallback (`world.prop()` returns null when props are not loaded).
   - A soft studio reflection map (RoomEnvironment, intensity 0.14) so metal and lacquer read.
   - Model size, settled 2026-11-13: lossless only. Caddy compresses `model/gltf-binary` (zstd, gzip fallback): the
     cast, set and props go from 6.16 MB to 1.85 MB with zstd and 2.43 MB with gzip. Measured and not adopted (the
     user: "2 MB without loss is not a lot"): meshopt (0.53 MB over the wire, lossy quantisation, 20 KB decoder) and
     Draco (0.88 MB, 300 KB decoder). Still to do on the production page: hashed filenames with long cache headers,
     and preloading during the intake form.
5. **The new pipeline events in `~/advert`**, where the emulator shows the blind waits hurt.
6. **Wire into the story page** as the default renderer behind the existing `LiveSource`.

## 9. The live page: estimate, steps, finished pieces (2026-11-13)

Close-circle feedback on the studio:
- Users want a general estimate of how long the run takes.
- They want a more professional look.
- For an Indian audience a phone interface is a must; an estimate plus finished pieces sliding in can stand in for
  the animation.

The user's decision: one professional page that works on both desktop and phone. It has explainer cards, the
estimate, "step 3 of 6", and room for the incoming pieces. Only the placement changes between the two. This page is
now the primary progress view. The 3D studio stays as an optional desktop view and as ad material.

**Page:** `/live.html` (the emulator harness), with code in `src/live/`.
- **Header:** "Step n of 6", the time left, and a six-part rail. The current part fills with the step's progress.
- **Explainer card:** the step's title, a plain explanation, the live status line (the studio's `StatusTracker`), and
  a rotating "what's happening now" line that keeps a long step alive. The rotating lines say what the step does,
  never what it found.
- **Feed:** the finished pieces, newest first. Each one enters once and then updates in place: site captures, brand
  colours and logo, facts and market, angle count, opening lines, comparisons, the chosen idea with the honest line,
  the scene strip, voice waveforms, pictures, the film.
- **Placement:** container queries, so the emulator's phone frame previews the phone layout. Under 860 px: a sticky
  thin header, then the card, then the feed. Wider: the card stays in view on the left and the feed fills the right.
- **Tab title:** carries the step and the time left. It is the first of the come-back cues.

**Six steps** (`steps.js`). They group the engine stages and change nothing in the engine contract:

| # | Step | Engine stages |
|---|---|---|
| 1 | Getting to know your business | arrive, research |
| 2 | Finding ideas | truths, concepts |
| 3 | Choosing one idea | judge, pick |
| 4 | Planning the scenes | direction |
| 5 | Voice and pictures | audio, visuals |
| 6 | Cutting your film | render |

**Estimate** (`estimate.js`, priors in `priors.json` from `tools/priors.py`):
- **Priors:** each stage has a median (mid) and a long-but-normal length (hi, the 80th percentile and at least 1.25 x
  the median), measured from every run that recorded its events. Today that is 14 runs.
- **Remaining time:** what is left of the current stage, plus the later stages.
- **Current stage:** comes from its prior. It is refined by the stage's own reported progress (comparisons, voice
  lines, truths and render percent): elapsed x (1-f)/f, weighted by f.
- **Pictures have no progress fraction:** moving clips follow the stills in unknown numbers, so a picture count would
  claim the stage nearly done too early.
- **The shown number never jumps:**
  - It counts down with the clock.
  - It follows a lower target quickly.
  - It rises at most 0.25 s per second.
  - A range shows when the spread is a minute or more.
  - "Taking a little longer than usual" shows once the stage passes its hi.
- **Cloud profile:** local numbers, except pictures (75/110 s) and render (40/55 s). These are guesses until cloud
  runs exist.
- **Measured against the films** (`window.__trace()`):
  - Normal runs: within about 20–70 s locally and 35 s on cloud, inside the shown range throughout.
  - An outlier run (6 min of direction) is underestimated, and shows the slow note.

**Model and view.**
- `model.js` reduces events into state. It is DOM-free and driven by `feed(job, e, t)` and `tick(t)`.
- `view.js` draws it. `catchup` replays a log without entrances, for a reload or the email link (principle 5).
- **Retries:** a retry drops the pieces of the attempt that failed.
- **Failures:** a failure never moves the step forward, and it tints the status.
- `adapter.js` serves a film bundle as URLs, with nothing preloaded. Voice waveforms are decoded offline, and a
  plausible one is drawn until they are ready. The portal's adapter must have the same `resolve(job, e, cb)` shape.

**Safari rule (found 2026-11-13):** never rewrite a clickable element's text on every frame. Safari 26 drops the
click when the press and the release land on different text nodes, so Play never fired. Write only on change (the
`text()` and `setText()` helpers). The emulator's `?debug=1` shows the loop's numbers and the element each press
lands on.

**Open:**
- A notification when the film is done (needs permission).
- An email-link landing.
- The intro before the first event (it shows "Usually about 9 min").
- Whether to show a voice preview (the rules allow a waveform only).
- The copy for a failed run, which is the pipeline owner's call.

## 10. The intake page (2026-11-13)

adtwist's form is the dev engine (a URL and notes), so the user asked for a polished intake before the process film.
The film shows the exact process a user follows, starting here.

**The page** (`intake.html`, `src/intake/`):
- Six steps: sources (Instagram first), offer, audience and language, photos, about you, where to send the film.
- Research starts on the first usable source. A side panel shows the business coming back while the rest is
  answered: their site, name, logo, colours, facts.
- An English/Hinglish switch changes the copy.

**The mock.** It replays a finished film's real research: Tweaklogic, 17d6c3a8ff, the film planned for the process
film. "Make my film" lands on the progress page after research.

**Contract and reasons for the pipeline:** `HANDOVER.md`.
