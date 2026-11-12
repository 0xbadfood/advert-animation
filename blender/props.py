"""The station props: the functional pieces at the cast's finish, as named templates in one GLB.

    blender -b --factory-startup -P blender/props.py -- --out public/models/props.glb

Each template's top node is prop_<name>, built at the origin and sized like the runtime primitive it replaces, so a
station swaps it in where the primitive was (and keeps the primitive when the file is missing). Nodes the runtime
moves keep names: stand_post (scaled to the panel's height), drum_spin (the reel turns about X).
Blender axes: Z up, front is -Y (the runtime's +Z, toward the camera).
"""
import bpy
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import reset_scene, material, lathe, smooth_profile, sphere, cylinder, box, torus, disc, empty, attach, srgb

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
arg = lambda k, d: argv[argv.index(k) + 1] if k in argv else d
OUT = os.path.abspath(arg("--out", "public/models/props.glb"))

reset_scene()
M = {}
def mat(name, c, **k):
    if name not in M:
        M[name] = material(name, c, **k)
    return M[name]
def glow(name, c, strength):
    if name not in M:
        m = material(name, c, rough=0.25, coat=0.6)
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Emission Color"].default_value = (*srgb(c), 1); b.inputs["Emission Strength"].default_value = strength
        M[name] = m
    return M[name]

WOOD = lambda: mat("wood", "#c98f5a", rough=0.42, coat=0.55)
WHITE = lambda: mat("lacquer_white", "#f8f5ff", rough=0.3, coat=0.7)
GOLD = lambda: mat("gold", "#ffc857", rough=0.22, metal=0.85, coat=0.3)
CHROME = lambda: mat("chrome", "#d9d6e8", rough=0.18, metal=0.9, coat=0.2)
INK = lambda: mat("ink", "#26214a", rough=0.3, coat=0.6)
VIOLET = lambda: mat("violet", "#5b3fd1", rough=0.3, coat=0.7)
ALL = []

def put(o, parent):
    o.name = f"{parent.name}_{o.name}"
    attach(o, parent); ALL.append(o)
    return o

def rod(name, r, a, b, m):
    """A cylinder from point a to point b (Blender coordinates)."""
    import mathutils
    a, b = mathutils.Vector(a), mathutils.Vector(b)
    d = b - a
    o = cylinder(name, r, r, d.length, m, loc=tuple((a + b) / 2), seg=16)
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y")
    return o

# ---------------------------------------------------------------- stand: a lacquered base, a gold rim, a slim post
g = empty("prop_stand")
put(lathe("disc", smooth_profile([(0.0005, 0), (0.26, 0), (0.27, 0.02), (0.24, 0.05), (0.0005, 0.055)], 10), VIOLET(), segments=40), g)
put(torus("rim", 0.255, 0.01, GOLD(), loc=(0, 0, 0.03)), g)
post = put(lathe("post", [(0.0005, 0), (0.024, 0), (0.024, 1.0), (0.0005, 1.0)], CHROME(), segments=16), g)
post.name = "stand_post"                                    # the runtime scales it to the panel's height (unit tall)

# ---------------------------------------------------------------- easel (nominal 2.0 tall): turned legs, feet, tray, clamp
g = empty("prop_easel")
for sx in (-1, 1):
    put(rod("leg", 0.028, (sx * 0.42, 0.02, 0.0), (sx * 0.12, 0.0, 2.0), WOOD()), g)
    put(sphere("foot", 0.04, INK(), loc=(sx * 0.42, 0.02, 0.02), seg=12, rings=6), g)
put(rod("back", 0.026, (0, 0.55, 0.0), (0, 0.02, 1.9), WOOD()), g)
put(box("tray", (0.95, 0.13, 0.05), WOOD(), loc=(0, -0.04, 0.56), bevel=0.015), g)
put(box("lip", (0.95, 0.02, 0.05), WOOD(), loc=(0, -0.1, 0.6), bevel=0.008), g)
put(box("clamp", (0.26, 0.08, 0.06), WOOD(), loc=(0, -0.03, 1.98), bevel=0.012), g)
put(sphere("knob", 0.03, GOLD(), loc=(0, -0.08, 1.98), seg=12, rings=6), g)

# ---------------------------------------------------------------- the collector: a pedestal, three glowing rings with gold bands
g = empty("prop_collector")
put(lathe("pedestal", smooth_profile([(0.0005, 0), (0.7, 0), (0.72, 0.03), (0.66, 0.3), (0.6, 0.35), (0.0005, 0.35)], 14), WHITE(), segments=48), g)
put(torus("pedestal_rim", 0.705, 0.014, GOLD(), loc=(0, 0, 0.03)), g)
for i in range(3):
    z = 0.55 + i * 0.3
    put(cylinder(f"ring{i}", 0.5, 0.5, 0.2, glow("collector_glow", "#8f7bff", 1.6), loc=(0, 0, z), seg=48, bevel=0.03), g)
    put(torus(f"band{i}", 0.505, 0.018, GOLD(), loc=(0, 0, z + 0.15)), g)
cap = lathe("cap", smooth_profile([(0.0005, 0), (0.5, 0), (0.42, 0.1), (0.2, 0.16), (0.0005, 0.17)], 12), WHITE(), segments=48)
cap.location = (0, 0, 1.25); put(cap, g)

# ---------------------------------------------------------------- the writer's side table: a round top on a turned leg
g = empty("prop_side_table")
put(lathe("top", smooth_profile([(0.0005, 0.6), (0.4, 0.6), (0.42, 0.62), (0.4, 0.65), (0.0005, 0.65)], 10), WHITE(), segments=40), g)
put(lathe("leg", smooth_profile([(0.0005, 0.02), (0.18, 0.02), (0.06, 0.08), (0.04, 0.3), (0.06, 0.5), (0.05, 0.6), (0.0005, 0.6)], 18), WOOD(), segments=24), g)

# ---------------------------------------------------------------- the judges' board (6.0 x 2.2, origin at its centre): framed, on brackets
g = empty("prop_board")
put(box("face", (5.9, 0.06, 2.1), mat("boardface", "#fffdf7", rough=0.6, coat=0.1), loc=(0, 0, 0), bevel=0.02), g)
put(box("frame_t", (6.1, 0.1, 0.1), WOOD(), loc=(0, -0.01, 1.08), bevel=0.02), g)
put(box("frame_b", (6.1, 0.1, 0.1), WOOD(), loc=(0, -0.01, -1.08), bevel=0.02), g)
put(box("frame_l", (0.1, 0.1, 2.26), WOOD(), loc=(-3.03, -0.01, 0), bevel=0.02), g)
put(box("frame_r", (0.1, 0.1, 2.26), WOOD(), loc=(3.03, -0.01, 0), bevel=0.02), g)
put(box("ledge", (2.0, 0.16, 0.05), WOOD(), loc=(0, -0.08, -1.15), bevel=0.012), g)
for k, c in enumerate(["#e0567a", "#3d6fe0", "#2bb673"]):
    m = put(cylinder(f"marker{k}", 0.025, 0.025, 0.24, mat(f"marker{k}", c, rough=0.3), loc=(-0.4 + k * 0.3, -0.1, -1.1)), g)
    m.rotation_euler = (0, math.radians(90), 0)

# ---------------------------------------------------------------- the judges' table: a rounded top on a pedestal
g = empty("prop_round_table")
put(lathe("top", smooth_profile([(0.0005, 0.44), (1.68, 0.44), (1.72, 0.47), (1.68, 0.52), (0.0005, 0.52)], 10), WHITE(), segments=72), g)
put(torus("edge", 1.7, 0.012, GOLD(), loc=(0, 0, 0.48)), g)
put(lathe("pedestal", smooth_profile([(0.0005, 0), (0.5, 0), (0.45, 0.04), (0.12, 0.12), (0.09, 0.3), (0.16, 0.44), (0.0005, 0.44)], 16), WOOD(), segments=32), g)

# ---------------------------------------------------------------- "your bin": the idea vault, a gold door ring round the counter, a wheel
g = empty("prop_vault")
put(lathe("drum", smooth_profile([(0.0005, 0), (0.78, 0), (0.8, 0.05), (0.8, 1.22), (0.76, 1.3), (0.0005, 1.3)], 14), mat("vault", "#b9a6f2", rough=0.28, coat=0.8), segments=56), g)
put(torus("band_lo", 0.805, 0.02, GOLD(), loc=(0, 0, 0.12)), g)
put(torus("band_hi", 0.805, 0.02, GOLD(), loc=(0, 0, 1.18)), g)
put(torus("door", 0.42, 0.04, GOLD(), loc=(0, -0.78, 0.75), rot=(math.radians(90), 0, 0)), g)
wx, wz = 0.56, 0.75
put(torus("wheel", 0.14, 0.018, GOLD(), loc=(wx, -0.56, wz), rot=(math.radians(90), 0, math.radians(-45))), g)
for k in range(3):
    s_ = put(box(f"spoke{k}", (0.28, 0.02, 0.02), GOLD(), loc=(wx, -0.56, wz), bevel=0), g)
    s_.rotation_euler = (0, k * math.pi / 3, math.radians(-45))

# ---------------------------------------------------------------- the storyboard's legs (board centred, legs at x +-2.4)
g = empty("prop_storyboard_legs")
for sx in (-1, 1):
    put(rod("leg", 0.035, (sx * 2.45, -0.05, 0.0), (sx * 2.35, 0.0, 2.6), WOOD()), g)
    put(rod("strut", 0.03, (sx * 2.4, 0.45, 0.0), (sx * 2.38, 0.02, 1.9), WOOD()), g)
    put(sphere("foot", 0.05, INK(), loc=(sx * 2.45, -0.05, 0.02), seg=12, rings=6), g)

# ---------------------------------------------------------------- the director's chair: X-frame, canvas seat and back
g = empty("prop_director_chair")
canvas_m = mat("chaircanvas", "#26214a", rough=0.7, coat=0.0)
for sx in (-0.29, 0.29):
    put(rod("x1", 0.022, (sx, -0.24, 0.0), (sx, 0.24, 0.55), WOOD()), g)
    put(rod("x2", 0.022, (sx, 0.24, 0.0), (sx, -0.24, 0.55), WOOD()), g)
    put(rod("upright", 0.024, (sx, 0.22, 0.5), (sx, 0.24, 1.02), WOOD()), g)
    put(box("arm", (0.06, 0.5, 0.04), WOOD(), loc=(sx, 0.0, 0.74), bevel=0.012), g)
put(box("seat", (0.58, 0.46, 0.03), canvas_m, loc=(0, 0, 0.56), bevel=0.01), g)
put(box("back", (0.6, 0.03, 0.26), canvas_m, loc=(0, 0.235, 0.88), bevel=0.01), g)
bpy.ops.object.text_add(location=(0, 0.215, 0.85)); t = bpy.context.active_object
t.data.body = "DIRECTOR"; t.data.size = 0.075; t.data.align_x = "CENTER"; t.data.extrude = 0.004
t.rotation_euler = (math.radians(90), 0, 0)
bpy.ops.object.convert(target="MESH"); t = bpy.context.active_object; t.name = "label"
t.data.materials.clear(); t.data.materials.append(mat("chairtext", "#ffffff", rough=0.4)); put(t, g)

# ---------------------------------------------------------------- a mic stand: round base, chrome post, grille head on a shock mount
g = empty("prop_mic")
put(lathe("base", smooth_profile([(0.0005, 0), (0.17, 0), (0.18, 0.02), (0.1, 0.045), (0.0005, 0.05)], 10), INK(), segments=32), g)
put(lathe("post", [(0.0005, 0.04), (0.015, 0.04), (0.015, 1.12), (0.0005, 1.12)], CHROME(), segments=12), g)
head_tilt = math.radians(-28)                               # leaning toward the singer (behind the mic, +Y)
put(torus("mount", 0.085, 0.009, CHROME(), loc=(0, 0.02, 1.17), rot=(math.radians(90) + head_tilt, 0, 0)), g)
h = put(sphere("grille", 0.07, mat("grille", "#9a96b8", rough=0.35, metal=0.7), loc=(0, 0.04, 1.22), scale=(1, 1, 1.35), seg=24, rings=12), g)
h.rotation_euler = (head_tilt, 0, 0)
put(torus("grille_band", 0.071, 0.008, GOLD(), loc=(0, 0.035, 1.2), rot=(head_tilt, 0, 0)), g)

# ---------------------------------------------------------------- the reel drum (origin at its axis; drum_spin turns about X) and its plinth
g = empty("prop_drum")
spin = empty("drum_spin", parent=g)
put(cylinder("body", 0.8, 0.8, 1.48, VIOLET(), seg=56, bevel=0.03), spin).rotation_euler = (0, math.radians(90), 0)   # closed (an open tube shades from inside)
for sx in (-0.76, 0.76):
    put(torus("reel", 0.82, 0.07, GOLD(), loc=(sx, 0, 0), rot=(0, math.radians(90), 0)), spin)
    put(cylinder("hub", 0.16, 0.16, 0.1, GOLD(), loc=(sx, 0, 0), seg=24), spin).rotation_euler = (0, math.radians(90), 0)
    for k in range(5):
        a = k / 5 * math.tau
        sp = put(box("spoke", (0.05, 0.62, 0.05), GOLD(), loc=(sx, math.cos(a) * 0.45, math.sin(a) * 0.45), bevel=0.01), spin)
        sp.rotation_euler = (a + math.pi / 2, 0, 0)
g2 = empty("prop_drum_base")
put(box("plinth", (2.2, 1.2, 0.5), WHITE(), loc=(0, 0, 0.25), bevel=0.06), g2)
put(box("trim", (2.24, 1.24, 0.04), GOLD(), loc=(0, 0, 0.47), bevel=0.01), g2)
for sx in (-0.6, 0.6):
    put(box("cradle", (0.18, 0.5, 0.28), WHITE(), loc=(sx, 0, 0.6), bevel=0.04), g2)

# ---------------------------------------------------------------- the phone (origin at its centre, screen facing front)
g = empty("prop_phone")
put(box("body", (1.12, 0.08, 1.95), mat("phonebody", "#1d1838", rough=0.25, coat=0.9), loc=(0, 0.0, 0), bevel=0.07), g)
put(box("bezel", (1.04, 0.01, 1.86), mat("phonebezel", "#0c0a1a", rough=0.2), loc=(0, -0.041, 0), bevel=0.05), g)
put(sphere("camera", 0.028, mat("lens", "#3d3360", rough=0.1, coat=1), loc=(0, -0.046, 0.86), scale=(1, 0.4, 1), seg=12, rings=6), g)
for k, z in enumerate((0.45, 0.25)):
    put(box(f"button{k}", (0.025, 0.04, 0.14), mat("phonebody", "#1d1838"), loc=(0.57, 0, z), bevel=0.008), g)

# ---------------------------------------------------------------- export
# No baked contact shading on props: they are lit live with real shadows, and AO baked on turned shapes (a pole at the
# centre of every cap) came out as dark starbursts. Bevels are applied by the exporter (export_apply).
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_colors=True, export_apply=True, export_lights=False, export_cameras=False, export_animations=False)
print("PROPS", OUT, os.path.getsize(OUT), "bytes,", len(meshes), "meshes,", sorted(o.name for o in bpy.data.objects if o.name.startswith("prop_")))
