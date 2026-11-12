import * as THREE from "three";
import { makeFigure, props } from "../world/cast.js";
import { panel, flash, orb, v3, visit } from "./common.js";

// Station 7, assembly (engine stages render, done). Locally 140-200 s, in the cloud 30-60 s. The director's wand sends
// the run's own inputs (the pick, the voice, the pictures) into the reel drum; a strip of the real stills runs to the
// phone; render.progress (proposed) drives the ring. On done the phone plays the ad and the whole cast celebrates.
export function build(world, X) {
  world.rug(X, 5.0);
  // the reel drum
  const drum = new THREE.Group(); drum.position.set(X - 0.5, 1.35, -0.9); world.scene.add(drum);
  if (!world.prop("drum", 0, 0, 0, 0, drum)) {
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.25, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x5b3fd1, roughness: 0.3, side: THREE.DoubleSide })); body.rotation.z = Math.PI / 2; drum.add(body);
  for (const sx of [-0.78, 0.78]) {
    const reel = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.08, 12, 40), gold); reel.rotation.y = Math.PI / 2; reel.position.x = sx; drum.add(reel);
    for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.06), gold); sp.position.x = sx; sp.rotation.x = (k * Math.PI) / 4; drum.add(sp); }
  }
  }
  if (!world.prop("drum_base", X - 0.5, 0, -0.9)) world.box(2.2, 0.5, 1.2, 0xf6f2ff, X - 0.5, 0.25, -0.9, undefined, 0.3);
  const ring = panel(world, "ring", { x: X - 0.5, y: 1.35, z: 0.0, w: 0.75, h: 0.75, kind: "ring", frame: false, transparent: true, px: 240 });
  let spin = 0.3, angle = 0, lastT = null;

  // inputs
  const inIdea = panel(world, "in_idea", { x: X - 3.6, y: 3.3, z: -1.2, w: 1.1, h: 0.62, rotY: 0.35, kind: "card", placeholder: "idea" });
  const inVoice = panel(world, "in_voice", { x: X - 3.6, y: 2.55, z: -1.2, w: 1.1, h: 0.5, rotY: 0.35, kind: "wave", placeholder: "voice", frameColor: 0x2d2550 });
  const inPics = panel(world, "in_pics", { x: X - 3.6, y: 1.75, z: -1.2, w: 1.1, h: 0.7, rotY: 0.35, kind: "image", placeholder: "pictures" });

  // the strip: frames that travel from the drum to the phone along a curve
  const STRIP = 7, frames = [];
  for (let i = 0; i < STRIP; i++) frames.push(panel(world, "strip_" + i, { x: X, y: 2, z: -1, w: 0.42, h: 0.62, kind: "image", placeholder: "", px: 160, frameColor: 0x26214a }));
  const curve = new THREE.CatmullRomCurve3([v3(X + 0.3, 1.9, -0.9), v3(X + 1.0, 2.7, -1.0), v3(X + 1.8, 2.5, -0.9), v3(X + 2.4, 2.0, -0.8)]);
  let stripOn = false;

  // the phone (9:16): the ad plays here
  if (!world.prop("phone", X + 3.3, 2.05, -0.76, -0.3)) { const phoneBody = world.box(1.12, 1.95, 0.08, 0x1d1838, X + 3.3, 2.05, -0.75, undefined, 0.2); phoneBody.rotation.y = -0.3; }
  const phone = panel(world, "phone", { x: X + 3.3, y: 2.05, z: -0.7, w: 0.98, h: 1.74, rotY: -0.3, kind: "image", placeholder: "your film", frame: false, px: 540 });
  let ad = null, adPainted = null;

  world.updaters.push((t) => {
    if (lastT !== null && t > lastT) angle += (t - lastT) * spin * 2; lastT = t; drum.rotation.x = angle;
    frames.forEach((f, i) => {
      f.group.visible = stripOn;
      if (!stripOn) return;
      const u = (t * 0.12 + i / STRIP) % 1, p = curve.getPointAt(u);
      f.group.position.copy(p); f.group.rotation.z = Math.sin(u * Math.PI * 2) * 0.2; f.group.scale.setScalar(0.6 + Math.sin(u * Math.PI) * 0.5);
    });
    if (ad && (adPainted === null || Math.abs(t - adPainted) >= 1 / 12)) { adPainted = t; phone.repaint("fn", { draw: (c, W, H) => ad(c, W, H, t) }); }
  });

  const D = makeFigure(world, "director", X - 7, 0.8, Math.PI / 2);
  D.hold(props.wand(), "R");
  const crowd = ["researcher", "writer", "crew1", "crew2", "crew3", "crew4"].map((r, i) => makeFigure(world, r, X + 8 + i * 0.6, 1.2, -Math.PI / 2));
  const CROWD_AT = [[X - 1.7, 0.75], [X - 0.6, 1.0], [X + 0.6, 1.0], [X + 1.7, 0.8], [X - 2.8, 0.5], [X + 2.6, 0.4]];

  // cameos for the long wait
  const WHOME = [X - 7.5, 1.4], CHOME = [X + 7.5, 1.6], DM = [X - 2.3, 0.8];
  const Wc = makeFigure(world, "writer", WHOME[0], WHOME[1], Math.PI / 2); const mug = Wc.hold(props.mug(), "R"); mug.position.set(0, -0.06, 0.06);
  const Cc = makeFigure(world, "crew2", CHOME[0], CHOME[1], -Math.PI / 2);

  function fillInputs(ctx) {
    if (ctx.data.pick) inIdea.set(ctx.pickCard(ctx.data.pick), { kind: "card", reveal: "pop" });
    if (ctx.data.voiceSamples) inVoice.set({ samples: ctx.data.voiceSamples, progress: 1 }, { kind: "wave", reveal: "pop" });
    const st = ctx.data.stills.filter(Boolean);
    if (st.length) inPics.set({ image: st[0], label: `${st.length} pictures` }, { kind: "image", reveal: "pop" });
    st.length && frames.forEach((f, i) => f.set({ image: st[i % st.length] }, { kind: "image", reveal: "none" }));
  }

  const station = {
    name: "assembly", x: X, cards: { full: "tc", strip: "tc" }, framing: { x: X - 0.1, y: 2.05, z: -0.6, w: 10.2, h: 5.0 },
    stages: {
      render: {
        *enter(ctx) {
          fillInputs(ctx);
          yield* D.hopTo(X - 2.3, 0.8, { faceYaw: 0.6 });
          yield* D.pose("point", 0.3);
          const drumP = v3(X - 0.5, 1.4, -0.9);
          yield* ctx.V.all(orb(world, v3(X - 3.4, 3.3, -1.1), drumP, { dur: 0.8 }), (function* () { yield 0.2; yield* orb(world, v3(X - 3.4, 2.55, -1.1), drumP, { dur: 0.8, color: 0x8be9ff }); })(), (function* () { yield 0.4; yield* orb(world, v3(X - 3.4, 1.75, -1.1), drumP, { dur: 0.8, color: 0x7ee0a1 }); })());
          spin = 1.2; stripOn = ctx.data.stills.some(Boolean);
          yield* D.pose("stand", 0.3);
        },
        phases: {
          early: ["wand", "watch", "sparkles", "followStrip", "inputs"],
          mid: ["wand", "watch", "pace", "check", "polish", "followStrip", "countdown", "sparkles"],
          late: ["pace", "check", "wand", "tap", "watch", "polish", "followStrip", "countdown", "sparkles", "quiet", "peek", "coffee", "inputs", "stretch"],
        },
        beats: {
          *inputs(ctx) { yield* D.turnTo(-0.9, 0.3); yield* D.pose("pointL", 0.3); for (const p of [inIdea, inVoice, inPics]) { yield* ctx.V.all(flash(world, p, 0xffc857, 0.5), D.bounce(0.04, 0.3)); } yield* D.pose("nod", 0.3); yield* D.pose("stand", 0.3); yield* D.turnTo(0.6, 0.3); },
          *stretch(ctx) { yield* D.pose("cheer", 0.5); yield* D.wiggle("side", 0.12, 1, 1.2); yield* D.pose("stand", 0.5); yield 0.6; },
          *polish(ctx) { yield* D.hopTo(X - 1.5, 0.5, { faceYaw: Math.PI * 0.8 }); yield* D.pose("point", 0.3); yield* D.wiggle("rR", 0.3, 5, 2.0); yield* D.pose("stand", 0.3); yield* D.hopTo(DM[0], DM[1], { faceYaw: 0.6 }); },
          *followStrip(ctx) { yield* D.turnTo(-0.2, 0.3); D.j.headNod = -0.3; yield* ctx.V.tween(3.0, (t) => { D.j.headTurn = -0.6 + 1.2 * t; }, (t) => t); yield* D.pose("stand", 0.3); yield* D.turnTo(0.6, 0.3); },
          *countdown(ctx) { yield* D.pose("point", 0.3); for (let i = 0; i < 3; i++) { yield* ctx.V.all(D.bounce(0.06, 0.35), flash(world, phone, 0xffc857, 0.35)); yield 0.25; } yield* D.pose("stand", 0.3); },
          *sparkles(ctx) { yield* D.pose("point", 0.3); for (let i = 0; i < 3; i++) yield* orb(world, v3(X - 1.9, 1.5, 1.0), v3(X - 0.5, 1.4 + (i - 1) * 0.3, -0.9), { dur: 0.45, color: [0xffc857, 0x8be9ff, 0x7ee0a1][i] }); spin = Math.min(2.2, spin + 0.2); yield* D.pose("stand", 0.3); },
          *quiet(ctx) { yield* D.pose("hold", 0.4); yield* D.wiggle("headTilt", 0.08, 1, 3.2); yield* D.pose("stand", 0.4); },
          *peek(ctx) { yield* visit(Cc, CHOME, [X + 2.0, 0.9], function* () { yield* Cc.pose("lookUp", 0.35); yield* Cc.wiggle("headTurn", 0.3, 1, 1.4); yield* ctx.V.all(Cc.pose("thumbs", 0.3), D.turnTo(1.0, 0.3)); yield 0.5; yield* D.turnTo(0.6, 0.3); }, -0.6); },
          *coffee(ctx) {
            yield* visit(Wc, WHOME, [DM[0] - 0.75, DM[1] + 0.2], function* () {
              yield* ctx.V.all(Wc.pose("offer", 0.35), D.turnTo(-1.0, 0.3));
              yield 0.4; mug.visible = false; yield* D.pose("hold", 0.3); yield* D.bounce(0.06, 0.4); yield 0.5;
              yield* ctx.V.all(D.pose("stand", 0.3), D.turnTo(0.6, 0.3), Wc.pose("wave", 0.3)); mug.visible = true;
            }, 0.9);
          },
          *wand(ctx) { yield* D.pose("point", 0.3); yield* ctx.V.all(D.wiggle("eR", 0.3, 2, 0.8), orb(world, v3(X - 1.9, 1.5, 1.0), v3(X - 0.5, 1.4, -0.9), { dur: 0.7 })); spin = Math.min(2.2, spin + 0.3); yield* D.pose("stand", 0.3); },
          *watch(ctx) { yield* D.turnTo(-0.4, 0.3); yield* D.pose("lookUp", 0.4); yield 1.2; yield* D.pose("stand", 0.3); yield* D.turnTo(0.6, 0.3); },
          *pace(ctx) { yield* D.hopTo(X - 3.2, 1.4, { faceYaw: 0.8 }); yield* D.pose("think", 0.4); yield 0.6; yield* D.hopTo(X - 2.3, 0.8, { faceYaw: 0.6 }); yield* D.pose("stand", 0.3); },
          *check(ctx) { yield* ctx.V.all(D.pose("think", 0.4), flash(world, phone.frame ? phone : ring, 0xffc857, 0.8)); yield 0.6; yield* D.pose("stand", 0.3); },
          *tap(ctx) { for (let i = 0; i < 3; i++) yield* D.bounce(0.05, 0.35); yield 0.3; },
        },
        *react(ctx, evs) { yield* ctx.V.all(D.pose("thumbs", 0.3), D.bounce(0.08, 0.4)); yield* D.pose("stand", 0.3); },
      },
      done: {
        *enter(ctx) {
          stripOn = false; spin = 0.2;
          yield* ctx.V.all(...crowd.map((f, i) => (function* () { yield i * 0.1; yield* f.hopTo(CROWD_AT[i][0], CROWD_AT[i][1], { faceYaw: 0, perHop: 0.26 }); })()), D.pose("cheer", 0.4));
          world.confetti(X + 0.2, 3.4, 0.2);
          yield* ctx.V.all(...crowd.map((f) => f.pose("cheer", 0.35)));
          yield* ctx.V.all(...crowd.map((f, i) => (function* () { yield i * 0.05; yield* f.bounce(0.2, 0.5); })()), D.bounce(0.2, 0.5));
        },
        phases: { early: ["cheer", "wave", "look"] },
        beats: {
          *cheer(ctx) { yield* ctx.V.all(...crowd.map((f, i) => (function* () { yield (i % 3) * 0.1; yield* f.bounce(0.14, 0.45); })())); yield 0.4; },
          *wave(ctx) { yield* ctx.V.all(...crowd.map((f) => f.pose("wave", 0.35))); yield* ctx.V.all(...crowd.map((f) => f.wiggle("rR", 0.25, 2, 1.0))); yield* ctx.V.all(...crowd.map((f) => f.pose("cheer", 0.35))); },
          *look(ctx) { yield* ctx.V.all(...crowd.map((f) => f.turnTo(-0.5, 0.35)), D.turnTo(-0.5, 0.35)); yield 1.0; yield* ctx.V.all(...crowd.map((f) => f.turnTo(0, 0.35)), D.turnTo(0, 0.35)); },
        },
      },
    },
    apply(ctx, stage, e, c) {
      const d = e.data || {};
      if (e.kind === "render.progress") ring.set({ p: c.p ?? d.p }, { kind: "ring", reveal: "none" });
      if (e.kind === "film.stage" && (d.stage === "music" || d.stage === "qa") && d.state === "done") ring.set({ p: (ring.content && ring.content.p) || 0, text: d.stage === "music" ? "♪" : "✓" }, { kind: "ring", reveal: "pop" });
      if (e.kind === "film.done" && c.ad) { ad = c.ad; ring.set({ p: 1, text: "✓" }, { kind: "ring", reveal: "pop" }); }
      if (e.kind === "film.stage" && d.stage === "render" && d.state === "running") ring.set({ p: 0 }, { kind: "ring", reveal: "none" });
    },
    *retry(ctx) { yield* D.pose("shrug", 0.4); yield 0.8; yield* D.pose("stand", 0.4); },
    *fail(ctx) { spin = 0; stripOn = false; yield* D.pose("sad", 0.8); },
  };
  return station;
}
