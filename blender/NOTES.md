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

- **Empty**: an invisible object that is only a position and a rotation. Our joints are empties with no rest
  rotation, placed at the pivots and named like the runtime's joints (`researcher > hop > body > head`;
  `body > shoulder_L > elbow_L > hand_L`, same for `_R`). The rigid parts (body, head, upper arm...) hang from them.
- **Armature / bones**: Blender's skeleton. **Not used**: a bone's axes follow the bone, so the first spike's
  "raise the arm" turned the wrong way. Figurines are rigid toys, so a skeleton gains nothing (no skin to bend, no
  weight painting).
- **Action**: a named animation clip (keyframes on rotations). Keyed per joint and placed on an **NLA track** named
  after the clip on every joint, so the exporter merges them into one glTF animation per clip
  (`export_nla_strips=True`).
- **Bake**: Cycles computes lighting once and writes it into a texture (or into per-vertex colours), so the browser
  shows soft shadows without computing them.
- **AO (ambient occlusion)**: the soft darkening where parts meet (base under body, chin under head). Baked into a
  colour attribute named `ao` and multiplied into the base colour, so it arrives in glTF as `COLOR_0` and Three.js
  applies it. **Only for parts that never move against each other** (base, body, head and what is fixed to them),
  with a short reach (`world.light_settings.distance = 0.15`). Moving parts (arms) are left out and get their own
  material copies: baked against the body at rest, they came out nearly black and stayed dark when raised.
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

## Axes and the runtime mapping (settled)

Blender is Z-up with the figure facing -Y; glTF and Three.js are Y-up facing +Z. Three `(x, y, z)` = Blender
`(x, z, -y)`, and the exporter converts. The runtime sets joints exactly as on the greybox (`src/world/figure.js`
`apply`): `shoulder.rotation.order = "ZXY"`, `rotation.x = -s` (swing forward), `rotation.z = side * r` (raise
sideways, side L = +1, R = -1), `elbow.rotation.x = -e`, `head.rotation = (nod, turn, tilt)`, `body.rotation =
(lean, 0, side)`. For a clip keyed in Blender the same values are: rot X = -s, rot Y = -(side * r), elbow rot X = -e.
Checked in `spike.html`: the Blender-keyed wave and the code-driven wave, cheer and point all match.

## Open items

1. **Baked surfaces under tone mapping.** Handled in the spike page: a surface with a baked emissive map is swapped
   for an unlit `MeshBasicMaterial` with `toneMapped: false`. Move this into the runtime's loader.
2. **Where the motion lives (settled with the spike).** The runtime's pose library and beats drive the Blender
   figurine's joints directly. Blender makes the figurines, materials and bakes, plus hand-keyed clips only for
   motions too intricate to script.
