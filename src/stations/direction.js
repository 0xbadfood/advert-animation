import * as THREE from "three";
import { makeFigure, props } from "../world/cast.js";
import { panel, easel, flash, v3, visit } from "./common.js";

// Station 4, direction. A blind LLM wait of 25-70 s. The writer hands the chosen card to the director, who paces the
// storyboard. Frames light only with counts and durations (direction.scene / plan view): never scene text.
export function build(world, X) {
  world.rug(X, 4.8);
  // the storyboard on a wide easel
  if (!world.prop("storyboard_legs", X + 0.7, 0, -1.75)) for (const dx of [-2.4, 2.4]) world.box(0.08, 2.6, 0.08, 0xc79a6b, X + 0.7 + dx, 1.3, -1.75);
  const board = panel(world, "storyboard", { x: X + 0.7, y: 2.5, z: -1.65, w: 5.4, h: 1.95, kind: "storyboard", placeholder: "storyboard", px: 900 });
  const selected = panel(world, "selected", { x: X - 3.1, y: 2.2, z: -0.7, w: 1.6, h: 0.9, rotY: 0.35, kind: "card", placeholder: "selected idea" });
  easel(world, X - 3.1, -0.85, 0.35, 1.9);
  // the director's chair
  const ch = new THREE.Group(); ch.position.set(X - 4.0, 0, 1.0); ch.rotation.y = 0.6; world.scene.add(ch);
  if (!world.prop("director_chair", 0, 0, 0, 0, ch)) {
    world.box(0.6, 0.05, 0.5, 0x26214a, 0, 0.55, 0, ch); world.box(0.6, 0.35, 0.04, 0x26214a, 0, 0.85, -0.24, ch);
    for (const sx of [-0.27, 0.27]) for (const sz of [-0.2, 0.2]) world.box(0.04, 0.55, 0.04, 0xc79a6b, sx, 0.275, sz, ch);
  }

  // generic doodles for lit frames (not derived from any scene: honest before the stills exist)
  const doodles = [];
  for (let i = 0; i < 9; i++) {
    const c = document.createElement("canvas"); c.width = 160; c.height = 110; const g = c.getContext("2d");
    g.strokeStyle = "#9b8fd6"; g.lineWidth = 3; g.lineCap = "round";
    g.beginPath(); g.moveTo(8, 80 + (i % 3) * 6); g.bezierCurveTo(50, 60 + i * 2, 100, 95, 152, 70 - (i % 4) * 5); g.stroke();
    g.beginPath(); g.arc(40 + (i * 13) % 80, 35, 10 + (i % 3) * 3, 0, Math.PI * 2); g.stroke();
    if (i % 2) { g.beginPath(); g.moveTo(110, 82); g.lineTo(110, 50); g.arc(110, 44, 6, 0, Math.PI * 2); g.stroke(); }
    doodles.push(c);
  }

  const D = makeFigure(world, "director", X + 6.5, 0.6, -Math.PI / 2);
  D.hold(props.pointer(), "R");
  const Wr = makeFigure(world, "writer", X - 7, 0.9, Math.PI / 2);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshStandardMaterial({ color: 0x2bb673, emissive: 0x2bb673, emissiveIntensity: 0.4 }));
  card.position.set(0, -0.05, 0.12); card.rotation.x = -Math.PI / 2.4; Wr.hold(card, "R"); card.visible = false;
  const MARK = [X - 0.6, 0.6];
  const WSPOT = [X - 2.7, 0.2];                     // where the writer stands once the card is handed over
  const book = Wr.hold(props.notebook(), "L"); book.visible = false;
  const CHOME = [X + 7.5, 1.4];
  const Cc = makeFigure(world, "crew3", CHOME[0], CHOME[1], -Math.PI / 2); const mug = Cc.hold(props.mug(), "R"); mug.position.set(0, -0.06, 0.06);

  function paintBoard(ctx, reveal = "none") {
    const sc = ctx.data.scenes.filter(Boolean);
    const total = sc.reduce((a, s) => a + (s.seconds || 0), 0);
    board.set({ scenes: sc, lit: sc.length, sketches: doodles, label: sc.length ? `${sc.length} scenes · ${Math.round(total)} s` : "" }, { kind: "storyboard", reveal });
  }

  const station = {
    name: "direction", x: X, framing: { x: X + 0.2, y: 2.0, z: -0.6, w: 10.2, h: 5.0 },
    stages: {
      direction: {
        *enter(ctx) {
          const V = ctx.V;
          selected.clear();
          yield* V.all(D.hopTo(MARK[0] + 0.9, MARK[1], { faceYaw: -0.6 }), (function* () { card.visible = true; yield* Wr.hopTo(X - 1.6, 0.9, { faceYaw: 0.7 }); })());
          yield* Wr.pose("offer", 0.35); yield 0.2;
          card.visible = false;
          const fly = new THREE.Mesh(card.geometry, card.material); fly.position.set(X - 1.3, 1.1, 1.0); world.scene.add(fly);
          yield* world.fly(fly, v3(X - 3.1, 2.2, -0.6), { dur: 0.7, arc: 0.7 });
          selected.set(ctx.pickCard(ctx.data.pick), { kind: "card", reveal: "pop" });
          yield* V.all(Wr.pose("stand", 0.3), D.pose("point", 0.35), D.turnTo(0.3, 0.3));
          yield* Wr.hopTo(WSPOT[0], WSPOT[1], { faceYaw: 0.5 });
          yield* D.pose("stand", 0.3);
        },
        phases: {
          early: ["pointAlong", "think", "confer", "frame", "writerNotes"],
          mid: ["pace", "pointAlong", "confer", "think", "clap", "walk0", "walk1", "walk2", "frame", "writerNotes"],
          late: ["pace", "clap", "stretch", "confer", "pointAlong", "walk0", "walk1", "walk2", "frame", "writerNotes", "coffee", "think"],
        },
        beats: {
          // the director walks the board, one third at a time, and studies it
          ...Object.fromEntries([0, 1, 2].map((i) => ["walk" + i, function* (ctx) {
            yield* D.hopTo(X - 1.0 + i * 1.8, 0.2, { faceYaw: Math.PI * 0.9 });
            yield* D.pose("think", 0.35); yield* D.wiggle("headTurn", 0.25, 1, 1.6);
            yield* ctx.V.all(D.pose("point", 0.3), flash(world, board, 0xffc857, 0.5)); yield 0.2;
            yield* D.pose("stand", 0.25); yield* D.hopTo(MARK[0] + 0.9, MARK[1], { faceYaw: 0 });
          }])),
          *frame(ctx) { yield* D.pose("offer", 0.35); D.j.eL = D.j.eR = 1.4; D.j.headTilt = 0.2; yield 0.3; yield* D.wiggle("headTurn", 0.3, 1, 1.4); yield* D.pose("stand", 0.35); },
          *writerNotes(ctx) { book.visible = true; yield* Wr.pose("read", 0.4); yield* Wr.wiggle("headNod", 0.1, 2, 2.0); yield* ctx.V.all(Wr.pose("stand", 0.3), D.turnTo(-0.8, 0.3)); book.visible = false; yield* D.turnTo(0, 0.3); },
          *coffee(ctx) {
            yield* visit(Cc, CHOME, [MARK[0] + 1.7, MARK[1] + 0.3], function* () {
              yield* ctx.V.all(Cc.pose("offer", 0.35), D.turnTo(1.0, 0.3));
              yield 0.4; mug.visible = false; yield* D.pose("hold", 0.3); yield* D.bounce(0.06, 0.4); yield 0.4;
              yield* ctx.V.all(D.pose("stand", 0.3), D.turnTo(0, 0.3), Cc.pose("wave", 0.3)); mug.visible = true;
            }, -0.9);
          },
          *pointAlong(ctx) {
            yield* ctx.V.all(D.turnTo(Math.PI * 0.85, 0.35), D.pose("point", 0.35));
            yield* ctx.V.tween(2.2, (t) => { D.j.headTurn = -0.4 + 0.8 * t; D.j.rR = 0.2 + 0.4 * t; }, (t) => t);
            yield* ctx.V.all(D.turnTo(0, 0.35), D.pose("stand", 0.35));
          },
          *pace(ctx) { yield* D.hopTo(X + 2.8, 0.7, { faceYaw: -0.5 }); yield* D.pose("think", 0.4); yield 0.8; yield* D.hopTo(MARK[0] + 0.9, MARK[1], { faceYaw: 0 }); yield* D.pose("stand", 0.3); },
          *think(ctx) { yield* D.pose("think", 0.45); yield* D.wiggle("headTilt", 0.15, 1, 1.6); yield* D.pose("stand", 0.4); },
          *confer(ctx) { yield* ctx.V.all(D.turnTo(-1.0, 0.35), Wr.turnTo(1.0, 0.35)); yield* ctx.V.all(D.pose("conduct", 0.4), Wr.pose("nod", 0.3)); yield 0.6; yield* ctx.V.all(Wr.pose("stand", 0.3), D.pose("stand", 0.3), D.turnTo(0, 0.35), Wr.turnTo(0.5, 0.35)); },
          *clap(ctx) { yield* D.pose("hold", 0.3); yield* D.bounce(0.1, 0.4); yield* flash(world, board, 0xffc857, 0.6); yield* D.pose("stand", 0.3); },
          *stretch(ctx) { yield* D.pose("cheer", 0.5); yield 0.3; yield* D.pose("stand", 0.5); yield* Wr.bounce(0.06, 0.4); },
        },
        *react(ctx, evs) { yield* ctx.V.all(D.pose("point", 0.3), D.bounce(evs.length > 1 ? 0.15 : 0.07, 0.4), flash(world, board, 0x2bb673, 0.5)); yield* D.pose("stand", 0.3); },
      },
    },
    apply(ctx, stage, e, c) {
      const d = e.data || {};
      if (e.kind === "film.stage" && d.stage === "direction" && d.state === "running") { ctx.data.scenes = []; paintBoard(ctx); }
      if (e.kind === "direction.scene") { ctx.data.scenes[c.i ?? d.i] = { seconds: c.seconds ?? d.seconds }; paintBoard(ctx); }
      if (e.kind === "film.stage" && d.stage === "direction" && d.state === "done" && c.scenes) { ctx.data.scenes = c.scenes.map((s) => ({ seconds: s.seconds })); paintBoard(ctx, "flip"); }
    },
    *retry(ctx) { yield* D.pose("shrug", 0.4); yield 0.8; yield* D.pose("stand", 0.4); },
    *fail(ctx) { yield* D.pose("sad", 0.8); },
  };
  return station;
}
