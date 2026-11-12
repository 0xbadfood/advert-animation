import * as THREE from "three";
import { makeFigure, props } from "../world/cast.js";
import { panel, flash, v3 } from "./common.js";

// Station 3, review (engine stages judge, pick). Judging is a ~10 s burst of 56 pairs, so the reactions fold; the pick
// holds at least MIN_DWELL before direction may interrupt. One card lifts; the rest go to "your bin" (the honest line).
export const MAX_IDEAS = 8;

export function build(world, X) {
  world.rug(X, 4.8);
  // the board
  world.box(6.0, 2.2, 0.1, 0xf6f2ff, X, 2.75, -2.0, undefined, 0.4);
  const cards = [];
  for (let i = 0; i < MAX_IDEAS; i++) {
    const c = i % 4, r = Math.floor(i / 4);
    cards.push(panel(world, "idea_" + i, { x: X - 2.15 + c * 1.43, y: 3.3 - r * 0.95, z: -1.9, w: 1.3, h: 0.78, kind: "card", placeholder: String(i + 1), px: 300 }));
  }
  const pairs = panel(world, "pairs", { x: X + 3.55, y: 3.3, z: -1.5, w: 1.0, h: 0.75, rotY: -0.35, kind: "counter", placeholder: "pairs" });
  const chosen = panel(world, "chosen", { x: X, y: 2.85, z: -0.6, w: 2.2, h: 1.2, kind: "card", placeholder: "", hidden: true, glow: true });

  // the bin (idea bank): a squat lilac vault with a slot of its own for the count
  const binG = new THREE.Group(); binG.position.set(X + 3.6, 0, -0.5); world.scene.add(binG);
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 1.3, 32), new THREE.MeshStandardMaterial({ color: 0xb9a6f2, roughness: 0.35 })); vault.position.y = 0.65; vault.castShadow = true; binG.add(vault);
  const binCount = panel(world, "bin", { x: X + 3.6, y: 0.75, z: 0.32, w: 0.9, h: 0.55, kind: "counter", placeholder: "bin" });

  // table and judges
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.08, 40), new THREE.MeshStandardMaterial({ color: 0xf6f2ff, roughness: 0.3 })); table.position.set(X, 0.48, 0.9); table.castShadow = table.receiveShadow = true; world.scene.add(table);
  world.box(0.15, 0.45, 0.15, 0xc79a6b, X, 0.225, 0.9);
  const J = [makeFigure(world, "crew1", X - 7, 0.2, Math.PI / 2), makeFigure(world, "crew2", X - 7.5, -0.2, Math.PI / 2), makeFigure(world, "crew3", X + 7, 0.2, -Math.PI / 2)];
  J[1].hold(props.stamp(), "R");
  const SEATS = [[X - 1.6, -0.1, 0.35], [X, -0.5, 0], [X + 1.6, -0.1, -0.35]];
  let shown = 0, lifted = -1;

  function fillCards(ctx) {
    const h = ctx.data.hooks;
    for (let i = shown; i < Math.min(MAX_IDEAS, h.length); i++) cards[i].set({ text: ctx.hookText(h[i], i), size: 26, maxLines: 3 }, { reveal: "pop" });
    shown = Math.max(shown, Math.min(MAX_IDEAS, h.length));
  }
  function* comparePair(ctx, quick = false) {
    const n = Math.max(2, shown), a = Math.floor(ctx.rng() * n); let b = Math.floor(ctx.rng() * n); if (b === a) b = (a + 1) % n;
    const V = ctx.V, look = (i) => (cards[i].group.position.x - X) * -0.25;
    yield* V.all(flash(world, cards[a], 0xffc857, quick ? 0.35 : 0.7), flash(world, cards[b], 0x7cc4ff, quick ? 0.35 : 0.7), ...J.map((j) => j.turnTo(Math.PI + look(a) * 0.5, quick ? 0.15 : 0.3)));
  }

  const station = {
    name: "review", x: X, framing: { x: X + 0.4, y: 2.1, z: -0.6, w: 10.4, h: 5.0 },
    stages: {
      judge: {
        *enter(ctx) {
          fillCards(ctx);
          yield* ctx.V.all(...J.map((j, i) => j.hopTo(SEATS[i][0], SEATS[i][1], { faceYaw: SEATS[i][2] })));
          yield* ctx.V.all(...J.map((j) => j.pose("lookUp", 0.4)));
        },
        phases: { early: ["compare", "nod", "confer"], mid: ["compare", "confer", "thumbs", "nod"], late: ["confer", "thumbs", "compare", "stamp"] },
        beats: {
          *compare(ctx) { yield* comparePair(ctx); yield* ctx.V.all(...J.map((j) => j.turnTo(Math.PI * 0, 0.4))); },
          *nod(ctx) { for (const j of J) { yield* j.pose("nod", 0.2); yield* j.pose("stand", 0.2); } yield 0.3; },
          *confer(ctx) { yield* ctx.V.all(J[0].turnTo(-1.2, 0.35), J[2].turnTo(1.2, 0.35), J[1].pose("think", 0.4)); yield 1.0; yield* ctx.V.all(J[0].turnTo(0.35, 0.35), J[2].turnTo(-0.35, 0.35), J[1].pose("stand", 0.4)); },
          *thumbs(ctx) { const j = ctx.rng.pick(J); yield* j.pose("thumbs", 0.35); yield* j.bounce(0.08, 0.4); yield 0.4; yield* j.pose("stand", 0.3); },
          *stamp(ctx) { yield* J[1].pose("stamp", 0.3); yield* J[1].bounce(0.06, 0.3); yield* J[1].pose("stand", 0.3); yield 0.4; },
        },
        *react(ctx, evs) {
          fillCards(ctx);
          const n = Math.min(4, evs.filter((e) => e.kind === "judge.pair").length);
          for (let i = 0; i < Math.max(1, n); i++) yield* comparePair(ctx, n > 1);
          yield* ctx.V.all(...J.map((j) => j.turnTo(0, 0.25)), J[1].pose("nod", 0.25)); yield* J[1].pose("stand", 0.2);
        },
      },
      pick: {
        *enter(ctx, ev) {
          fillCards(ctx);
          const V = ctx.V, p = ctx.data.pick || {};
          let idx = ctx.data.hooks.indexOf(p.hook); if (idx < 0 || idx >= MAX_IDEAS) idx = 0;
          lifted = idx;
          yield* flash(world, cards[idx], 0x2bb673, 0.6);
          // the others fly into the bin, the chosen one lifts forward
          const binPos = v3(X + 3.6, 1.2, -0.5);
          const flights = cards.map((c, i) => (i === idx || i >= shown ? null : (function* () { yield (i % 4) * 0.08; const p0 = c.group.position.clone(); yield* world.fly(c.group, binPos, { dur: 0.7, arc: 0.6, keep: true, scaleTo: 0.15 }); c.group.visible = false; c.group.position.copy(p0); c.group.scale.setScalar(1); })()));
          const cg = cards[idx].group, from = cg.position.clone();
          yield* V.all(...flights, world.V.tween(0.7, (t) => { cg.position.lerpVectors(from, v3(X, 2.85, -0.6), t); cg.scale.setScalar(1 + t * 0.6); }));
          cg.visible = false; cg.position.copy(from); cg.scale.setScalar(1);
          chosen.group.visible = true; chosen.set(ctx.pickCard(p), { kind: "card", reveal: "pop" });
          binCount.set({ value: Math.max(0, shown - 1), label: "in your bin" }, { kind: "counter", reveal: "pop" });
          yield* V.all(J[1].pose("stamp", 0.25), J[0].pose("cheer", 0.35), J[2].pose("cheer", 0.35));
          yield* V.all(...J.map((j) => j.bounce(0.15, 0.5)));
          yield* V.all(...J.map((j) => j.pose("stand", 0.35)));
        },
        phases: { early: ["admire", "cheer"] },
        beats: {
          *admire(ctx) { yield* ctx.V.all(...J.map((j) => j.pose("lookUp", 0.4))); yield* flash(world, chosen, 0x2bb673, 0.8); yield* ctx.V.all(...J.map((j) => j.pose("stand", 0.4))); },
          *cheer(ctx) { yield* ctx.V.all(...J.map((j, i) => (function* () { yield i * 0.12; yield* j.bounce(0.12, 0.45); })())); yield 0.5; },
        },
        *exit(ctx) { yield* ctx.V.tween(0.5, (t) => chosen.group.scale.setScalar(1 - t * 0.5)); chosen.group.visible = false; chosen.group.scale.setScalar(1); },
      },
    },
    apply(ctx, stage, e, c) {
      const d = e.data || {};
      if (e.kind === "batch.start") { shown = 0; cards.forEach((x) => { x.group.visible = true; x.clear(); }); chosen.group.visible = false; }
      if (e.kind === "view.ideas" && c.hooks) { if (c.hooks.length > ctx.data.hooks.length) ctx.data.hooks = c.hooks.slice(); fillCards(ctx); }
      if (e.kind === "judge.pair") pairs.set({ value: d.done, label: `of ${d.total} weighed` }, { kind: "counter", reveal: "none" });
      if (e.kind === "pick" || e.kind === "view.pick") ctx.data.pick = { ...(ctx.data.pick || {}), ...c };
    },
    *retry(ctx) { yield* ctx.V.all(...J.map((j) => j.pose("shrug", 0.4))); yield 0.8; yield* ctx.V.all(...J.map((j) => j.pose("stand", 0.4))); },
    *fail(ctx) { yield* ctx.V.all(...J.map((j) => j.pose("sad", 0.8))); },
  };
  void lifted;
  return station;
}
