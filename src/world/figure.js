import * as THREE from "three";

// Greybox figurine: the joint layout the Blender rig will keep (base, hop, body, head, two arms with shoulder, elbow,
// mitten), built from primitives so pacing can be tuned before the real meshes exist. Poses are data; every pose and
// action plays on every figure.

// joint values (radians unless noted). Arms: s = swing forward, r = raise sideways, e = elbow bend.
const REST = { hop: 0, squash: 0, lean: 0, side: 0, headTilt: 0, headTurn: 0, headNod: 0,
  sL: 0.08, rL: 0.14, eL: 0.25, sR: 0.08, rR: 0.14, eR: 0.25, smile: 0.4 };

export const POSES = {
  stand: {},
  think: { sR: 1.25, rR: 0.25, eR: 2.3, sL: 0.55, rL: 0.05, eL: 1.5, headTilt: 0.18, headTurn: 0.25, headNod: -0.12, lean: -0.04, smile: 0.2 },
  point: { sR: 1.45, rR: 0.35, eR: 0.08, headTurn: -0.3, lean: 0.05, smile: 0.7 },
  pointL: { sL: 1.45, rL: 0.35, eL: 0.08, headTurn: 0.3, lean: 0.05, smile: 0.7 },
  cheer: { sL: 0.25, rL: 2.65, eL: 0.25, sR: 0.25, rR: 2.65, eR: 0.25, headNod: -0.25, smile: 1 },
  hold: { sL: 0.95, rL: 0.12, eL: 0.95, sR: 0.95, rR: 0.12, eR: 0.95, headNod: 0.2, smile: 0.5 },
  offer: { sL: 1.25, rL: 0.1, eL: 0.35, sR: 1.25, rR: 0.1, eR: 0.35, lean: 0.12, smile: 0.9 },
  write: { sR: 0.85, rR: 0.12, eR: 1.45, sL: 0.7, rL: 0.08, eL: 1.3, lean: 0.12, headNod: 0.35, smile: 0.3 },
  read: { sL: 0.95, rL: 0.08, eL: 1.55, sR: 0.95, rR: 0.08, eR: 1.55, headNod: 0.32, smile: 0.4 },
  wave: { sR: 0.25, rR: 2.4, eR: 0.7, smile: 1, headTilt: -0.12 },
  shrug: { sL: 0.35, rL: 0.7, eL: 1.7, sR: 0.35, rR: 0.7, eR: 1.7, headTilt: 0.25, smile: 0 },
  sing: { sR: 1.0, rR: 0.7, eR: 0.35, headNod: -0.3, smile: 0.8 },
  paint: { sR: 1.65, rR: 0.15, eR: 0.55, sL: 0.3, rL: 0.2, eL: 1.0, lean: 0.08, headNod: -0.1, smile: 0.6 },
  conduct: { sR: 1.2, rR: 0.55, eR: 0.75, sL: 0.6, rL: 0.4, eL: 0.9, smile: 0.8 },
  lookUp: { headNod: -0.45, smile: 0.6 },
  nod: { headNod: 0.3 },
  stamp: { sR: 1.1, rR: 0.1, eR: 1.6, lean: 0.15, headNod: 0.3 },
  thumbs: { sR: 1.2, rR: 0.2, eR: 1.9, smile: 1 },
  sad: { lean: 0.12, headNod: 0.45, sL: -0.05, rL: 0.05, eL: 0.05, sR: -0.05, rR: 0.05, eR: 0.05, smile: -0.6 },
};

const toon = (color, rough = 0.32) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });

export class Figure {
  constructor(world, spec) {
    this.world = world; this.spec = spec; this.name = spec.name;
    this.j = { ...REST }; this.blinkSeed = (spec.seed || 1) * 1.37;
    const root = (this.root = new THREE.Group()); root.name = "fig:" + spec.name;
    const s = spec.scale || 1; root.scale.setScalar(s);

    // base: a round lacquered stand with a gold rim (it reads "figurine")
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.08, 40), toon(spec.base || 0x3b2f73, 0.25));
    base.position.y = 0.04; base.castShadow = base.receiveShadow = true; root.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.012, 8, 48), toon(0xffc857, 0.2)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.08; root.add(rim);

    this.hop = new THREE.Group(); this.hop.position.y = 0.08; root.add(this.hop);
    this.body = new THREE.Group(); this.hop.add(this.body);
    const prof = [[0, 0], [0.25, 0], [0.27, 0.06], [0.25, 0.3], [0.2, 0.52], [0.13, 0.6], [0, 0.62]].map(([x, y]) => new THREE.Vector2(x, y));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), toon(spec.color)); torso.castShadow = true; this.body.add(torso);
    if (spec.inner) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 0.36, 24, 1, true, -0.6, 1.2), toon(spec.inner)); band.position.set(0, 0.36, 0.13); band.rotation.y = 0; this.body.add(band); }
    if (spec.apron) { const ap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.42, 24, 1, true, -0.7, 1.4), toon(0xf6f1ea)); ap.position.set(0, 0.22, 0.012); this.body.add(ap); }
    if (spec.scarf) { const sc = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.05, 12, 28), toon(spec.scarf)); sc.rotation.x = Math.PI / 2; sc.position.y = 0.6; this.body.add(sc);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.04), toon(spec.scarf)); tail.position.set(0.08, 0.48, 0.15); tail.rotation.z = 0.2; this.body.add(tail); }

    // head
    this.head = new THREE.Group(); this.head.position.y = 0.64; this.body.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 24), toon(spec.skin, 0.45)); skull.position.y = 0.22; skull.castShadow = true; this.head.add(skull);
    const eyeM = toon(0x1d1838, 0.15);
    this.eyes = [-1, 1].map((sx) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), eyeM); e.position.set(sx * 0.085, 0.25, 0.225); e.scale.z = 0.5; this.head.add(e); return e; });
    // painted mouth: a thin torus arc whose curvature follows `smile`
    this.mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 6, 20, Math.PI), toon(0x7a2b3a, 0.4));
    this.mouth.position.set(0, 0.165, 0.228); this.head.add(this.mouth);
    const cheekM = new THREE.MeshStandardMaterial({ color: 0xff8fa3, roughness: 0.6, transparent: true, opacity: 0.45 });
    [-1, 1].forEach((sx) => { const ck = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), cheekM); ck.position.set(sx * 0.14, 0.19, 0.205); ck.rotation.y = sx * 0.55; this.head.add(ck); });
    this.addHair(spec);

    // arms
    this.arms = {};
    for (const side of ["L", "R"]) {
      const sx = side === "L" ? 1 : -1;
      const sh = new THREE.Group(); sh.position.set(sx * 0.19, 0.52, 0); sh.rotation.order = "ZXY"; this.body.add(sh);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 6, 12), toon(spec.sleeve || spec.color)); upper.position.y = -0.1; upper.castShadow = true; sh.add(upper);
      const el = new THREE.Group(); el.position.y = -0.2; sh.add(el);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.13, 6, 12), toon(spec.sleeve || spec.color)); fore.position.y = -0.08; el.add(fore);
      const hand = new THREE.Group(); hand.position.y = -0.19; el.add(hand);
      const mitten = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), toon(spec.skin, 0.45)); hand.add(mitten);
      this.arms[side] = { sh, el, hand };
    }
    this.apply(0);
    world.scene.add(root);
    world.figures.push(this);
  }

  addHair(spec) {
    const hm = toon(spec.hair || 0x3a2a20, 0.55), h = this.head;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hm); cap.position.y = 0.23; cap.rotation.x = -0.25; h.add(cap);
    if (spec.curly) for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), hm); b.position.set(Math.cos(a) * 0.19, 0.38 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.17 - 0.03); h.add(b); }
    if (spec.ponytail) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), hm); p.position.set(0, 0.32, -0.27); p.scale.set(0.8, 1.3, 0.8); h.add(p); }
    if (spec.longHair) { const lh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.3, 24, 1, true, Math.PI * 0.6, Math.PI * 0.8), hm); lh.position.set(0, 0.12, -0.02); h.add(lh); }   // theta 0.6π..1.4π is the back of the head
    if (spec.glasses) { const gm = toon(0x1d1838, 0.2); [-1, 1].forEach((sx) => { const g = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 8, 24), gm); g.position.set(sx * 0.085, 0.25, 0.235); h.add(g); }); const br = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.01), gm); br.position.set(0, 0.26, 0.24); h.add(br); }
    if (spec.beard) { const bd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.4), hm); bd.position.set(0, 0.24, 0.03); h.add(bd); }
    if (spec.hat === "flatcap") { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.09, 28), toon(spec.hatColor || 0x4a3b33)); c.position.set(0, 0.44, -0.01); c.rotation.x = -0.12; h.add(c); const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.14), toon(spec.hatColor || 0x4a3b33)); brim.position.set(0, 0.41, 0.24); brim.rotation.x = 0.15; h.add(brim); }
    if (spec.hat === "cap") { const c = new THREE.Mesh(new THREE.SphereGeometry(0.255, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), toon(spec.hatColor)); c.position.y = 0.25; h.add(c); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 20, 1, false, 0, Math.PI), toon(spec.hatColor)); brim.position.set(0, 0.33, -0.22); brim.rotation.y = Math.PI / 2; h.add(brim); }
    if (spec.hat === "beret") { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 0.07, 28), toon(spec.hatColor)); c.position.set(0.04, 0.45, 0); c.rotation.z = -0.25; h.add(c); }
    if (spec.headphones) { const hp = toon(0x2d2550, 0.3); const band = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 8, 32, Math.PI), hp); band.position.y = 0.24; h.add(band);
      [-1, 1].forEach((sx) => { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), toon(spec.headphones)); cup.rotation.z = Math.PI / 2; cup.position.set(sx * 0.25, 0.22, 0); h.add(cup); }); }
  }

  // ---------------------------------------------------------------- pose application
  apply(t) {
    const j = this.j, spec = this.spec;
    const breath = Math.sin(t * 2.1 + this.blinkSeed) * 0.012;
    this.hop.position.y = 0.08 + j.hop;
    const sq = j.squash;
    this.body.scale.set(1 + sq * 0.5, 1 - sq + breath, 1 + sq * 0.5);
    this.body.rotation.set(j.lean, 0, j.side);
    this.head.rotation.set(j.headNod + Math.sin(t * 0.9 + this.blinkSeed) * 0.015, j.headTurn, j.headTilt);
    // blink: a quick close every few seconds, stable per figure
    const ph = (t + this.blinkSeed * 3.1) % 3.7;
    const blink = ph < 0.12 ? 1 - Math.abs(ph - 0.06) / 0.06 : 0;
    this.eyes.forEach((e) => { e.scale.y = Math.max(0.12, 1 - blink); });
    const sm = j.smile;
    this.mouth.rotation.z = sm >= 0 ? Math.PI : 0; this.mouth.scale.set(1, 0.4 + Math.abs(sm) * 0.8, 1);
    this.mouth.position.y = sm >= 0 ? 0.175 : 0.15;
    for (const side of ["L", "R"]) {
      const a = this.arms[side], sx = side === "L" ? 1 : -1;
      a.sh.rotation.x = -j["s" + side]; a.sh.rotation.z = sx * j["r" + side];
      a.el.rotation.x = -j["e" + side];
    }
    void spec;
  }

  // ---------------------------------------------------------------- verbs (generators on the story clock)
  *pose(name, dur = 0.45, e) {
    const to = { ...REST, ...(POSES[name] || {}) };
    const from = { ...this.j }, keys = Object.keys(REST).filter((k) => k !== "hop" && k !== "squash");
    yield* this.world.V.tween(dur, (t) => { for (const k of keys) this.j[k] = from[k] + (to[k] - from[k]) * t; }, e);
  }

  // set a pose instantly (catch-up, setup)
  snap(name) { Object.assign(this.j, REST, POSES[name] || {}); }

  // a small anticipation-hop in place (squash, lift, land)
  *bounce(h = 0.12, dur = 0.45) {
    const V = this.world.V, j = this.j;
    yield* V.tween(dur * 0.25, (t) => { j.squash = 0.12 * t; });
    yield* V.tween(dur * 0.5, (t) => { j.squash = 0.12 * (1 - t) - 0.06 * Math.sin(Math.PI * t); j.hop = h * Math.sin(Math.PI * t); }, (t) => t);
    yield* V.tween(dur * 0.25, (t) => { j.squash = 0.1 * Math.sin(Math.PI * t); j.hop = 0; });
  }

  // hop to (x, z) in world units, turning toward the motion, then face `faceYaw` (0 = camera)
  *hopTo(x, z, { faceYaw = 0, stride = 0.55, hopH = 0.14, perHop = 0.34 } = {}) {
    const V = this.world.V, r = this.root, j = this.j;
    r.visible = true;
    const x0 = r.position.x, z0 = r.position.z, dx = x - x0, dz = z - z0, dist = Math.hypot(dx, dz);
    if (dist < 0.01) { yield* this.turnTo(faceYaw); return; }
    const yaw = Math.atan2(dx, dz);
    yield* this.turnTo(yaw, 0.18);
    const n = Math.max(1, Math.round(dist / stride));
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      yield* V.tween(perHop * 0.2, (t) => { j.squash = 0.1 * t; });
      yield* V.tween(perHop * 0.65, (t) => {
        r.position.x = x0 + dx * (a + (b - a) * t); r.position.z = z0 + dz * (a + (b - a) * t);
        j.hop = hopH * Math.sin(Math.PI * t); j.squash = 0.1 * (1 - t) - 0.08 * Math.sin(Math.PI * t);
      }, (t) => t);
      yield* V.tween(perHop * 0.15, (t) => { j.hop = 0; j.squash = 0.08 * Math.sin(Math.PI * t); });
    }
    yield* this.turnTo(faceYaw, 0.22);
  }

  *turnTo(yaw, dur = 0.25) {
    const r = this.root, y0 = r.rotation.y;
    let d = yaw - y0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    yield* this.world.V.tween(dur, (t) => { r.rotation.y = y0 + d * t; });
  }

  // wiggle a joint around its current value (scribble, wave, paint strokes)
  *wiggle(key, amp = 0.25, cycles = 3, dur = 1.2) {
    const base = this.j[key];
    yield* this.world.V.tween(dur, (t) => { this.j[key] = base + amp * Math.sin(t * cycles * Math.PI * 2); }, (t) => t);
    this.j[key] = base;
  }

  place(x, z, yaw = 0) { this.root.position.set(x, 0, z); this.root.rotation.y = yaw; }

  hold(obj, side = "R") { this.arms[side].hand.add(obj); return obj; }
}
