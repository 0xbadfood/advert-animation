import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// The Blender cast (blender/cast.py -> public/models/cast/<role>.glb). Each file's top node is the figure, named by
// its role, with the runtime's joints (hop, body, head, shoulder_X, elbow_X, hand_X) and face rig (eye_L, eye_R,
// mouth). Templates are cloned per figure; their geometry and materials are shared, marked so a world's dispose()
// leaves them alone.
export const ROLES = ["researcher", "writer", "director", "crew1", "crew2", "crew3", "crew4"];
let cache = null;

export function loadCast(base = "/models/cast/") {
  if (cache) return cache;
  const loader = new GLTFLoader();
  cache = Promise.all(ROLES.map((role) => loader.loadAsync(`${base}${role}.glb`).then((g) => {
    const root = g.scene.getObjectByName(role) || g.scene;
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.userData.shared = true;
      if (o.material) o.material.userData.shared = true;
    });
    root.removeFromParent();
    return [role, root];
  }))).then(Object.fromEntries);
  return cache;
}

// load if present; the runtime falls back to the greybox figures when the models are missing
export async function tryLoadCast() {
  try { return await loadCast(); } catch (e) { console.warn("cast models not loaded, using greybox figures", e); return null; }
}

export function cloneFigure(template) { return template.clone(true); }

// the set dressing (blender/set.py -> public/models/set.glb): one group per station, placed in world coordinates
let setCache = null;
export function loadSet(url = "/models/set.glb") {
  if (setCache) return setCache;
  setCache = new GLTFLoader().loadAsync(url).then((g) => {
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = true; o.userData.shared = true;
      if (o.material) o.material.userData.shared = true;
    });
    return g.scene;
  });
  return setCache;
}
export async function tryLoadSet() {
  try { return await loadSet(); } catch (e) { console.warn("set dressing not loaded", e); return null; }
}
void THREE;
