import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { painters } from "./paint.js";

// A slot is a named place in the scene where an artifact appears: a live canvas texture on a card.
// The card has depth: a thick lacquered card with rounded edges on an accent backing, offset like stacked paper, so it
// stands off its board. Floating cards drift. set() paints immediately (data lands the moment its event arrives); the
// reveal is the card's own motion: it pops out toward the camera, turns over to the new content and settles back.
const ease = { out: (t) => 1 - Math.pow(1 - t, 3), back: (t) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2) };

export class Slot {
  constructor(world, name, { w = 1, h = 1, px = 360, kind = "card", frame = true, frameColor = 0xffffff, glow = false,
    placeholder = "", transparent = false, depth = 0.06, accent = null, float = false, backing = true } = {}) {
    this.world = world; this.name = name; this.kind = kind; this.w = w; this.h = h; this.content = null; this.overflow = false;
    this.placeholderLabel = placeholder; this.depth = frame ? depth : 0;
    this.canvas = document.createElement("canvas");             // px on the long side
    this.canvas.width = Math.round(w >= h ? px : px * (w / h)); this.canvas.height = Math.round(w >= h ? px * (h / w) : px);
    this.ctx2d = this.canvas.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.group = new THREE.Group(); this.group.name = name ? "slot:" + name : "card";
    this.floater = new THREE.Group(); this.group.add(this.floater);     // the idle drift
    this.pivot = new THREE.Group(); this.floater.add(this.pivot);        // reveals move, turn and scale the pivot
    if (frame) {
      const r = Math.min(0.06, Math.min(w, h) * 0.12);
      const fr = new THREE.Mesh(new RoundedBoxGeometry(w + 0.1, h + 0.1, depth, 4, r),
        new THREE.MeshPhysicalMaterial({ color: frameColor, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.12,
          emissive: glow ? 0x6d4cff : 0x000000, emissiveIntensity: glow ? 0.25 : 0 }));
      fr.position.z = -depth / 2; fr.castShadow = true; fr.receiveShadow = true; this.pivot.add(fr); this.frame = fr;
      if (backing && accent !== null) {                      // the accent layer behind, offset down-right like stacked paper
        const bk = new THREE.Mesh(new RoundedBoxGeometry(w + 0.16, h + 0.16, depth * 0.6, 4, r * 1.2),
          new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.4, clearcoat: 0.4 }));
        bk.position.set(0.035, -0.035, -depth - depth * 0.3 - 0.01); bk.castShadow = true; this.pivot.add(bk); this.backing = bk;
      }
    }
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, transparent, side: THREE.FrontSide }));
    this.face.position.z = 0.003;
    this.pivot.add(this.face);
    if (!frame && transparent) {                             // a soft offset shadow, so a bubble lifts off the scene
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: this.tex, color: 0x2a1d6e, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }));
      sh.position.set(0.045, -0.055, -0.05); this.pivot.add(sh); this.shadow = sh;
    }
    if (float) {
      const ph = (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 0.37;
      world.updaters.push((t) => {
        this.floater.position.y = Math.sin(t * 0.9 + ph) * 0.03;
        this.floater.rotation.z = Math.sin(t * 0.6 + ph * 1.7) * 0.012;
        this.floater.rotation.x = Math.sin(t * 0.7 + ph * 0.5) * 0.02;
      });
    }
    this.paint("placeholder", { label: placeholder });
    if (name) world.slots[name] = this;
  }

  paint(kind, o) {
    const r = (painters[kind] || painters.card)(this.ctx2d, this.canvas.width, this.canvas.height, o) || {};
    this.tex.needsUpdate = true;
    if (r.overflow && !this.overflow) this.world.reportOverflow(this.name, o.text);
    this.overflow = !!r.overflow;
  }

  // set content now; the reveal plays as its own task unless the world is in silent (catch-up) mode.
  //   "flip": pop out, turn over to the new content, settle back   "pop": pop out with the new content and settle
  //   "none": paint in place (per-event counters, progress)
  set(content, { kind = this.kind, reveal = "flip" } = {}) {
    this.content = content;
    if (reveal === "none" || this.world.silent) { this.paint(kind, content); return; }
    const V = this.world.V, p = this.pivot, slot = this, out = 0.32;
    if (reveal === "flip") {
      V.spawn((function* () {
        yield* V.tween(0.16, (t) => { p.position.z = out * t; p.scale.setScalar(1 + 0.08 * t); }, ease.out);
        yield* V.tween(0.14, (t) => { p.rotation.y = (t * Math.PI) / 2; }, (t) => t);
        slot.paint(kind, content);
        yield* V.tween(0.2, (t) => { p.rotation.y = ((1 - t) * Math.PI) / 2; }, ease.out);
        yield* V.tween(0.38, (t) => { p.position.z = out * (1 - t); p.scale.setScalar(1.08 - 0.08 * t); }, ease.back);
        p.position.z = 0; p.scale.setScalar(1);
      })(), { k: 1 });
    } else if (reveal === "pop") {
      this.paint(kind, content);
      V.spawn((function* () {
        yield* V.tween(0.14, (t) => { p.position.z = out * t; p.scale.setScalar(0.7 + 0.4 * t); }, ease.out);
        yield* V.tween(0.42, (t) => { p.position.z = out * (1 - t); p.scale.setScalar(1.1 - 0.1 * t); }, ease.back);
        p.position.z = 0; p.scale.setScalar(1);
      })(), { k: 1 });
    } else this.paint(kind, content);
  }

  repaint(kind, content) { this.content = content; this.paint(kind || this.kind, content); }   // per-frame redraws (waveform sweep, playing ad)
  clear() { this.content = null; this.paint("placeholder", { label: this.placeholderLabel }); }
  setVisible(v) { this.group.visible = v; }
}
