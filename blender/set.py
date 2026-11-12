"""The set dressing: one group of decor per station, built from code, one GLB.

    blender -b --factory-startup -P blender/set.py -- --out public/models/set.glb

Decor sits along the back wall and in the back corners, so it never covers the action (panels and figures live
between z -2.2 and z 1.5 in the runtime). Glowing pieces (string lights, marquee bulbs, the ON AIR sign) use emissive
materials. Contact shading is baked into the decor's colour attributes, like the cast.
Coordinates: Blender x = runtime x, Blender y = -runtime z, Blender z = runtime y. The back wall is at runtime
z = -4.2 (Blender y = 4.2); stations are 13 apart (runtime STATION_GAP).
"""
import bpy
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import reset_scene, material, lathe, smooth_profile, sphere, cylinder, box, torus, disc, empty, attach

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
arg = lambda k, d: argv[argv.index(k) + 1] if k in argv else d
OUT = os.path.abspath(arg("--out", "public/models/set.glb"))
GAP = 13
WALL = 4.2
STATIONS = ["research", "hooks", "review", "direction", "voice", "visuals", "assembly"]

reset_scene()
M = {}
def mat(name, c, **k):
    if name not in M:
        M[name] = material(name, c, **k)
    return M[name]

def glow(name, c, strength=3.0):
    if name not in M:
        m = material(name, c, rough=0.3, coat=0.0)
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Emission Color"].default_value = (*__import__("kit").srgb(c), 1)
        b.inputs["Emission Strength"].default_value = strength
        M[name] = m
    return M[name]

ALL = []
def put(o, group):
    o.name = f"{group.name}_{o.name}"
    attach(o, group); ALL.append(o)
    return o

def R(x, z):                   # runtime (x, z) on the floor -> Blender (x, y)
    return x, -z

# ---------------------------------------------------------------- reusable pieces
def plant(g, x, z, s=1.0):
    bx, by = R(x, z)
    put(lathe("pot", smooth_profile([(0.0005, 0), (0.17 * s, 0), (0.2 * s, 0.05 * s), (0.23 * s, 0.34 * s), (0.25 * s, 0.38 * s), (0.0005, 0.38 * s)], 16),
              mat("pot", "#e9e2d6", rough=0.45, coat=0.3), segments=32), g).location = (bx, by, 0)
    leaf = mat("leaf", "#3f9a5e", rough=0.45, coat=0.4)
    for i in range(9):
        a = i / 9 * math.tau
        o = put(sphere("leaf", 0.16 * s, leaf, loc=(bx + math.cos(a) * 0.12 * s, by + math.sin(a) * 0.12 * s, 0.55 * s + (i % 3) * 0.12 * s),
                       scale=(0.45, 1.0, 0.18), seg=16, rings=8), g)
        o.rotation_euler = (math.radians(35), 0, a + math.pi / 2)

def frame_on_wall(g, x, y, w, h, color, inner, name="frame"):
    bx, by = R(x, -WALL + 0.06)
    put(box(name, (w, 0.06, h), mat(f"{name}_c{color}", color, rough=0.4, coat=0.5), loc=(bx, by, y), bevel=0.015), g)
    put(box(name + "_in", (w * 0.84, 0.065, h * 0.84), mat(f"{name}_i{inner}", inner, rough=0.6, coat=0.1), loc=(bx, by - 0.005, y), bevel=0.005), g)

def spotlight(g, x, z, aim=0.0):
    bx, by = R(x, z)
    metal = mat("spotmetal", "#2d2550", rough=0.35, coat=0.4)
    for k in range(3):
        a = k / 3 * math.tau
        leg = put(cylinder("leg", 0.018, 0.018, 1.7, metal, loc=(bx + math.cos(a) * 0.25, by + math.sin(a) * 0.25, 0.8)), g)
        leg.rotation_euler = (math.sin(a) * -0.15, math.cos(a) * 0.15, 0)
    head = put(cylinder("lamp", 0.17, 0.12, 0.34, metal, loc=(bx, by, 1.75)), g)
    head.rotation_euler = (math.radians(70), 0, aim)
    put(disc("lens", 0.15, glow("lampglow", "#fff2c4", 6.0), loc=(bx, by - 0.16, 1.72), rot=(math.radians(-20), 0, aim)), g)

def bulbs(g, pts, color="#ffd27a"):
    gm, cap = glow(f"bulb{color}", color, 5.0), mat("bulbcap", "#c99a12", rough=0.3, metal=0.7)
    for i, (x, y, z) in enumerate(pts):
        bx, by = R(x, z)
        put(sphere("bulb", 0.055, gm, loc=(bx, by, y), seg=12, rings=8), g)

# ---------------------------------------------------------------- the stations
for i, st in enumerate(STATIONS):
    X = i * GAP
    g = empty("set_" + st)
    if st == "research":
        bx, by = R(X - 4.7, -3.75)
        wood = mat("shelfwood", "#f4efe6", rough=0.4, coat=0.5)
        put(box("shelf_side_l", (0.06, 0.45, 2.6), wood, loc=(bx - 0.6, by, 1.3)), g); put(box("shelf_side_r", (0.06, 0.45, 2.6), wood, loc=(bx + 0.6, by, 1.3)), g)
        cols = ["#3d6fe0", "#ffc857", "#e0567a", "#2bb673", "#7b5cd6", "#ff8a4c"]
        for k, z in enumerate((0.05, 0.7, 1.35, 2.0)):
            put(box("shelf", (1.26, 0.45, 0.05), wood, loc=(bx, by, z)), g)
            if z < 2.0:
                xx = bx - 0.52
                for b in range(7):
                    hgt = 0.42 + ((b * 7 + k * 3) % 5) * 0.035; wid = 0.08 + ((b + k) % 3) * 0.025
                    bk = put(box("book", (wid, 0.32, hgt), mat(f"book{(b + k) % 6}", cols[(b + k) % 6], rough=0.5, coat=0.3), loc=(xx + wid / 2, by, z + 0.025 + hgt / 2), bevel=0.008), g)
                    if b == 5: bk.rotation_euler = (0, math.radians(-12), 0)
                    xx += wid + 0.012
        gx, gy = R(X + 5.2, -2.6)
        put(cylinder("globe_foot", 0.22, 0.25, 0.06, mat("globefoot", "#2d2550"), loc=(gx, gy, 0.03)), g)
        put(cylinder("globe_post", 0.03, 0.03, 0.9, mat("globefoot", "#2d2550"), loc=(gx, gy, 0.5)), g)
        put(sphere("globe", 0.38, mat("globe", "#7cc4ff", rough=0.25, coat=0.8), loc=(gx, gy, 1.3), seg=40, rings=20), g)
        for k in range(5):
            o = put(sphere("land", 0.2 - k * 0.02, mat("land", "#2bb673", rough=0.4, coat=0.5), loc=(gx + math.cos(k * 1.3) * 0.31, gy + math.sin(k * 1.3) * 0.31 - 0.04, 1.3 + (k - 2) * 0.12), scale=(1, 0.35, 0.7), seg=16, rings=8), g)
            o.rotation_euler = (0, 0, k * 1.3 + math.pi / 2)
        put(torus("globe_ring", 0.43, 0.015, mat("brass", "#ffc857", rough=0.25, metal=0.8), loc=(gx, gy, 1.3), rot=(math.radians(90), math.radians(23), 0)), g)
        plant(g, X + 3.9, -3.7, 1.1)
    if st == "hooks":
        cx, cy = R(X + 4.3, -WALL + 0.08)
        put(box("cork", (1.7, 0.06, 1.2), mat("cork", "#d8a86b", rough=0.8, coat=0.0), loc=(cx, cy, 2.1), bevel=0.01), g)
        put(box("cork_frame", (1.82, 0.05, 1.32), mat("corkframe", "#f4efe6", rough=0.4, coat=0.5), loc=(cx, cy + 0.02, 2.1), bevel=0.012), g)
        notes = ["#fff3a6", "#ffd1dc", "#c9f0ff", "#d7ffc9", "#ffe1b3"]
        for k in range(6):
            nx, nz = cx - 0.6 + (k % 3) * 0.6, 2.35 - (k // 3) * 0.5
            n = put(box("note", (0.36, 0.012, 0.3), mat(f"note{k % 5}", notes[k % 5], rough=0.7, coat=0.0), loc=(nx, cy - 0.04, nz), bevel=0.0), g)
            n.rotation_euler = (0, math.radians((k * 7) % 11 - 5), 0)
            put(sphere("pin", 0.025, mat("pin", "#e0567a", rough=0.2), loc=(nx, cy - 0.06, nz + 0.11), seg=10, rings=6), g)
        pts = [(X - 4.6 + k * 0.46, 3.7 - 0.35 * math.sin(math.pi * k / 20), -WALL + 0.2) for k in range(21)]
        bulbs(g, pts, "#ffd27a")
        lx, ly = R(X - 4.6, -3.6)
        put(cylinder("lamp_base", 0.2, 0.22, 0.05, mat("lampmetal", "#2d2550"), loc=(lx, ly, 0.025)), g)
        put(cylinder("lamp_pole", 0.025, 0.025, 1.9, mat("lampmetal", "#2d2550"), loc=(lx, ly, 0.98)), g)
        put(cylinder("lamp_shade", 0.18, 0.3, 0.32, mat("shade", "#ffe9b8", rough=0.6, coat=0.0), loc=(lx, ly, 2.0)), g)
        put(sphere("lamp_glow", 0.1, glow("lampbulb", "#fff2c4", 8.0), loc=(lx, ly, 1.92), seg=12, rings=8), g)
        plant(g, X - 3.8, -3.7, 0.9)
    if st == "review":
        wx, wy = R(X - 4.35, -WALL + 0.06)
        put(torus("window_ring", 0.85, 0.08, mat("winframe", "#fbf8ff", rough=0.3, coat=0.6), loc=(wx, wy, 2.4), rot=(math.radians(90), 0, 0)), g)
        put(disc("window_glass", 0.84, glow("sky", "#cfe8ff", 1.2), loc=(wx, wy + 0.02, 2.4), rot=(math.radians(90), 0, 0), seg=48), g)
        put(box("window_bar_v", (0.05, 0.05, 1.7), mat("winframe", "#fbf8ff"), loc=(wx, wy - 0.03, 2.4)), g)
        put(box("window_bar_h", (1.7, 0.05, 0.05), mat("winframe", "#fbf8ff"), loc=(wx, wy - 0.03, 2.4)), g)
        sx, sy = R(X + 4.7, -WALL + 0.25)
        put(box("trophy_shelf", (1.2, 0.4, 0.06), mat("shelfwood", "#f4efe6"), loc=(sx, sy, 2.0)), g)
        gold = mat("trophygold", "#ffc857", rough=0.18, metal=0.9)
        put(lathe("trophy", smooth_profile([(0.0005, 0), (0.12, 0), (0.12, 0.05), (0.04, 0.1), (0.04, 0.22), (0.2, 0.3), (0.22, 0.5), (0.0005, 0.48)], 20), gold, segments=32), g).location = (sx, sy, 2.03)
        for k in (-1, 1):
            put(torus("handle", 0.07, 0.015, gold, loc=(sx + k * 0.22, sy, 2.42), rot=(math.radians(90), 0, 0), arc=math.pi, minor=8), g).rotation_euler = (math.radians(90), 0, math.radians(90 if k > 0 else -90))
        plant(g, X + 5.3, -3.2, 1.0)
    if st == "direction":
        spotlight(g, X - 4.6, -3.2, aim=math.radians(-30))
        spotlight(g, X + 4.7, -3.2, aim=math.radians(30))
        frame_on_wall(g, X - 4.55, 3.2, 0.9, 1.25, "#2d2550", "#ff9db5", "poster1")
        frame_on_wall(g, X + 4.6, 3.2, 0.9, 1.25, "#2d2550", "#7cc4ff", "poster2")
    if st == "voice":
        foam = mat("foam", "#1f7f74", rough=0.85, coat=0.0)
        for r_ in range(3):
            for c_ in range(13):
                fx, fy = R(X - 2.9 + c_ * 0.48, -WALL + 0.12)
                o = put(box("wedge", (0.42, 0.14, 0.42), foam, loc=(fx, fy, 1.05 + r_ * 0.46), bevel=0.035), g)
                o.rotation_euler = (0, math.radians(45 if (r_ + c_) % 2 else 0), 0)
        ox, oy = R(X + 3.6, -WALL + 0.6)
        put(box("onair_box", (1.2, 0.12, 0.38), mat("onairbox", "#2d2550", rough=0.3), loc=(ox, oy, 3.62), bevel=0.03), g)
        bpy.ops.object.text_add(location=(ox, oy - 0.07, 3.54)); t = bpy.context.active_object
        t.data.body = "ON AIR"; t.data.size = 0.22; t.data.align_x = "CENTER"; t.data.extrude = 0.01
        t.rotation_euler = (math.radians(90), 0, 0)
        bpy.ops.object.convert(target="MESH"); t = bpy.context.active_object; t.name = "onair_text"
        t.data.materials.clear(); t.data.materials.append(glow("onair", "#ff4d5e", 6.0))
        put(t, g)
    if st == "visuals":
        for side, base_x in ((-1, X - 4.6), (1, X + 4.5)):
            for k in range(3):
                cx, cy = R(base_x + side * k * 0.08, -3.7 + k * 0.12)
                c = put(box("canvas", (0.9 - k * 0.1, 0.05, 1.2 - k * 0.12), mat(f"canvas{k}", ["#fffdf8", "#ffe1b3", "#c9f0ff"][k], rough=0.7, coat=0.0), loc=(cx, cy, 0.62 - k * 0.06), bevel=0.01), g)
                c.rotation_euler = (math.radians(-12), 0, 0)
        jx, jy = R(X + 4.0, -WALL + 0.25)
        put(box("jar_shelf", (1.4, 0.35, 0.05), mat("shelfwood", "#f4efe6"), loc=(jx, jy, 1.8)), g)
        for k, c in enumerate(["#e63f5a", "#ffc857", "#3d6fe0", "#2bb673", "#7b5cd6"]):
            put(cylinder("jar", 0.09, 0.09, 0.2, mat("jarglass", "#ffffff", rough=0.15, coat=0.8), loc=(jx - 0.5 + k * 0.25, jy, 1.93)), g)
            put(cylinder("paint", 0.082, 0.082, 0.13, mat(f"paintfill{k}", c, rough=0.3), loc=(jx - 0.5 + k * 0.25, jy, 1.9)), g)
        plant(g, X - 3.7, -3.75, 1.2)
    if st == "assembly":
        velvet, trim = mat("velvet", "#5b2db5", rough=0.55, coat=0.2), mat("trim", "#ffc857", rough=0.25, metal=0.8)
        for side in (-1, 1):
            # a curtain: a wavy panel, gathered by a gold tie
            for k in range(7):
                cx, cy = R(X + side * (4.0 + k * 0.2), -WALL + 0.35 + 0.12 * math.sin(k * 1.3))
                put(cylinder("fold", 0.14, 0.16, 4.4, velvet, loc=(cx, cy, 2.2), seg=16), g)
            tx, ty = R(X + side * 4.6, -WALL + 0.55)
            put(torus("tie", 0.42, 0.04, trim, loc=(tx, ty, 1.5), rot=(0, 0, 0)), g)
        arch = [(X + math.cos(math.pi * k / 18) * 3.3, 2.2 + math.sin(math.pi * k / 18) * 1.9, -WALL + 0.25) for k in range(19)]
        bulbs(g, arch, "#ffe08a")
    ALL.append(g)

# ---------------------------------------------------------------- bake contact shading into the decor's colour attributes
sc = bpy.context.scene
world = bpy.data.worlds.new("w"); sc.world = world; world.light_settings.distance = 0.25
sc.cycles.samples = 32
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in meshes:
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.color_attributes.new("ao", "BYTE_COLOR", "POINT")
    o.data.color_attributes.active_color = o.data.color_attributes["ao"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
for m in {sl.material for o in meshes for sl in o.material_slots if sl.material}:
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    if b.inputs["Emission Strength"].default_value > 0:
        continue                                             # glowing pieces stay bright
    attr = nt.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "ao"
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
    mix.inputs[6].default_value = b.inputs["Base Color"].default_value[:]
    nt.links.new(attr.outputs["Color"], mix.inputs[7]); nt.links.new(mix.outputs[2], b.inputs["Base Color"])

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_colors=True, export_apply=True, export_lights=False, export_cameras=False, export_animations=False)
print("SET", OUT, os.path.getsize(OUT), "bytes,", len(meshes), "meshes,", sum(len(o.data.polygons) for o in meshes), "faces")
