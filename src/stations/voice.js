import * as THREE from "three";
import { makeFigure, props } from "../world/cast.js";
import { panel, flash } from "./common.js";

// Station 5, voice (engine stage audio). A blind TTS wait of 20-32 s; audio.line (proposed) lands one waveform lane
// per scene as its speech returns; the stage's done event fills the main waveform and the WAV card with the real
// duration. Before any audio exists the main panel shows only a "listening" level meter, never a fake waveform.
export function build(world, X) {
  world.rug(X, 4.8);
  const main = panel(world, "wave_main", { x: X - 0.2, y: 3.35, z: -1.9, w: 4.4, h: 1.15, kind: "wave", placeholder: "voice", px: 900, frameColor: 0x2d2550 });
  const lanes = [0, 1, 2].map((i) => panel(world, "wave_lane_" + i, { x: X + 3.55, y: 2.85 - i * 0.5, z: -1.3, w: 1.7, h: 0.4, rotY: -0.35, kind: "wave", placeholder: "", px: 420, frameColor: 0x2d2550 }));
  const wav = panel(world, "wav", { x: X - 3.55, y: 2.6, z: -1.3, w: 1.05, h: 1.25, rotY: 0.35, kind: "card", placeholder: "audio" });

  const MICS = [-2.3, -0.77, 0.77, 2.3].map((d) => X + d);
  for (const mx of MICS) {
    if (world.prop("mic", mx, 0, 0.95)) continue;
    world.box(0.03, 1.15, 0.03, 0x3d3360, mx, 0.58, 0.95);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.1, 6, 12), new THREE.MeshStandardMaterial({ color: 0x9a96b8, roughness: 0.3, metalness: 0.4 }));
    head.position.set(mx, 1.22, 0.92); head.rotation.x = 0.5; world.scene.add(head);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x3d3360 })); base.position.set(mx, 0.02, 0.95); world.scene.add(base);
  }
  const roles = ["crew1", "crew2", "crew3", "crew4"];
  const S = roles.map((r, i) => makeFigure(world, r, X - 7 - i * 0.7, 0.3, Math.PI / 2));
  const C = makeFigure(world, "researcher", X + 7, 0.9, -Math.PI / 2);
  C.hold(props.pointer(), "R");

  // the idle level meter (activity, not an artifact)
  let listening = false, liveSamples = null, lineNo = 0;
  const meter = new Array(60).fill(0); let meterPainted = null;
  world.updaters.push((t) => {
    if (!listening || liveSamples) return;
    for (let i = 0; i < meter.length; i++) meter[i] = 0.08 + 0.12 * Math.abs(Math.sin(t * 3 + i * 0.35)) * Math.abs(Math.sin(t * 1.3 + i * 0.11));
    if (meterPainted === null || Math.abs(t - meterPainted) >= 1 / 15) { meterPainted = t; } else return;
    main.repaint("wave", { samples: meter, progress: 1, label: "● REC", color: "#ff8fa3" });
  });

  function* sing(ctx, who, dur = 1.6) { yield* who.pose("sing", 0.35); yield* who.wiggle("headNod", 0.12, 2, dur); yield* who.pose("stand", 0.35); }

  const station = {
    name: "voice", x: X, cards: { full: "tl", strip: { x: 0.02, y: 0.515 } }, framing: { x: X, y: 2.0, z: -0.5, w: 10.2, h: 5.0 },
    stages: {
      audio: {
        *enter(ctx) {
          listening = true;
          yield* ctx.V.all(...S.map((s, i) => (function* () { yield i * 0.15; yield* s.hopTo(MICS[i], 0.35, { faceYaw: 0 }); })()), C.hopTo(X + 3.4, 1.0, { faceYaw: -0.7 }));
          yield* C.pose("conduct", 0.4); yield* C.wiggle("sR", 0.25, 2, 0.8); yield* C.pose("stand", 0.3);
        },
        phases: { early: ["chorus", "solo", "conduct"], mid: ["solo", "duet", "conduct", "chorus"], late: ["duet", "breathe", "conduct", "solo", "chorus"] },
        beats: {
          *chorus(ctx) { yield* ctx.V.all(...S.map((s, i) => (function* () { yield i * 0.1; yield* sing(ctx, s, 1.8); })()), C.wiggle("rR", 0.3, 3, 2.2)); },
          *solo(ctx) { const s = ctx.rng.pick(S); yield* ctx.V.all(sing(ctx, s, 2.0), C.turnTo(-1.1, 0.3)); yield* C.turnTo(-0.7, 0.3); },
          *duet(ctx) { yield* ctx.V.all(S[1].turnTo(0.8, 0.3), S[2].turnTo(-0.8, 0.3)); yield* ctx.V.all(sing(ctx, S[1], 1.6), sing(ctx, S[2], 1.6)); yield* ctx.V.all(S[1].turnTo(0, 0.3), S[2].turnTo(0, 0.3)); },
          *conduct(ctx) { yield* C.pose("conduct", 0.35); yield* ctx.V.all(C.wiggle("sR", 0.35, 3, 1.8), ...S.map((s) => s.wiggle("headNod", 0.08, 3, 1.8))); yield* C.pose("stand", 0.3); },
          *breathe(ctx) { yield* ctx.V.all(...S.map((s) => s.pose("lookUp", 0.5))); yield 0.8; yield* ctx.V.all(...S.map((s) => s.pose("stand", 0.5))); },
        },
        *react(ctx, evs) {
          const lane = lanes[(lineNo + 2) % 3];
          yield* ctx.V.all(flash(world, lane, 0x8be9ff, 0.5), C.pose("point", 0.3), ...S.map((s, i) => (function* () { yield i * 0.06; yield* s.bounce(evs.length > 1 ? 0.12 : 0.06, 0.4); })()));
          yield* C.pose("stand", 0.3);
        },
        *exit(ctx) { listening = false; yield* ctx.V.all(...S.map((s) => s.pose("cheer", 0.35))); yield 0.3; yield* ctx.V.all(...S.map((s) => s.pose("stand", 0.35))); },
      },
    },
    apply(ctx, stage, e, c) {
      const d = e.data || {};
      if (e.kind === "film.stage" && d.stage === "audio" && d.state === "running") { liveSamples = null; lineNo = 0; }
      if (e.kind === "audio.line") {
        const lane = lanes[lineNo % 3]; lineNo++;
        lane.set({ samples: c.samples || [], progress: 1, label: `scene ${(c.scene ?? d.scene) + 1} · ${(c.seconds ?? d.seconds ?? 0).toFixed(1)} s` }, { kind: "wave", reveal: "flip" });
      }
      if (e.kind === "film.stage" && d.stage === "audio" && d.state === "done" && c.samples) {
        liveSamples = c.samples; ctx.data.voiceSamples = c.samples;
        main.set({ samples: c.samples, progress: 1, label: "voice" }, { kind: "wave", reveal: "flip" });
        wav.set({ title: "AUDIO", text: `${Math.round(c.seconds || 0)} s`, size: 64, align: "center", check: true }, { kind: "card", reveal: "pop" });
      }
    },
    *retry(ctx) { yield* ctx.V.all(...S.map((s) => s.pose("shrug", 0.4))); yield 0.8; yield* ctx.V.all(...S.map((s) => s.pose("stand", 0.4))); },
    *fail(ctx) { yield* ctx.V.all(...S.map((s) => s.pose("sad", 0.8))); },
  };
  return station;
}
