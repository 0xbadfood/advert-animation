import * as THREE from "three";
import { makeFigure, props } from "../world/cast.js";
import { panel, stand, flash } from "./common.js";

// Station 2, hooks (engine stages truths, concepts). The longest blind wait in the cloud profile, so it carries the
// richest idle acting: the writer reads the research notes (facts keep turning: completed work, honestly stretched),
// thinks, scribbles, paces; the bulb charges with truths.progress; one thought bubble pops per hook.
export const MAX_HOOKS = 8;

export function build(world, X) {
  world.rug(X, 4.6);
  const tbl = new THREE.Group(); tbl.position.set(X - 2.3, 0, 0.9); world.scene.add(tbl);
  if (!world.prop("side_table", 0, 0, 0, 0, tbl)) { world.box(0.9, 0.06, 0.6, 0xf6f2ff, 0, 0.62, 0, tbl, 0.3); world.box(0.08, 0.6, 0.08, 0xc79a6b, 0, 0.3, 0, tbl); }
  const mug = props.mug(); mug.position.set(0.2, 0.65, 0); tbl.add(mug);

  const notes = panel(world, "notes", { x: X - 2.9, y: 2.15, z: -0.9, w: 2.0, h: 1.15, rotY: 0.35, kind: "card", placeholder: "notes" });
  const angles = panel(world, "angles", { x: X - 2.9, y: 3.35, z: -1.0, w: 1.0, h: 0.75, rotY: 0.35, kind: "counter", placeholder: "angles" });
  stand(world, X - 2.9, -0.9, 1.55);

  // the idea bulb floats above the writer
  const bulbM = new THREE.MeshStandardMaterial({ color: 0xfff1b8, roughness: 0.2, emissive: 0xffc857, emissiveIntensity: 0.05 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 18), bulbM); bulb.position.set(X - 0.9, 2.45, 0.6); world.scene.add(bulb);
  const bulbBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0x9a96b8 })); bulbBase.position.set(X - 0.9, 2.22, 0.6); world.scene.add(bulbBase);
  let charge = 0, flicker = 0;
  world.updaters.push((t) => { bulbM.emissiveIntensity = 0.05 + charge * 1.6 + flicker * (0.5 + 0.5 * Math.sin(t * 23)); bulb.position.y = 2.45 + Math.sin(t * 1.7) * 0.04; });

  // bubbles in an arc to the right; hidden until a hook lands
  const bubbles = [];
  for (let i = 0; i < MAX_HOOKS; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    const b = panel(world, "hook_" + i, { x: X + 0.6 + col * 1.75 + (row % 2) * 0.35, y: 1.25 + row * 0.85, z: -0.8 - col * 0.25, w: 1.65, h: 0.95, kind: "bubble", frame: false, transparent: true, hidden: true, px: 420 });
    bubbles.push(b);
  }

  const W = makeFigure(world, "writer", X - 6.5, 0.9, Math.PI / 2);
  const book = W.hold(props.notebook(), "L"); book.visible = false;
  const pen = W.hold(props.pen(), "R"); pen.visible = false;
  const MARK = [X - 0.9, 0.7];
  let factNo = 0;
  function nextFact(ctx) { const f = ctx.data.facts; if (f.length) notes.set({ title: "Research notes", text: f[factNo++ % f.length], headerFrac: 0.24 }); }

  const thinking = {
    *read(ctx) { book.visible = true; yield* W.pose("read", 0.45); nextFact(ctx); yield* W.wiggle("headNod", 0.1, 2, 1.8); yield* W.pose("stand", 0.4); book.visible = false; },
    *think(ctx) { flicker = 0.6; yield* W.pose("think", 0.5); yield* W.wiggle("headTilt", 0.15, 1, 2.0); flicker = 0; yield* W.pose("stand", 0.4); },
    *scribble(ctx) { book.visible = pen.visible = true; yield* W.pose("write", 0.4); yield* W.wiggle("eR", 0.35, 6, 1.8); yield* W.pose("stand", 0.35); book.visible = pen.visible = false; },
    *pace(ctx) { yield* W.hopTo(X + 0.3, 0.9, { faceYaw: -0.4 }); yield* W.pose("think", 0.4); yield 0.6; yield* W.hopTo(MARK[0], MARK[1]); yield* W.pose("stand", 0.3); },
    *lookBulb(ctx) { flicker = 1; yield* W.pose("lookUp", 0.5); yield 0.7; flicker = 0; yield* W.pose("stand", 0.4); },
    *sip(ctx) { yield* W.hopTo(X - 1.7, 0.95, { faceYaw: -0.6 }); yield* W.pose("hold", 0.4); yield 0.6; yield* W.pose("stand", 0.3); yield* W.hopTo(MARK[0], MARK[1]); },
    *stretch(ctx) { yield* W.pose("cheer", 0.6); yield 0.4; yield* W.pose("stand", 0.5); },
    *tap(ctx) { for (let i = 0; i < 3; i++) yield* W.bounce(0.05, 0.35); yield 0.4; },
    *notesDeep(ctx) { yield* W.turnTo(0.7, 0.4); nextFact(ctx); yield* W.pose("think", 0.4); yield 1.2; nextFact(ctx); yield 1.0; yield* W.turnTo(0, 0.4); yield* W.pose("stand", 0.3); },
  };

  const station = {
    name: "hooks", x: X, cards: { full: "tc", strip: "tc" }, framing: { x: X + 0.3, y: 2.0, z: -0.5, w: 9.8, h: 5.0 },
    stages: {
      truths: {
        *enter(ctx) { if (W.root.position.x < X - 4) yield* W.hopTo(MARK[0], MARK[1]); nextFact(ctx); yield* W.pose("think", 0.4); yield 0.4; yield* W.pose("stand", 0.3); },
        phases: { early: ["read", "think", "scribble", "lookBulb"], mid: ["read", "pace", "think", "scribble", "sip", "notesDeep"], late: ["notesDeep", "pace", "stretch", "tap", "sip", "think", "scribble"] },
        beats: thinking,
        *react(ctx, evs) { flicker = 1; yield* W.pose("lookUp", 0.3); yield 0.5; flicker = 0; yield* W.pose("stand", 0.3); },
      },
      concepts: {
        *enter(ctx) { charge = 1; yield* ctx.V.all(W.bounce(0.2, 0.6), W.pose("cheer", 0.4)); yield* W.pose("stand", 0.35); },
        phases: { early: ["scribble", "think", "lookBulb"], mid: ["scribble", "pace", "read", "think"], late: ["pace", "tap", "stretch", "think"] },
        beats: thinking,
        *react(ctx, evs) {
          const last = bubbles[Math.min(MAX_HOOKS - 1, ctx.data.hooks.length - 1)];
          yield* ctx.V.all(W.pose(evs.length > 1 ? "cheer" : "point", 0.3), W.bounce(evs.length > 1 ? 0.18 : 0.08, 0.45), last ? flash(world, last) : null);
          yield 0.3; yield* W.pose("stand", 0.3);
        },
        *exit(ctx) {
          // the bubbles drift right, toward the review table
          const x0 = bubbles.map((b) => b.group.position.x);
          yield* ctx.V.tween(0.9, (t) => bubbles.forEach((b, i) => { b.group.position.x = x0[i] + t * (2 + i * 0.15); b.group.scale.setScalar(1 - t * 0.6); }));
          bubbles.forEach((b, i) => { b.group.visible = false; b.group.position.x = x0[i]; });
        },
      },
    },
    apply(ctx, stage, e, c) {
      const d = e.data || {};
      if (e.kind === "batch.start") { ctx.data.hooks = []; charge = 0; bubbles.forEach((b) => { b.group.visible = false; b.clear(); }); }   // a retried batch starts clean
      if (e.kind === "truths.progress") charge = Math.max(charge, Math.min(0.9, (c.p ?? d.p ?? 0) * 0.9));
      if (e.kind === "truths.done") { charge = 1; angles.set({ value: c.n ?? d.n, label: "angles" }, { kind: "counter", reveal: "pop" }); }
      if (e.kind === "concept.done") {
        const i = ctx.data.hooks.length; ctx.data.hooks.push(c.hook ?? d.hook);
        if (i < MAX_HOOKS) { const b = bubbles[i]; b.group.visible = true; b.group.scale.setScalar(1); b.set({ text: ctx.hookText(c.hook ?? d.hook, i) }, { kind: "bubble", reveal: "pop" }); }
      }
    },
    *retry(ctx) { yield* W.pose("shrug", 0.4); yield 0.8; yield* W.pose("stand", 0.4); },
    *fail(ctx) { yield* W.pose("sad", 0.8); },
  };
  return station;
}
