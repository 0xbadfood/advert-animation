import * as THREE from "three";
import { Slot } from "../world/slot.js";

// Helpers every station uses: placed slots, a slot that is a free-flying card, easels and boards.

export function panel(world, name, { x, y, z, w, h, rotY = 0, kind = "card", placeholder = "", px = 360, frame = true, frameColor, transparent = false, hidden = false, glow = false }) {
  const s = new Slot(world, name, { w, h, kind, placeholder, px, frame, frameColor, transparent, glow });
  s.group.position.set(x, y, z); s.group.rotation.y = rotY;
  world.scene.add(s.group);
  if (hidden) s.group.visible = false;
  return s;
}

// a holo stand under a floating panel: a thin glowing post and a disc, so panels read as objects in the room
export function stand(world, x, z, height, color = 0xb9a6f2) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, height, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 }));
  post.position.y = height / 2; g.add(post);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x5b3fd1, roughness: 0.3 }));
  disc.position.y = 0.025; disc.castShadow = true; g.add(disc);
  g.position.set(x, 0, z); world.scene.add(g); return g;
}

export function easel(world, x, z, rotY = 0, h = 2.1) {
  const g = new THREE.Group(); const wood = 0xc79a6b;
  for (const sx of [-0.35, 0.35]) { const leg = world.box(0.06, h, 0.06, wood, sx, h / 2, 0, g); leg.rotation.z = -sx * 0.12; }
  const back = world.box(0.06, h * 0.95, 0.06, wood, 0, h * 0.47, -0.35, g); back.rotation.x = 0.2;
  world.box(0.9, 0.06, 0.12, wood, 0, h * 0.28, 0.04, g);
  g.position.set(x, 0, z); g.rotation.y = rotY; world.scene.add(g); return g;
}

// glow a slot's frame briefly (comparisons, attention)
export function* flash(world, slot, color = 0xffc857, dur = 0.7) {
  const fr = slot.frame; if (!fr) return;
  const m = fr.material, e0 = m.emissive.getHex(), i0 = m.emissiveIntensity;
  m.emissive.setHex(color);
  yield* world.V.tween(dur, (t) => { m.emissiveIntensity = Math.sin(Math.PI * t) * 1.2; });
  m.emissive.setHex(e0); m.emissiveIntensity = i0;
}

// a tiny glowing orb that travels between two points (data flowing)
export function* orb(world, from, to, { dur = 0.9, color = 0xffc857, arc = 0.6 } = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  m.position.copy(from); world.scene.add(m);
  yield* world.fly(m, to, { dur, arc });
}

// run several figure verbs together
export function* together(V, ...gens) { yield* V.all(...gens); }

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
