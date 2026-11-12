import { makeFigure, props } from "../world/cast.js";
import { panel, easel, flash } from "./common.js";

// Station 6, visuals. Locally 110-220 s with a picture every 3-35 s; in the cloud the stills land in a 10-20 s burst.
// Each picture goes blank -> sketch -> painted on the next easel (its own little sequence the moment it lands), then
// takes its place in the gallery above. Painters react on the beat; a burst folds into one wave of cheers.
export const EASELS = 4, GALLERY = 9;

export function build(world, X) {
  world.rug(X, 5.0);
  const EX = [-2.7, -0.9, 0.9, 2.7];
  const canvases = EX.map((dx, i) => { easel(world, X + dx, -0.55, 0, 2.0); return panel(world, "easel_" + i, { x: X + dx, y: 1.45, z: -0.48, w: 0.8, h: 1.42, kind: "image", placeholder: "", px: 360, frameColor: 0xfffdf8 }); });
  const gallery = [];
  for (let i = 0; i < GALLERY; i++) {
    const a = (i / (GALLERY - 1)) * 2 - 1;
    gallery.push(panel(world, "gallery_" + i, { x: X + a * 3.9, y: 3.55 + (1 - a * a) * 0.35, z: -1.9, w: 0.62, h: 1.1, rotY: -a * 0.2, kind: "image", placeholder: String(i + 1), px: 240 }));
  }
  const poster = panel(world, "poster", { x: X + 4.6, y: 1.9, z: -1.2, w: 0.9, h: 1.4, rotY: -0.45, kind: "image", placeholder: "poster" });

  const P = ["crew1", "crew2", "crew3", "crew4"].map((r, i) => makeFigure(world, r, X - 7 - i * 0.6, 0.6, Math.PI / 2));
  P.forEach((p) => p.hold(props.brush(), "R"));
  const D = makeFigure(world, "director", X - 7.5, 1.3, Math.PI / 2);
  D.hold(props.megaphone(), "L");
  const SPOT = EX.map((dx) => [X + dx + 0.55, 0.35]);
  let landed = 0;

  function* paintStroke(p, dur = 1.6) { yield* p.pose("paint", 0.35); yield* p.wiggle("sR", 0.22, 3, dur); yield* p.pose("stand", 0.3); }

  const station = {
    name: "visuals", x: X, framing: { x: X, y: 2.1, z: -0.6, w: 10.6, h: 5.1, tw: 4.6, th: 7.4 },
    stages: {
      visuals: {
        *enter(ctx) {
          yield* ctx.V.all(...P.map((p, i) => (function* () { yield i * 0.12; yield* p.hopTo(SPOT[i][0], SPOT[i][1], { faceYaw: -0.75 }); })()), D.hopTo(X - 4.4, 1.2, { faceYaw: 0.5 }));
          yield* D.pose("pointL", 0.35); yield* D.bounce(0.1, 0.4); yield* D.pose("stand", 0.3);
        },
        phases: { early: ["paintAll", "shout", "stepBack"], mid: ["paintAll", "stepBack", "shout", "admire"], late: ["admire", "paintAll", "stepBack", "shout", "stretch"] },
        beats: {
          *paintAll(ctx) { yield* ctx.V.all(...P.map((p, i) => (function* () { yield i * 0.15; yield* paintStroke(p, 1.4 + (i % 2) * 0.4); })())); },
          *shout(ctx) { yield* D.pose("conduct", 0.3); yield* ctx.V.all(D.bounce(0.1, 0.4), D.wiggle("headNod", 0.1, 2, 0.8)); yield* D.pose("stand", 0.3); },
          *stepBack(ctx) { const i = Math.floor(ctx.rng() * P.length), p = P[i]; yield* p.hopTo(SPOT[i][0] + 0.2, 1.1, { faceYaw: Math.PI * 0.9 }); yield* p.pose("think", 0.35); yield 0.7; yield* p.hopTo(SPOT[i][0], SPOT[i][1], { faceYaw: -0.75 }); yield* p.pose("stand", 0.25); },
          *admire(ctx) { yield* ctx.V.all(...P.map((p) => p.pose("lookUp", 0.45)), D.pose("lookUp", 0.45)); yield 0.9; yield* ctx.V.all(...P.map((p) => p.pose("stand", 0.4)), D.pose("stand", 0.4)); },
          *stretch(ctx) { const p = ctx.rng.pick(P); yield* p.pose("cheer", 0.45); yield 0.3; yield* p.pose("stand", 0.4); },
        },
        *react(ctx, evs) {
          const many = evs.length > 1;
          yield* ctx.V.all(...P.map((p, i) => (function* () { yield i * (many ? 0.1 : 0.04); yield* p.pose(many ? "cheer" : "thumbs", 0.3); yield* p.bounce(many ? 0.15 : 0.06, 0.4); yield* p.pose("stand", 0.3); })()), D.pose("pointL", 0.3));
          yield* D.pose("stand", 0.3);
        },
      },
    },
    apply(ctx, stage, e, c) {
      const d = e.data || {};
      if (e.kind === "film.stage" && d.stage === "visuals" && d.state === "running") { landed = 0; ctx.data.stills = []; }
      if (e.kind !== "asset.landed" || !c.image) return;
      if (c.kind === "poster") { poster.set({ image: c.image }, { kind: "image" }); return; }
      if (c.kind === "background") return;                       // the brand backdrop is not a picture of the film
      if (c.kind === "clip") {
        const g = gallery[(c.scene ?? 0) % GALLERY];
        g.set({ image: c.image, play: true }, { kind: "image", reveal: "flip" });
        return;
      }
      // a still: the next easel runs blank -> sketch -> painted, then the gallery frame for its index fills
      const n = landed++, ea = canvases[n % EASELS], gi = (c.index ?? n) % GALLERY, img = c.image;
      ctx.data.stills[c.index ?? n] = img;
      if (world.silent) { ea.set({ image: img }, { kind: "image", reveal: "none" }); gallery[gi].set({ image: img }, { kind: "image", reveal: "none" }); return; }
      ctx.V.spawn((function* () {
        ea.set({}, { kind: "placeholder", reveal: "flip" });
        yield 0.5; ea.set({ image: img, filter: "grayscale(1) contrast(2.2) brightness(1.5)" }, { kind: "image", reveal: "none" });
        yield 0.7; ea.set({ image: img, filter: "saturate(0.6) brightness(1.15)" }, { kind: "image", reveal: "none" });
        yield 0.5; ea.set({ image: img }, { kind: "image", reveal: "none" });
        yield* flash(world, ea, 0x2bb673, 0.5);
        gallery[gi].set({ image: img }, { kind: "image", reveal: "pop" });
      })(), { k: 1 });
    },
    *retry(ctx) { yield* ctx.V.all(...P.map((p) => p.pose("shrug", 0.4))); yield 0.8; yield* ctx.V.all(...P.map((p) => p.pose("stand", 0.4))); },
    *fail(ctx) { yield* ctx.V.all(...P.map((p) => p.pose("sad", 0.8))); },
  };
  return station;
}
