import * as THREE from "three";
import { painters } from "./paint.js";

// A slot is a named place in the scene where an artifact appears: a framed face with a live canvas texture.
// set() paints immediately (data lands the moment its event arrives); the reveal is the slot's own little motion,
// independent of what the figures are doing.
export class Slot {
  constructor(world, name, { w = 1, h = 1, px = 360, kind = "card", frame = true, frameColor = 0xffffff, glow = false,
    placeholder = "", transparent = false, depth = 0.04 } = {}) {
    this.world = world; this.name = name; this.kind = kind; this.w = w; this.h = h; this.content = null; this.overflow = false;
    this.placeholderLabel = placeholder;
    this.canvas = document.createElement("canvas");             // px on the long side
    this.canvas.width = Math.round(w >= h ? px : px * (w / h)); this.canvas.height = Math.round(w >= h ? px * (h / w) : px);
    this.ctx2d = this.canvas.getContext("2d");
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.group = new THREE.Group(); this.group.name = "slot:" + name;
    this.pivot = new THREE.Group(); this.group.add(this.pivot);          // reveals rotate/scale the pivot
    if (frame) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, depth),
        new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.35, metalness: 0.05, emissive: glow ? 0x6d4cff : 0x000000, emissiveIntensity: glow ? 0.25 : 0 }));
      fr.position.z = -depth / 2 - 0.002; fr.castShadow = true; this.pivot.add(fr); this.frame = fr;
    }
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, transparent, side: THREE.FrontSide }));
    this.pivot.add(this.face);
    this.paint("placeholder", { label: placeholder });
    world.slots[name] = this;
  }

  paint(kind, o) {
    const r = (painters[kind] || painters.card)(this.ctx2d, this.canvas.width, this.canvas.height, o) || {};
    this.tex.needsUpdate = true;
    if (r.overflow && !this.overflow) this.world.reportOverflow(this.name, o.text);
    this.overflow = !!r.overflow;
  }

  // set content now; reveal plays as its own task unless the world is in silent (catch-up) mode
  set(content, { kind = this.kind, reveal = "flip" } = {}) {
    this.content = content;
    if (reveal === "none" || this.world.silent) { this.paint(kind, content); return; }
    const V = this.world.V, p = this.pivot, slot = this;
    if (reveal === "flip") {
      V.spawn((function* () {
        yield* V.tween(0.18, (t) => { p.rotation.y = (t * Math.PI) / 2; }, (t) => t);
        slot.paint(kind, content);
        yield* V.tween(0.28, (t) => { p.rotation.y = ((1 - t) * Math.PI) / 2; });
      })(), { k: 1 });
    } else if (reveal === "pop") {
      this.paint(kind, content);
      V.spawn(V.tween(0.4, (t) => { const s = 0.6 + 0.4 * t; p.scale.set(s, s, s); }, (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2)), { k: 1 });
    } else this.paint(kind, content);
  }

  repaint(kind, content) { this.content = content; this.paint(kind || this.kind, content); }   // per-frame redraws (waveform sweep, playing ad)
  clear() { this.content = null; this.paint("placeholder", { label: this.placeholderLabel }); }
  setVisible(v) { this.group.visible = v; }
}
