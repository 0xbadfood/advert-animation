# Handover to the advert pipeline (Fable 5.1)

From advert-animation, 2026-11-13. Two front-end pages are ready for the portal (adtwist). Both run here against
recorded data, so they could be designed and tested before the portal serves them. This note covers:
- why each page exists;
- what each page sends and expects;
- what the pipeline needs to do to adopt it.

Repo: `git@github.com:0xbadfood/advert-animation`. Pages run at https://adanime.photovault.live behind the access key.

| page | file | what it is |
|---|---|---|
| Intake | `intake.html`, `src/intake/` | where a business owner says where to find them; research starts here |
| Live progress | `live.html` (emulator harness), `src/live/` | the first-run wait: estimate, six steps, finished pieces |

## Why we built the intake page (and why the portal should use it)

The user asked for it. adtwist today is the dev engine: a URL box and a notes box. That serves the team well, but it
is not what a first-time business owner should meet. Four reasons the intake had to exist before anything else:

1. **Most Indian businesses have no website.** Their storefront is Instagram and Facebook (`docs/intake-sources.md`,
   No. 1 on the user's list). A website-only form turns away the majority of the market at the door.
2. **The offer must be asked for, not inferred.** `brief.offer` is empty for most products because the site rarely
   states one. Films with a real offer and its validity convert better, and the CTA scene needs it. The user's words:
   "learn about offers, ask specifically for it".
3. **Research should be invisible.** `docs/trial-film.md`, principle 2: harvest and research (about 3 minutes) run while
   the visitor fills in the intake. The dev form only starts work after submit. The new form starts research the
   moment the first usable source is typed. The visitor then sees their own business come back ("Found it": name,
   logo, colours, their site), which is the trust moment `first-run-story.md` asks for. By the time they press "Make
   my film", step 1 of the progress page is often already done.
4. **Two more reasons:**
   - **The process film needs a real page.** A film of the exact process a user follows is planned for the landing
     page, and it can only show what the portal really serves.
   - **The progress page is now polished.** A dev form in front of it undercuts it, and the intake is the first
     impression.

### The flow

Six steps, one question per screen on a phone. The research panel sits beside the form on desktop, or above it on a
phone.

| step | asks | required |
|---|---|---|
| 1 | Instagram handle, website, Facebook page, Google Maps link | at least one |
| 2 | offer running? what, valid until, condition, where redeemed (store, website, WhatsApp/DM, app) | "what" if yes |
| 3 | country (default: work it out from the business), film language (English, Hinglish, Hindi), notes | no |
| 4 | product photos, up to 6 | no |
| 5 | role, where they heard of us, an ad they still remember (the production questions in `first-run-story.md`) | no |
| 6 | WhatsApp number or email for "your film is ready" | one of the two |

**Language switch.** A toggle (English / Hinglish) changes the form's copy. The Hinglish needs a fluent reader's pass
before launch. The progress page's status lines stay English on every run (the user's rule).

### What the page needs from the pipeline

The page talks only to `src/intake/backend.js`. The mock there replays a finished film's research on a timer. The
portal backend needs the same four calls:

1. **`start(sources)`**
   - Called once, when the first usable Instagram handle or website is in: 1.2 s after typing stops, or on Continue.
   - It creates the product and runs **research only**. Today `POST /products` in production flow submits the whole
     chain at once; the intake needs research first and the batch after the answers.
   - Returns `{ job }` for the event stream.
   - **Proposed:** `POST /products` with `flow=intake`, which runs `submit("research", ...)`.
2. **Research events.** The panel reads the same kinds the story page uses, from `GET /events/products/<slug>?since=N`:
   - `research.stage {stage, state}`;
   - `asset.landed` with `assets/` refs (desktop and mobile screenshots);
   - the brief-done event's palette and logo;
   - `research.market`;
   - `view.facts`.
   No new kinds are needed.
3. **`update(answers)`.** Called as answers change. The film language goes to `POST /products/{slug}/market` before
   the batch starts. The country is sent only as `country_override`, because research discovers it.
4. **`submit(request)`.** "Make my film". It needs to:
   - save the request (below);
   - merge the offer into `brief.offer`;
   - start `POST /products/{slug}/chain` with `start=digest`, which skips research if it is done;
   - return the progress page URL.
   **Proposed:** a single `POST /products/{slug}/intake`.

The request (a superset of today's `request.json`; `urls`, `notes`, `photos`, `name` and `market` keep their meaning):

```json
{
  "urls": ["https://tweaklogic.com"],
  "sources": {"instagram": null, "website": "https://tweaklogic.com", "facebook": null, "maps": null},
  "offer": {"what": "Free first OTA audit", "valid_until": null, "condition": null, "redeem": ["website"]},
  "market": {"language": "hinglish", "drama": 1, "country_override": ""},
  "notes": "", "photos": ["shop.jpg"], "name": "",
  "about": {"role": "owner", "heard_from": null, "remembered_ad": null},
  "contact": {"whatsapp": "+919876543210", "email": null},
  "ui_language": "en", "created": 1794554345.2
}
```

Normalisation happens in the page (`src/intake/sources.js`):
- an Instagram handle without the `@`;
- a website as a full `https://` URL;
- a Facebook page as a full URL;
- WhatsApp as E.164, with Indian 10-digit numbers getting `+91`.
Validate again on the server.

### Open on the pipeline side

- **Instagram reading.** Business Discovery needs our own Meta developer app, an Instagram business account and a
  long-lived token (`intake-sources.md`). Until then the handle is stored and research works from the website when
  there is one. With only a handle, research has nothing to read: say so in the panel, or hold the product until the
  harvest exists.
- **Photo upload.** The page holds the files (`File` objects). It needs an upload endpoint, to the product's assets as
  harvest inputs.
- **A source changed after research started.** Restart research, or add the source to it. The mock ignores the change.
- **The "film is ready" message.** Delivery over WhatsApp or email is not built.
- **Hinglish copy review** (`src/intake/copy.js`).

### A Maps link means "show people where we are"

The user's point: a customer who gives a Google Maps link wants their business located in the film. Treat
`sources.maps` as a request for a **location scene**, not only as a research source.
- **Resolve the link.** Short links (`maps.app.goo.gl`, `goo.gl/maps`) redirect to a full URL carrying the place name
  and coordinates. Read the name, address, latitude and longitude from it, or use a Places lookup if parsing fails.
  Store them on the brief, for example `brief.location {name, address, lat, lng, maps_url}`.
- **The scene.** A map that zooms to a pin with the business name and area, for example "Andheri West, Mumbai". It
  fits best near the CTA, next to the offer and where to redeem it, especially when the redeem choice is "at the
  store".
- **Map imagery licence.** Check the terms before using Google map tiles in an ad. A map drawn from OpenStreetMap data
  in the film's own style avoids the question and matches the look; it needs the "© OpenStreetMap contributors" credit.
- **Without a Maps link,** add no scene. Do not guess a location from the website.

## The live progress page

Described in `DESIGN.md` section 9. In short:
- **Header:** "Step n of 6", the time left, and a six-part rail.
- **Explainer card:** a live status line and rotating "what's happening now" lines.
- **Feed:** the finished pieces, newest first.
- **Placement:** one layout; container queries switch it between desktop and phone.
- **Catch-up:** a reload or the email link replays the log and lands on the current state, without entrances.

To adopt it, the portal's story page gives a `LiveModel` the job's events and an adapter (`src/live/model.js`).

- **Events.** It consumes the engine stream already in `story/engine.js` (`classify`).
- **NEW events.** It uses the proposed ones when they exist: `truths.progress {p}`, `direction.scene {i, seconds}`,
  `audio.line {scene, seconds}`, `render.progress {p}`. They sharpen the estimate and the status lines. Without them
  the page still works, on time-based progress.
- **Adapter.** `resolve(job, event, cb)` returns the data the trailer rule allows (see `src/live/adapter.js`, which
  serves a film bundle as URLs): screenshots, palette and logo, facts and market, hook lines, the pick's name and hook,
  scene seconds, voice samples or line files, still and clip URLs, and the ad's URL and poster.
- **Estimate.** It starts from per-stage priors in `src/live/priors.json`, regenerated by `tools/priors.py` from runs
  that recorded `events.jsonl`. The cloud profile's pictures and render figures are guesses until cloud runs exist.

## A rule for every portal page: Safari

Never rewrite a clickable element's text or children on every frame. Safari 26 drops the click when the press and
the release land on different text nodes; Play on the progress page never fired until this was fixed. Write only
when the value changes. iPhones run Safari, so this matters for the Indian market.

## How to see them

- Intake: https://adanime.photovault.live/intake.html. Add `?research=20` for a short research and `&lang=hinglish`
  for Hinglish. It replays Tweaklogic's real research; "Make my film" lands on the progress page, which plays the rest
  of that film.
- Progress: https://adanime.photovault.live/live.html, with film picker, local or cloud timing, and a desktop or phone
  frame.
