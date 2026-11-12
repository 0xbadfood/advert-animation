// The cast lineup: the seven Blender figurines (public/models/cast/*.glb) side by side, each cycling through the
// runtime's pose library, set on its joints exactly as the story does. ?pose=<name> holds one pose for all.
import * as THREE from "three";
import { loadCast } from "./world/models.js";
import { POSES } from "./world/figure.js";

const canvas = document.getElementById("c"), info = document.getElementById("info");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeee6ff);
scene.add(new THREE.HemisphereLight(0xf5efff, 0xb9a6f2, 1.25));
const key = new THREE.DirectionalLight(0xfff4e6, 2.1); key.position.set(-4, 7, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 4, bottom: -2 }); key.shadow.radius = 4; scene.add(key);
const rim = new THREE.DirectionalLight(0xffd59a, 0.8); rim.position.set(3, 4, -5); scene.add(rim);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshStandardMaterial({ color: 0xe2d8fb, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100); camera.position.set(0, 1.6, 7.2); camera.lookAt(0, 0.65, 0);

const REST = { lean: 0, side: 0, headTilt: 0, headTurn: 0, headNod: 0, sL: 0.08, rL: 0.14, eL: 0.25, sR: 0.08, rR: 0.14, eR: 0.25, smile: 0.4 };
const NAMES = ["researcher", "writer", "director", "crew1", "crew2", "crew3", "crew4"];
const held = new URLSearchParams(location.search).get("pose");
const state = (window.__cast = { loaded: false, error: "" });

loadCast().then((cast) => {
  const figs = NAMES.map((n, i) => {
    const root = cast[n].clone(true); root.position.x = (i - 3) * 0.95; scene.add(root);
    const g = (k) => root.getObjectByName(k);
    const f = { root, body: g("body"), head: g("head"), sL: g("shoulder_L"), eL: g("elbow_L"), sR: g("shoulder_R"), eR: g("elbow_R"), eyes: [g("eye_L"), g("eye_R")], mouth: g("mouth") };
    f.sL.rotation.order = f.sR.rotation.order = "ZXY";
    f.mouthY = f.mouth.position.y;
    return f;
  });
  const apply = (f, p, t, k) => {
    f.body.rotation.set(p.lean, 0, p.side); f.head.rotation.set(p.headNod, p.headTurn, p.headTilt);
    f.sL.rotation.x = -p.sL; f.sL.rotation.z = p.rL; f.eL.rotation.x = -p.eL;
    f.sR.rotation.x = -p.sR; f.sR.rotation.z = -p.rR; f.eR.rotation.x = -p.eR;
    const ph = (t + k * 1.3) % 3.7, blink = ph < 0.12 ? 1 - Math.abs(ph - 0.06) / 0.06 : 0;
    f.eyes.forEach((e) => (e.scale.y = Math.max(0.12, 1 - blink) * 1.18));
    f.mouth.rotation.z = p.smile >= 0 ? Math.PI : 0; f.mouth.scale.y = 0.4 + Math.abs(p.smile) * 0.8;
  };
  state.setPose = (name) => { state.pose = name; };
  const poses = ["stand", "wave", "think", "cheer", "point", "offer", "read", "shrug", "paint", "sing"];
  state.pose = held || "stand";
  const clock = new THREE.Clock(); let t = 0;
  (function loop() {
    t += clock.getDelta();
    if (!held) state.pose = poses[Math.floor(t / 2) % poses.length];
    figs.forEach((f, k) => apply(f, { ...REST, ...(POSES[state.pose] || {}) }, t, k));
    const W = canvas.clientWidth, H = canvas.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.render(scene, camera); info.textContent = `${NAMES.join(" · ")} — pose: ${state.pose}`;
    requestAnimationFrame(loop);
  })();
  state.loaded = true;
}).catch((e) => { state.error = String(e); info.textContent = "could not load the cast: " + e; });
