import { makeFigure, props } from "../world/cast.js";
import { panel, easel, flash, visit } from "./common.js";

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
  // cameos for the long wait: the writer brings coffee, the researcher checks the gallery
  const WHOME = [X - 7.5, 1.6], RHOME = [X + 7.5, 1.4];
  const Wc = makeFigure(world, "writer", WHOME[0], WHOME[1], Math.PI / 2); const mug = Wc.hold(props.mug(), "R"); mug.position.set(0, -0.06, 0.06);
  const Rc = makeFigure(world, "researcher", RHOME[0], RHOME[1], -Math.PI / 2); Rc.hold(props.magnifier(), "R");
  const DMARK = [X - 4.4, 1.2];
  let landed = 0;

  function* paintStroke(p, dur = 1.6) { yield* p.pose("paint", 0.35); yield* p.wiggle("sR", 0.22, 3, dur); yield* p.pose("stand", 0.3); }

  const station = {
    name: "visuals", x: X, framing: { x: X, y: 2.1, z: -0.6, w: 10.6, h: 5.1 },
    stages: {
      visuals: {
        *enter(ctx) {
          yield* ctx.V.all(...P.map((p, i) => (function* () { yield i * 0.12; yield* p.hopTo(SPOT[i][0], SPOT[i][1], { faceYaw: -0.75 }); })()), D.hopTo(DMARK[0], DMARK[1], { faceYaw: 0.5 }));
          yield* D.pose("pointL", 0.35); yield* D.bounce(0.1, 0.4); yield* D.pose("stand", 0.3);
        },
        phases: {
          early: ["paintAll", "shout", "stepBack", "focus"],
          mid: ["paintAll", "stepBack", "shout", "admire", "inspect0", "inspect1", "focus", "brushes", "wave"],
          late: ["admire", "paintAll", "stepBack", "shout", "stretch", "inspect0", "inspect1", "inspect2", "inspect3", "swap", "coffee", "magnify", "brushes", "focus", "wave"],
        },
        beats: {
          // the director walks the line, one easel at a time
          ...Object.fromEntries([0, 1, 2, 3].map((i) => ["inspect" + i, function* (ctx) {
            yield* D.hopTo(X + EX[i] - 0.15, 1.15, { faceYaw: Math.PI * 0.85 });
            yield* D.pose("think", 0.4); yield* D.wiggle("headTilt", 0.14, 1, 1.4);
            yield* ctx.V.all(D.pose("thumbs", 0.3), P[i].bounce(0.08, 0.4), flash(world, canvases[i], 0xffc857, 0.6));
            yield 0.3; yield* D.pose("stand", 0.25);
            yield* D.hopTo(DMARK[0], DMARK[1], { faceYaw: 0.5 });
          }])),
          *swap(ctx) {
            const [a, b] = ctx.rng() < 0.5 ? [0, 1] : [2, 3];
            yield* ctx.V.all(P[a].hopTo(SPOT[b][0], 0.9, { faceYaw: 0 }), P[b].hopTo(SPOT[a][0], 0.9, { faceYaw: 0 }));
            yield* ctx.V.all(P[a].pose("shrug", 0.3), P[b].pose("shrug", 0.3)); yield 0.4;
            yield* ctx.V.all(P[a].hopTo(SPOT[a][0], SPOT[a][1], { faceYaw: -0.75 }), P[b].hopTo(SPOT[b][0], SPOT[b][1], { faceYaw: -0.75 }));
            yield* ctx.V.all(P[a].pose("stand", 0.25), P[b].pose("stand", 0.25));
          },
          *coffee(ctx) {
            yield* visit(Wc, WHOME, [DMARK[0] - 0.75, DMARK[1] + 0.2], function* () {
              yield* ctx.V.all(Wc.pose("offer", 0.35), D.turnTo(-1.0, 0.3));
              yield 0.4; mug.visible = false; yield* D.pose("hold", 0.3); yield* D.bounce(0.06, 0.4); yield 0.5;
              yield* ctx.V.all(D.pose("stand", 0.3), D.turnTo(0.5, 0.3), Wc.pose("wave", 0.3)); mug.visible = true;
            }, 0.9);
          },
          *magnify(ctx) {
            yield* visit(Rc, RHOME, [X + 1.6, 1.3], function* () {
              yield* Rc.pose("point", 0.35); Rc.j.headNod = -0.4;
              yield* Rc.wiggle("headTurn", 0.5, 1, 2.2); yield* Rc.pose("thumbs", 0.3); yield 0.4;
            }, 0);
          },
          *brushes(ctx) { yield* ctx.V.all(...P.map((p) => p.turnTo(0, 0.3))); yield* ctx.V.all(...P.map((p, i) => (function* () { yield i * 0.1; yield* p.pose("hold", 0.3); yield* p.wiggle("eR", 0.4, 4, 1.4); })())); yield* ctx.V.all(...P.map((p) => p.pose("stand", 0.3)), ...P.map((p) => p.turnTo(-0.75, 0.3))); },
          *focus(ctx) { yield* ctx.V.all(...P.map((p, i) => (function* () { yield i * 0.3; yield* p.pose("paint", 0.4); yield* p.wiggle("sR", 0.12, 4, 3.6); yield* p.pose("stand", 0.4); })())); },
          *wave(ctx) { const p = ctx.rng.pick(P); yield* p.turnTo(0, 0.3); yield* p.pose("wave", 0.35); yield* p.wiggle("rR", 0.25, 2, 1.0); yield* p.pose("stand", 0.3); yield* p.turnTo(-0.75, 0.3); },
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
