import * as THREE from "three";
import { Figure } from "./figure.js";

// The cast (DESIGN.md section 4): three leads and four crew members, all on one rig. The role reads from silhouette,
// props and colour. Skin tones vary across the cast on purpose.
export const CAST = {
  researcher: { name: "researcher", color: 0xf4f3f8, inner: 0x3d6fe0, sleeve: 0xf4f3f8, skin: 0xf0c7a2, hair: 0x2b211c, curly: true, glasses: true, base: 0x2e4aa8, seed: 1 },
  writer: { name: "writer", color: 0xe8b23a, inner: 0xffffff, skin: 0xe2b48c, hair: 0x7a4a2a, ponytail: true, base: 0xa86f12, seed: 2 },
  director: { name: "director", color: 0x7a4b2a, inner: 0xf2e6d6, sleeve: 0xf2e6d6, skin: 0xc98e64, hair: 0x2b1d16, beard: true, hat: "flatcap", hatColor: 0x3f332d, scarf: 0xd2343f, base: 0x4d2e18, seed: 3 },
  crew1: { name: "crew1", color: 0x7b5cd6, skin: 0xf3d0b0, hair: 0x3a2418, longHair: true, headphones: 0xb9a6f2, base: 0x4b2db5, seed: 4 },
  crew2: { name: "crew2", color: 0x8c2f4a, skin: 0xa9714b, hair: 0x1c1410, hat: "cap", hatColor: 0x8c2f4a, base: 0x5a1b2e, seed: 5 },
  crew3: { name: "crew3", color: 0x4caf6e, skin: 0x8d5a3b, hair: 0x15100d, longHair: true, base: 0x2c7a48, seed: 6 },
  crew4: { name: "crew4", color: 0x5b7fd6, skin: 0xe9be97, hair: 0x5a3622, hat: "beret", hatColor: 0xc8344a, apron: true, base: 0x34508f, seed: 7 },
};

export function makeFigure(world, role, x = 0, z = 0, yaw = 0) {
  const f = new Figure(world, { ...CAST[role] });
  f.place(x, z, yaw);
  f.root.visible = false;            // waiting in the wings: shown when it makes its entrance (hopTo)
  return f;
}

// ---------------------------------------------------------------- props (greybox)
const mat = (color, rough = 0.35, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05, ...extra });

export const props = {
  magnifier() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 10, 28), mat(0x3d3360)); ring.position.y = -0.17; g.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.095, 28), new THREE.MeshPhysicalMaterial({ color: 0xcfe9ff, roughness: 0.05, transmission: 0.6, transparent: true, opacity: 0.6 })); lens.position.y = -0.17; g.add(lens);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), mat(0x3d3360)); handle.position.y = -0.03; g.add(handle);
    g.rotation.x = Math.PI / 2;
    return g;
  },
  notebook() { const g = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.26), mat(0x6c4bd6)); g.position.set(0, -0.03, 0.06); return g; },
  pen() { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 8), mat(0x2b2550)); g.rotation.x = Math.PI / 2.5; g.position.z = 0.04; return g; },
  megaphone() {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.035, 0.24, 20, 1, true), mat(0x7b5cd6, 0.3, { side: THREE.DoubleSide })); cone.rotation.x = Math.PI / 2; cone.position.z = 0.14; g.add(cone);
    return g;
  },
  pointer() { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.6, 8), mat(0x5a3a22)); g.rotation.x = Math.PI / 2; g.position.z = 0.28; return g; },
  wand() { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.38, 8), mat(0x2b2550)); s.rotation.x = Math.PI / 2; s.position.z = 0.18; g.add(s);
    const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), mat(0xffc857, 0.2, { emissive: 0xffb020, emissiveIntensity: 1.2 })); star.position.z = 0.38; g.add(star); return g; },
  brush() { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.22, 8), mat(0xc8a06a)); s.rotation.x = Math.PI / 2; s.position.z = 0.1; g.add(s);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 8), mat(0xd2343f)); tip.rotation.x = Math.PI / 2; tip.position.z = 0.23; g.add(tip); return g; },
  stamp() { const g = new THREE.Group(); const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), mat(0x2b2550)); g.add(h);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 18), mat(0x2bb673)); b.position.y = -0.07; g.add(b); return g; },
  mug() { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.12, 18), mat(0xffffff)); g.position.y = 0.06; return g; },
  clapper() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.15, 0.03), mat(0x26214a)); g.add(b);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.03), mat(0xf4f3f8)); top.position.y = 0.1; g.add(top); g.position.z = 0.08; return g; },
  laptop() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.3), mat(0xb8b3d6)); g.add(b);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.02), mat(0xb8b3d6)); s.position.set(0, 0.14, -0.15); s.rotation.x = -0.25; g.add(s);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), new THREE.MeshBasicMaterial({ color: 0x8fb4ff, toneMapped: false })); scr.position.set(0, 0.14, -0.138); scr.rotation.x = -0.25; g.add(scr); return g; },
};
