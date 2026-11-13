// The intake page talks to the pipeline through this object. Two implementations with one shape:
//
//   start(sources)   the first usable source is in: create the product and begin research; resolves { job }
//   update(answers)  later answers as they are given (the pipeline may use the market before its digest)
//   submit(request)  "Make my film": the full request; resolves { next } (the progress page's URL)
//   onEvent(cb)      research events for the panel, cb(job, event, data) with data already resolved
//
// mockBackend replays a finished film's research (its real screenshots, colours, logo, facts) on a timer, so the page
// can be built and filmed before the portal serves it. The portal's backend is specified in HANDOVER.md.
import { synthesize } from "../emulator/synth.js";
import { realSource } from "../emulator/real.js";
import { scenarioFor, baseFor } from "../emulator/timing.js";
import { bundleAdapter, fetchBundle } from "../live/adapter.js";

const PRESET = Object.values(import.meta.glob("../../scenarios/local-typical.json", { eager: true, import: "default" }))[0];

export function mockBackend({ film, research = 72, speed = 1 } = {}) {
  let cb = () => {}, bundle = null, timers = [], started = null, request = {};
  const ready = fetchBundle(film).then((b) => (bundle = b));
  return {
    onEvent(f) { cb = f; },
    async start(sources) {
      await ready;
      if (started) return started;
      const { base } = baseFor(bundle);
      base.research = research;
      const sc = scenarioFor(PRESET, bundle, base, Object.fromEntries(Object.keys(base).map((k) => [k, 1])));
      // the product's own events up to the end of research: what the panel shows while the form is filled in
      const evs = synthesize(sc, realSource({ bundle })).filter((e) => e.job === "products/demo" && e.t <= research + 0.01 && e.kind !== "chain.step" || (e.kind === "chain.step" && e.data.step === "research"));
      const adapter = bundleAdapter(bundle);
      const job = `products/${bundle.product}`;
      for (const e of evs) timers.push(setTimeout(() => adapter.resolve(job, e, (data) => cb(job, e, data || {}, bundle)), (e.t / speed) * 1000));
      started = { job, product: bundle.product_name, sources };
      return started;
    },
    update(answers) { Object.assign(request, answers); },
    async submit(req) {
      request = req; console.info("intake request (mock):", req);
      const end = research + 1;                        // the progress page picks up after research, as the portal would
      return { next: `/live.html?film=${encodeURIComponent(film)}&at=${end}&play=1&speed=1` };
    },
    stop() { timers.forEach(clearTimeout); timers = []; },
  };
}
