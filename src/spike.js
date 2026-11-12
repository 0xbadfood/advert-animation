// Blender spike, browser side (DESIGN.md build order step 2): the GLB that blender/spike.py exports, played by
// Three.js. Proves: meshes and lacquer materials arrive, the baked AO (COLOR_0) shades the parts, and the joints are
// axis-free pivots named like the runtime's, so they move two ways:
//   - a clip keyed in Blender ("wave"), through AnimationMixer;
//   - the runtime's own pose library (src/world/figure.js POSES) set directly on the joints, as on the greybox.
// ?mode=clip | code picks one (default: alternate every 3 s).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { POSES } from "./world/figure.js";

const canvas = document.getElementById("c"), info = document.getElementById("info");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeee6ff);
scene.add(new THREE.HemisphereLight(0xf5efff, 0xb9a6f2, 1.3));
const key = new THREE.DirectionalLight(0xfff4e6, 2.0); key.position.set(-2, 4, 3); scene.add(key);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50); camera.position.set(0, 1.0, 3.6); camera.lookAt(0, 0.55, 0);

const REST = { lean: 0, side: 0, headTilt: 0, headTurn: 0, headNod: 0, sL: 0.08, rL: 0.14, eL: 0.25, sR: 0.08, rR: 0.14, eR: 0.25 };
const state = (window.__spike = { loaded: false, clips: [], mode: "", error: "" });

new GLTFLoader().load("/models/spike.glb", (gltf) => {
  scene.add(gltf.scene);
  // baked surfaces show their bake as is (unlit, not tone mapped)
  gltf.scene.traverse((o) => { if (o.isMesh && o.material.emissiveMap) o.material = new THREE.MeshBasicMaterial({ map: o.material.emissiveMap, toneMapped: false }); });
  const j = (n) => gltf.scene.getObjectByName(n);
  const joints = { body: j("body"), head: j("head"), sL: j("shoulder_L"), eL: j("elbow_L"), sR: j("shoulder_R"), eR: j("elbow_R") };
  ["sL", "sR"].forEach((k) => (joints[k].rotation.order = "ZXY"));
  state.joints = Object.fromEntries(Object.entries(joints).map(([k, v]) => [k, !!v]));
  // the runtime's mapping, unchanged from the greybox figure (figure.js apply)
  const apply = (p) => {
    joints.body.rotation.set(p.lean, 0, p.side);
    joints.head.rotation.set(p.headNod, p.headTurn, p.headTilt);
    joints.sL.rotation.x = -p.sL; joints.sL.rotation.z = p.rL; joints.eL.rotation.x = -p.eL;
    joints.sR.rotation.x = -p.sR; joints.sR.rotation.z = -p.rR; joints.eR.rotation.x = -p.eR;
  };
  state.pose = (name) => { apply({ ...REST, ...(POSES[name] || {}) }); state.mode = "code:" + name; };

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const acts = Object.fromEntries(gltf.animations.map((c) => [c.name, mixer.clipAction(c)]));
  state.clips = gltf.animations.map((c) => `${c.name} ${c.duration.toFixed(2)} s`);
  state.colors = []; gltf.scene.traverse((o) => { if (o.isMesh && o.geometry.attributes.color) state.colors.push(o.name); });
  state.clip = (name, at = 0.5) => { mixer.stopAllAction(); const a = acts[name]; a.reset().play(); mixer.setTime(at); state.mode = "clip:" + name; };

  const mode = new URLSearchParams(location.search).get("mode");
  const codePoses = ["wave", "cheer", "point", "think", "offer"];
  let t = 0, n = 0;
  const clock = new THREE.Clock();
  (function loop() {
    const dt = clock.getDelta(); t += dt;
    if (Math.floor(t / 3) !== Math.floor((t - dt) / 3) || !state.mode) {
      n++;
      if (mode === "clip" || (!mode && n % 2)) { mixer.stopAllAction(); acts.wave.reset().setLoop(THREE.LoopRepeat).play(); state.mode = "clip:wave"; }
      else { mixer.stopAllAction(); state.pose(codePoses[n % codePoses.length]); }
    }
    if (state.mode.startsWith("clip")) mixer.update(dt);
    const W = canvas.clientWidth, H = canvas.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.render(scene, camera); info.textContent = `${state.mode} · clips: ${state.clips.join(", ")} · baked AO on ${state.colors.length} parts`;
    requestAnimationFrame(loop);
  })();
  state.loaded = true;
}, undefined, (err) => { state.error = String(err); info.textContent = "could not load: " + err; });
