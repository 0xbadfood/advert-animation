# Blender on this box: what works (the seed of a Blender skill)

Written 2026-11-13 from the spike (`blender/spike.py`, browser side `spike.html` + `src/spike.js`). The reader is an
agent continuing the work. The user is new to Blender, so new terms get one plain line where they first appear.

## Install (GB10, aarch64, Ubuntu)

- Blender publishes no Linux ARM64 build (checked up to 5.1.2), and PyPI's `bpy` module is x86_64 only on Linux.
  **Use Ubuntu's package: `sudo apt install blender python3-numpy` → Blender 4.0.2**, with system Python 3.12.
- `python3-numpy` is required: the glTF exporter imports numpy and Ubuntu does not pull it in.
- Rigify (rig generator) and the glTF exporter add-ons are present and enable headless.
- If a newer Blender is ever needed (5.x features, GPU bakes): run the official x64 build on ai@192.168.0.101 behind
  a small API, like the other render services. Nothing in our output depends on the Blender version (glTF is the
  contract).

## Running headless

```bash
blender -b --factory-startup -P blender/spike.py -- --out public/models/spike.glb --device CPU
```

`-b` means no window; `--factory-startup` ignores any user preferences; arguments after `--` go to the script.

## Gotchas found

| symptom | cause | fix |
|---|---|---|
| every Cycles render or bake fails ("Build without OpenImageDenoiser") or bakes come out black in 0.1 s | Ubuntu's build lacks Intel's denoiser and Cycles enables denoising by default | `scene.cycles.use_denoising = False` before any Cycles job |
| GPU (CUDA) bakes finish but are black | the build has no GPU kernels for the GB10 (sm_121); the device is listed anyway | bake on CPU (20 cores): a 1024² lighting bake at 64 samples is ~5 s, AO into colour attributes ~0.3 s |
| glTF export: `No module named 'numpy'` | see install | `apt install python3-numpy` |
| EEVEE (Blender's real-time renderer) | works headless here (64 samples, 64² in ~1 s) | usable for offline previews or a later ads render |

## Terms used in this project

- **Armature**: the skeleton object; **bones** are its joints. Our figurines are rigid toys, so each part (body,
  head, upper arm...) is parented to one bone. There is no skin to bend and no weight painting.
- **Action**: a named animation clip on the armature (keyframes on bone rotations). Each action is placed on its
  own **NLA track** so the GLB carries all of them (`export_nla_strips=True`).
- **Bake**: Cycles computes lighting once and writes it into a texture (or into per-vertex colours), so the browser
  shows soft shadows without computing them.
- **AO (ambient occlusion)**: the soft darkening where parts meet (base under body, chin under head). Baked into a
  colour attribute named `ao` and multiplied into the base colour, so it arrives in glTF as `COLOR_0` and Three.js
  applies it.
- **Lathe**: a shape made by spinning a profile around an axis (`bmesh.ops.spin`): how a turned figurine body is
  made.

## Export settings that work

`bpy.ops.export_scene.gltf(filepath=..., export_format="GLB", export_animations=True, export_nla_strips=True,
export_colors=True, export_apply=True, export_lights=False, export_cameras=False)`

The spike GLB is 0.9 MB: one figurine with 16 parts, a skeleton, 2 clips and a 1024² baked floor.

## What the browser receives (checked with GLTFLoader, three 0.180)

- node names as authored: the bones (`root, hop, body, head, shoulder.L/R, elbow.L/R`) and the parts;
- both clips by name (`idle` 2.0 s, `wave` 1.2 s), crossfading with `AnimationMixer`;
- `COLOR_0` on all 16 part meshes (the baked AO);
- the baked floor as an emissive texture.

## Open items found by the spike

1. **Bone axes.** A bone's own axes follow the bone (Y along it), so for a bone pointing down, "raise the arm
   sideways" is not the world axis the keys assumed: the spike's wave swings the wrong way. Settle a convention
   (bone roll set in code, so local X is forward-swing and local Z is raise for both arms), then map the runtime's
   joint values `s / r / e` onto it.
2. **Baked surfaces under tone mapping.** The emissive floor reads flat and washed-out under ACES. On load, give
   baked surfaces an unlit material with `toneMapped: false`.
3. **Where the motion lives.** The bone names arrive intact, so the runtime's existing pose library and beats
   (`src/world/figure.js`, the stations) can drive the Blender figurine's bones directly. Proposal: keep the motion
   in the runtime (one place, already tuned by the emulator); Blender makes the figurines, materials and bakes,
   plus hand-keyed clips only for motions too intricate to script.
