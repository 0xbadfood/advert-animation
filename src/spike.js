// Blender spike, browser side (DESIGN.md build order step 2): the GLB that blender/spike.py exports, played by
// Three.js. Proves: meshes and lacquer materials arrive, the baked AO (COLOR_0) shades the parts, the baked floor
// texture shows its shadows, and the skeleton's named clips play and crossfade (idle -> wave -> idle).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const canvas = document.getElementById("c"), info = document.getElementById("info");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeee6ff);
scene.add(new THREE.HemisphereLight(0xf5efff, 0xb9a6f2, 1.3));
const key = new THREE.DirectionalLight(0xfff4e6, 2.0); key.position.set(-2, 4, 3); scene.add(key);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50); camera.position.set(0, 1.0, 3.6); camera.lookAt(0, 0.55, 0);

const state = (window.__spike = { loaded: false, clips: [], playing: "", error: "" });
new GLTFLoader().load("/models/spike.glb", (gltf) => {
  scene.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const acts = Object.fromEntries(gltf.animations.map((c) => [c.name, mixer.clipAction(c)]));
  state.clips = gltf.animations.map((c) => `${c.name} ${c.duration.toFixed(2)} s`);
  state.colors = []; gltf.scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.color) state.colors.push(o.name); });
  acts.idle.play(); state.playing = "idle";
  // every 3 s: crossfade idle -> wave, then back (the runtime's beat boundary, in miniature)
  let t = 0;
  state.wave = () => { acts.wave.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.25).play(); acts.wave.clampWhenFinished = true; acts.idle.fadeOut(0.25); state.playing = "wave"; };
  mixer.addEventListener("finished", () => { acts.idle.reset().fadeIn(0.3).play(); acts.wave.fadeOut(0.3); state.playing = "idle"; });
  const clock = new THREE.Clock();
  state.step = (dt) => { t += dt; mixer.update(dt); };
  (function loop() {
    const dt = clock.getDelta(); state.step(dt);
    if (Math.floor(t / 3) !== Math.floor((t - dt) / 3) && state.playing === "idle") state.wave();
    const W = canvas.clientWidth, H = canvas.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.render(scene, camera); requestAnimationFrame(loop);
  })();
  state.loaded = true;
  info.textContent = `clips: ${state.clips.join(", ")} · baked AO on ${state.colors.length} parts · playing: idle, a wave every 3 s`;
}, undefined, (err) => { state.error = String(err); info.textContent = "could not load: " + err; });
