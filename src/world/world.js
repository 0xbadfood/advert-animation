import * as THREE from "three";
import { makeVerbs } from "../story/runner.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { THEMES, STATION_ORDER, themeAt, blendAt } from "./themes.js";

// The studio: one scene, stations laid out left to right along x, a camera "focus" that trucks between station
// framings, and the views that render it (a desktop page: 16:9; phones are out of scope, DESIGN.md section 5).
export const STATION_GAP = 13;
export const ZOOM = 0.85, LOWER = 0.06;     // the station framings, tightened so the figurines read as the stars
export const PALETTE = { floor: 0xe2d8fb, wall: 0xf1eaff, rug: 0xcfc0f7, violet: 0x5b3fd1, gold: 0xffc857, lilac: 0xb9a6f2, wood: 0xc79a6b, desk: 0xf6f2ff };

export class World {
  // cast: the Blender figurine templates by role (world/models.js), or null for the greybox figures
  constructor(runner, views = [], cast = null, set = null, props = null) {
    this.cast = cast; this.setTemplate = set; this.props = props;
    this.runner = runner; this.V = makeVerbs(runner);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeee6ff);
    this.scene.fog = new THREE.Fog(0xeee6ff, 34, 70);
    this.slots = {}; this.figures = []; this.stations = {}; this.updaters = []; this.views = views;
    this.silent = false; this.overflows = []; this.onOverflow = null;
    this.focus = { x: 0, y: 1.4, z: 0, w: 9, h: 5 };
    // a soft studio to reflect: metal (gold rims, chrome posts) and the lacquer's clear coat need something to mirror.
    // Made once per renderer (views outlive worlds).
    const v0 = views[0];
    if (v0) {
      if (!v0.envMap) { const pm = new THREE.PMREMGenerator(v0.renderer); v0.envMap = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
      this.scene.environment = v0.envMap; this.scene.environmentIntensity = 0.14;
    }
    this.buildStudio();
  }

  buildStudio() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xf5efff, 0xb9a6f2, 1.0); s.add(this.hemi);
    const key = (this.key = new THREE.DirectionalLight(0xfff4e6, 2.1));
    key.position.set(-6, 12, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40; key.shadow.bias = -0.0004; key.shadow.radius = 4;
    s.add(key); s.add(key.target);
    const rim = new THREE.DirectionalLight(0xffd59a, 0.9); rim.position.set(5, 6, -8); s.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({ color: PALETTE.floor, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    // one wall per station in its theme, a lacquered pillar between stations, a skirting along the bottom
    STATION_ORDER.forEach((name, i) => {
      const th = THEMES[name], x = i * STATION_GAP;
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(STATION_GAP, 14), new THREE.MeshStandardMaterial({ color: th.wall, roughness: 0.92 }));
      wall.position.set(x, 7, -4.2); wall.receiveShadow = true; s.add(wall);
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(STATION_GAP, 0.24, 0.08), new THREE.MeshStandardMaterial({ color: th.accent, roughness: 0.5 }));
      skirt.position.set(x, 0.12, -4.14); s.add(skirt);
    });
    const pillarM = new THREE.MeshPhysicalMaterial({ color: 0xfbf8ff, roughness: 0.3, clearcoat: 0.6 });
    for (let i = -1; i < STATION_ORDER.length; i++) {
      const p = new THREE.Mesh(new RoundedBoxGeometry(0.9, 14, 0.7, 4, 0.12), pillarM);
      p.position.set(i * STATION_GAP + STATION_GAP / 2, 7, -4.0); p.castShadow = p.receiveShadow = true; s.add(p);
    }
    if (this.setTemplate) s.add(this.setTemplate.clone(true));      // the Blender set dressing (blender/set.py)
    // the sky and the fog follow the station the camera is at
    this.skyA = new THREE.Color(); this.skyB = new THREE.Color();
  }

  themeAt(x) { return themeAt(x, STATION_GAP); }

  // a clone of a Blender station prop (blender/props.py), placed and added; null when the props are not loaded, so the
  // station builds its primitive instead
  prop(name, x = 0, y = 0, z = 0, rotY = 0, parent = null) {
    const t = this.props && this.props[name];
    if (!t) return null;
    const o = t.clone(true); o.position.set(x, y, z); o.rotation.set(0, rotY, 0);
    (parent || this.scene).add(o);
    return o;
  }

  // a round rug that marks a station
  rug(x, r = 4.2) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshStandardMaterial({ color: this.themeAt(x).rug, roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.005, 0); m.receiveShadow = true; this.scene.add(m); return m;
  }

  box(w, h, d, color, x, y, z, parent = this.scene, rough = 0.5) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rough }));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }

  // views outlive worlds (a scrub rebuilds the world, never the WebGL contexts)
  static makeView(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;   // neutral: base colours (the cards) stay faithful through the bloom pass
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return { canvas, renderer, camera: new THREE.PerspectiveCamera(32, 1, 0.1, 100) };
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.userData.shared) return;                       // the cast's templates outlive any one world
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => { if (m.userData.shared) return; if (m.map) m.map.dispose(); m.dispose(); });
    });
    for (const v of this.views) v.renderer.renderLists.dispose();
  }

  // frame the focus box (w, h) for this view's aspect
  frame(v) {
    const W = v.canvas.clientWidth || 16, H = v.canvas.clientHeight || 9, aspect = W / H;
    v.renderer.setSize(W, H, false); v.camera.aspect = aspect;
    const f = this.focus, bw = f.w * ZOOM, bh = f.h * ZOOM;
    const vfov = THREE.MathUtils.degToRad(v.camera.fov);
    const distH = bh / 2 / Math.tan(vfov / 2), distW = bw / 2 / (Math.tan(vfov / 2) * aspect);
    const dist = Math.max(distH, distW) + 0.5;
    const dir = new THREE.Vector3(0, 0.3, 1).normalize();
    const fy = f.y - LOWER;
    v.camera.position.set(f.x + dir.x * dist, fy + dir.y * dist, f.z + dir.z * dist);
    v.camera.lookAt(f.x, fy, f.z);
    v.camera.updateProjectionMatrix();
  }

  // truck the focus to a station's framing
  *moveTo(stationName, dur = 1.8) {
    const st = this.stations[stationName]; if (!st) return;
    const a = { ...this.focus }, b = st.framing;
    this.cameraStation = stationName;
    yield* this.V.tween(dur, (t) => { for (const k of Object.keys(b)) this.focus[k] = a[k] + (b[k] - a[k]) * t; });
  }

  jumpTo(stationName) { const st = this.stations[stationName]; if (st) { Object.assign(this.focus, st.framing); this.cameraStation = stationName; } }

  update(t) {
    for (const f of this.figures) f.apply(t);
    for (const u of this.updaters) u(t);
    this.key.position.set(this.focus.x - 6, 12, 9); this.key.target.position.set(this.focus.x, 0, 0);
    const [a, b, k] = blendAt(this.focus.x, STATION_GAP, "sky");
    this.skyA.setHex(a).lerp(this.skyB.setHex(b), k);
    this.scene.background.copy(this.skyA); this.scene.fog.color.copy(this.skyA);
  }

  // bloom: only pixels brighter than white glow (emissive bulbs, signs), so cards at plain white never halo
  render() {
    for (const v of this.views) {
      this.frame(v);
      if (!v.composer) {
        v.composer = new EffectComposer(v.renderer);
        v.renderPass = new RenderPass(this.scene, v.camera); v.composer.addPass(v.renderPass);
        v.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 1.05); v.composer.addPass(v.bloom);
        v.composer.addPass(new OutputPass());
      }
      v.renderPass.scene = this.scene; v.renderPass.camera = v.camera;
      const W = v.canvas.clientWidth || 16, H = v.canvas.clientHeight || 9, pr = v.renderer.getPixelRatio();
      if (v.size !== W + "x" + H) { v.composer.setSize(W, H); v.composer.setPixelRatio(pr); v.size = W + "x" + H; }
      v.composer.render();
    }
  }

  reportOverflow(slot, text) { this.overflows.push({ slot, text, t: this.runner.t }); if (this.onOverflow) this.onOverflow(slot, text); }

  // ---------------------------------------------------------------- shared effects
  // a flat card that flies along an arc from one object to a point, then is removed (or kept)
  *fly(mesh, to, { dur = 0.8, arc = 0.8, spin = 0, keep = false, scaleTo = null } = {}) {
    const from = mesh.position.clone(), s0 = mesh.scale.x;
    yield* this.V.tween(dur, (t) => {
      mesh.position.lerpVectors(from, to, t); mesh.position.y += Math.sin(Math.PI * t) * arc;
      mesh.rotation.z = spin * t; if (scaleTo !== null) mesh.scale.setScalar(s0 + (scaleTo - s0) * t);
    });
    if (!keep) mesh.parent && mesh.parent.remove(mesh);
  }

  // confetti burst at a point (a short-lived updater)
  confetti(x, y, z, n = 70) {
    const cols = [0xffc857, 0x7b5cd6, 0x2bb673, 0xff8fa3, 0x7cc4ff];
    const g = new THREE.Group(); this.scene.add(g);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.12), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, toneMapped: false }));
      m.position.set(x, y, z); g.add(m);
      const a = (i / n) * Math.PI * 2, sp = 2 + ((i * 37) % 10) / 4;
      parts.push({ m, vx: Math.cos(a) * sp * 0.6, vy: 3 + ((i * 13) % 7) / 2, vz: Math.sin(a) * sp * 0.3, r: (i % 5) * 2 });
    }
    const t0 = this.runner.t;
    const upd = (t) => {
      const dt = t - t0;
      if (dt > 4 || dt < 0) { this.scene.remove(g); this.updaters.splice(this.updaters.indexOf(upd), 1); return; }
      for (const p of parts) { p.m.position.set(x + p.vx * dt, Math.max(0.02, y + p.vy * dt - 4.9 * dt * dt * 0.6), z + p.vz * dt); p.m.rotation.set(p.r * dt, p.r * dt * 0.7, 0); }
    };
    this.updaters.push(upd);
  }
}
