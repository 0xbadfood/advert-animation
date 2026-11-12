import * as THREE from "three";
import { makeVerbs } from "../story/runner.js";

// The studio: one scene, stations laid out left to right along x, a camera "focus" that trucks between station
// framings, and any number of views (desktop 16:9, phone 9:16) that each frame the focus for their own aspect.
export const STATION_GAP = 13;
export const PALETTE = { floor: 0xe2d8fb, wall: 0xf1eaff, rug: 0xcfc0f7, violet: 0x5b3fd1, gold: 0xffc857, lilac: 0xb9a6f2, wood: 0xc79a6b, desk: 0xf6f2ff };

export class World {
  constructor(runner, views = []) {
    this.runner = runner; this.V = makeVerbs(runner);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeee6ff);
    this.scene.fog = new THREE.Fog(0xeee6ff, 34, 70);
    this.slots = {}; this.figures = []; this.stations = {}; this.updaters = []; this.views = views;
    this.silent = false; this.overflows = []; this.onOverflow = null;
    this.focus = { x: 0, y: 1.4, z: 0, w: 9, h: 5, tw: 5, th: 8 };
    this.buildStudio();
  }

  buildStudio() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xf5efff, 0xb9a6f2, 1.25));
    const key = (this.key = new THREE.DirectionalLight(0xfff4e6, 2.1));
    key.position.set(-6, 12, 9); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 40; key.shadow.bias = -0.0004; key.shadow.radius = 4;
    s.add(key); s.add(key.target);
    const rim = new THREE.DirectionalLight(0xffd59a, 0.9); rim.position.set(5, 6, -8); s.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshStandardMaterial({ color: PALETTE.floor, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(200, 14), new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.95 }));
    wall.position.set(60, 7, -4.2); wall.receiveShadow = true; s.add(wall);
    // tall windows on the back wall, one pair per station, for rhythm
    const winM = new THREE.MeshBasicMaterial({ color: 0xfbf8ff, toneMapped: false });
    for (let i = -1; i < 9; i++) for (const dx of [-3.8, 3.8]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.6), winM); w.position.set(i * STATION_GAP + dx, 5.4, -4.18); s.add(w);
    }
  }

  // a round rug that marks a station
  rug(x, r = 4.2) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshStandardMaterial({ color: PALETTE.rug, roughness: 0.95 }));
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return { canvas, renderer, camera: new THREE.PerspectiveCamera(32, 1, 0.1, 100) };
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
    for (const v of this.views) v.renderer.renderLists.dispose();
  }

  // frame the focus for this view's aspect: wide views fit (w, h), tall views fit (tw, th)
  frame(v) {
    const W = v.canvas.clientWidth || 16, H = v.canvas.clientHeight || 9, aspect = W / H;
    v.renderer.setSize(W, H, false); v.camera.aspect = aspect;
    const f = this.focus, tall = aspect < 1;
    const bw = tall ? f.tw : f.w, bh = tall ? f.th : f.h;
    const vfov = THREE.MathUtils.degToRad(v.camera.fov);
    const distH = bh / 2 / Math.tan(vfov / 2), distW = bw / 2 / (Math.tan(vfov / 2) * aspect);
    const dist = Math.max(distH, distW) + 0.5;
    const dir = new THREE.Vector3(0, tall ? 0.26 : 0.3, 1).normalize();
    v.camera.position.set(f.x + dir.x * dist, f.y + dir.y * dist, f.z + dir.z * dist);
    v.camera.lookAt(f.x, f.y, f.z);
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
  }

  render() { for (const v of this.views) { this.frame(v); v.renderer.render(this.scene, v.camera); } }

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
