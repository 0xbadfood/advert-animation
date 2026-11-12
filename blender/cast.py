"""The cast: seven lacquered figurines built from code, one GLB each.

    blender -b --factory-startup -P blender/cast.py -- --out public/models/cast [--only researcher,writer]

Every figure shares one joint layout (axis-free pivots, named like the runtime's: researcher > hop > body > head;
body > shoulder_X > elbow_X > hand_X) and one face rig (eye_L, eye_R, mouth), so every pose, beat and station plays
on every figure. Variety comes from hair, hats, outfits and colour (DESIGN.md section 4). Parts that never move
against each other get baked contact shading (AO, as COLOR_0); arms do not (blender/NOTES.md).
Blender axes: Z up, the figure faces -Y, its left hand is +X.
"""
import bpy
import json
import math
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import (reset_scene, material, lathe, smooth_profile, capsule, sphere, sphere_cap, cylinder, box, torus, disc,
                 empty, attach)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
arg = lambda k, d: argv[argv.index(k) + 1] if k in argv else d
OUT = os.path.abspath(arg("--out", "public/models/cast"))
ONLY = [x for x in arg("--only", "").split(",") if x]

# ---------------------------------------------------------------- the joint layout (world positions, figure at origin)
HOP_Z, HEAD_Z, SH_X, SH_Z, EL_Z, HA_Z = 0.08, 0.72, 0.19, 0.60, 0.40, 0.21
HEAD_C = HEAD_Z + 0.22                              # the centre of the head sphere
BODY = [(0.0005, 0.0), (0.25, 0.0), (0.27, 0.05), (0.262, 0.2), (0.236, 0.36), (0.2, 0.49), (0.145, 0.575), (0.07, 0.618), (0.0005, 0.625)]

CAST = {
    "researcher": dict(body="#f4f3f8", inner="#3d6fe0", sleeve="#f4f3f8", skin="#f0c7a2", hair="#2b211c", base="#2e4aa8",
                       hairstyle="curly", glasses=True, lanyard="#3d6fe0", coat=True),
    "writer": dict(body="#e8b23a", inner="#fbf7ee", sleeve="#e8b23a", skin="#e2b48c", hair="#7a4a2a", base="#a86f12",
                   hairstyle="ponytail", collar="#fbf7ee", lanyard="#5b3fd1", width=0.95),
    "director": dict(body="#f2e6d6", inner="#f2e6d6", sleeve="#f2e6d6", skin="#c98e64", hair="#2b1d16", base="#4d2e18",
                     hairstyle="short", beard=True, hat="flatcap", hat_color="#3f332d", scarf="#d2343f", vest="#7a4b2a", width=1.05),
    "crew1": dict(body="#7b5cd6", inner="#6a4cc4", sleeve="#7b5cd6", skin="#f3d0b0", hair="#3a2418", base="#4b2db5",
                  hairstyle="long", headphones="#b9a6f2", hood=True),
    "crew2": dict(body="#8c2f4a", inner="#7a2640", sleeve="#8c2f4a", skin="#a9714b", hair="#1c1410", base="#5a1b2e",
                  hairstyle="short", hat="cap", hat_color="#8c2f4a", hood=True),
    "crew3": dict(body="#4caf6e", inner="#3f9a5e", sleeve="#4caf6e", skin="#8d5a3b", hair="#15100d", base="#2c7a48",
                  hairstyle="bob", hood=True, width=0.97),
    "crew4": dict(body="#5b7fd6", inner="#5b7fd6", sleeve="#5b7fd6", skin="#e9be97", hair="#5a3622", base="#34508f",
                  hairstyle="short", hat="beret", hat_color="#c8344a", apron=True),
}


def build(role, s):
    reset_scene()
    W = s.get("width", 1.0)
    M = {k: material(f"{role}_{k}", c) for k, c in [("body", s["body"]), ("inner", s["inner"]), ("sleeve", s["sleeve"])]}
    M["skin"] = material(f"{role}_skin", s["skin"], rough=0.45, coat=0.15)
    M["hair"] = material(f"{role}_hair", s["hair"], rough=0.38, coat=0.45, double=True)
    M["base"] = material(f"{role}_base", s["base"], rough=0.25, coat=0.9)
    M["gold"] = material(f"{role}_gold", "#ffc857", rough=0.22, coat=0.3, metal=0.85)
    M["ink"] = material(f"{role}_ink", "#1d1838", rough=0.08, coat=1.0)
    M["white"] = material(f"{role}_white", "#ffffff", rough=0.2, coat=0.5)
    M["cheek"] = material(f"{role}_cheek", "#f59aa8", rough=0.6, coat=0.0)
    M["nose"] = material(f"{role}_nose", s["skin"], rough=0.45, coat=0.15)
    M["mouth"] = material(f"{role}_mouth", "#7a2b3a", rough=0.4, coat=0.2)

    # joints: axis-free pivots in the runtime's layout
    J = {}
    J["root"] = empty(role)
    J["hop"] = empty("hop", (0, 0, HOP_Z), J["root"])
    J["body"] = empty("body", (0, 0, 0), J["hop"])
    J["head"] = empty("head", (0, 0, HEAD_Z - HOP_Z), J["body"])
    for side, sx in (("L", 1), ("R", -1)):
        J[f"shoulder_{side}"] = empty(f"shoulder_{side}", (sx * SH_X, 0, SH_Z - HOP_Z), J["body"])
        J[f"elbow_{side}"] = empty(f"elbow_{side}", (0, 0, EL_Z - SH_Z), J[f"shoulder_{side}"])
        J[f"hand_{side}"] = empty(f"hand_{side}", (0, 0, HA_Z - EL_Z), J[f"elbow_{side}"])
    bpy.context.view_layer.update()
    fixed, moving = [], []

    def part(o, joint, moves=False):
        o.name = "part_" + o.name
        attach(o, J[joint]); (moving if moves else fixed).append(o)
        return o

    # ---- base: a lacquered stand with a gold rim
    part(cylinder("base", 0.33, 0.30, 0.08, M["base"], loc=(0, 0, 0.04), bevel=0.012), "root")
    part(torus("rim", 0.315, 0.013, M["gold"], loc=(0, 0, 0.081)), "root")

    # ---- body: a turned silhouette; the shirt front shows through where the outfit opens
    prof = smooth_profile([(r * W, z + HOP_Z) for r, z in BODY], 40)
    body = part(lathe("body", prof, M["body"], segments=56), "body")
    front = lambda lo, hi, grow: [(r + grow, z) for r, z in prof if lo <= z <= hi]
    if s.get("coat") or s.get("vest") or s.get("collar"):
        ang = math.radians(54)
        part(lathe("shirt", front(0.30, 0.66, 0.004), M["inner"], segments=56, angle=ang, start=-math.pi / 2 - ang / 2), "body")
    if s.get("coat"):                                # the lab coat's lapels: two thin shells either side of the shirt
        for k, sgn in ((0, 1), (1, -1)):
            a = math.radians(14)
            part(lathe(f"lapel{k}", front(0.34, 0.64, 0.008), M["body"], segments=56, angle=a,
                       start=-math.pi / 2 + sgn * math.radians(27) - (a if sgn < 0 else 0)), "body")
    if s.get("vest"):
        gap = math.radians(58)
        part(lathe("vest", front(0.16, 0.58, 0.012), material(f"{role}_vest", s["vest"], rough=0.5, coat=0.2), segments=56,
                   angle=math.tau - gap, start=-math.pi / 2 + gap / 2), "body")
        for i, z in enumerate((0.3, 0.4, 0.5)):
            part(sphere(f"button{i}", 0.012, M["gold"], loc=(0.03 + 0.0 * i, -0.225 + (z - 0.3) * 0.25, z + HOP_Z - 0.05)), "body")
    if s.get("apron"):
        ang = math.radians(118)
        apron_m = material(f"{role}_apron", "#f6f1ea", rough=0.6, coat=0.1)
        part(lathe("apron", front(0.06, 0.45, 0.01), apron_m, segments=56, angle=ang, start=-math.pi / 2 - ang / 2), "body")
        for i, (dx, z, c) in enumerate([(-0.07, 0.2, "#e63f5a"), (0.05, 0.28, "#ffc857"), (0.09, 0.14, "#3d6fe0"), (-0.02, 0.35, "#2bb673")]):
            sp = sphere(f"paint{i}", 0.02, material(f"{role}_paint{i}", c, rough=0.3), loc=(dx, -0.274 + abs(dx) * 0.2, z + HOP_Z), scale=(1, 0.35, 0.8))
            part(sp, "body")
    if s.get("hood"):
        part(torus("hood", 0.135, 0.055, M["body"], loc=(0, 0.035, 0.635 + HOP_Z - 0.03), arc=math.pi, rot=(0, 0, 0)), "body")
    if s.get("collar"):
        part(torus("collar", 0.115, 0.024, M["inner"], loc=(0, 0, 0.62 + HOP_Z - 0.02), rot=(math.radians(-8), 0, 0)), "body")
    if s.get("scarf"):
        sc = material(f"{role}_scarf", s["scarf"], rough=0.55, coat=0.1)
        part(torus("scarf", 0.13, 0.05, sc, loc=(0, 0, 0.6 + HOP_Z - 0.01)), "body")
        t1 = part(box("scarf_tail1", (0.085, 0.035, 0.23), sc, loc=(0.075, -0.17, 0.5 + HOP_Z - 0.04), bevel=0.012), "body")
        t1.rotation_euler = (math.radians(-12), 0, math.radians(-8))
        t2 = part(box("scarf_tail2", (0.08, 0.035, 0.17), sc, loc=(0.13, -0.15, 0.53 + HOP_Z - 0.04), bevel=0.012), "body")
        t2.rotation_euler = (math.radians(-10), 0, math.radians(14))
    if s.get("lanyard"):
        part(torus("lanyard", 0.125, 0.006, material(f"{role}_lanyard", s["lanyard"], rough=0.4),
                   loc=(0, -0.05, 0.56 + HOP_Z - 0.02), rot=(math.radians(-38), 0, 0)), "body")
        part(box("badge", (0.07, 0.012, 0.09), M["white"], loc=(0, -0.205, 0.4 + HOP_Z), bevel=0.006), "body")
    part(cylinder("neck", 0.075, 0.08, 0.08, M["skin"], loc=(0, 0, HEAD_Z + 0.0)), "body")

    # ---- head and face
    part(sphere("head", 0.24, M["skin"], loc=(0, 0, HEAD_C), scale=(1, 0.97, 0.98), seg=56, rings=28), "head")
    for side, sx in (("L", 1), ("R", -1)):
        eye = sphere(f"eye_{side}", 0.03, M["ink"], loc=(sx * 0.085, -0.214, HEAD_C + 0.035), scale=(1, 0.55, 1.18), seg=24, rings=12)
        attach(eye, J["head"]); fixed.append(eye)                       # named eye_L / eye_R: the runtime blinks them
        glint = sphere(f"glint_{side}", 0.009, M["white"], loc=(sx * 0.085 + 0.011, -0.232, HEAD_C + 0.052), seg=12, rings=6)
        glint.name = "part_" + glint.name; attach(glint, eye)
        brow = sphere(f"brow_{side}", 0.032, material(f"{role}_brow", s["hair"], rough=0.4), loc=(sx * 0.088, -0.214, HEAD_C + 0.095), scale=(1, 0.3, 0.22), seg=16, rings=8)
        brow.rotation_euler = (0, sx * math.radians(-9), 0); part(brow, "head")
        part(disc(f"cheek_{side}", 0.03, M["cheek"], loc=(sx * 0.14, -0.197, HEAD_C - 0.032), rot=(math.radians(90), 0, sx * math.radians(32))), "head")
    part(sphere("nose", 0.022, M["nose"], loc=(0, -0.237, HEAD_C - 0.005), scale=(1, 0.8, 0.9), seg=16, rings=8), "head")
    mouth = empty("mouth", (0, -0.229, HEAD_C - 0.058 - HEAD_Z), J["head"])
    arc = torus("mouth_arc", 0.04, 0.0085, M["mouth"], rot=(math.radians(90), 0, 0), arc=math.pi, seg=24, minor=8)
    arc.name = "part_mouth_arc"; arc.parent = mouth; arc.location = (0, 0, 0)
    fixed.append(arc)

    # ---- hair: a cap with a hairline, then the style
    H = lambda x, y, z: z > 0.075 - (y + 0.25) / 0.5 * 0.2 - (0.04 if abs(x) > 0.17 else 0)   # high in front, low behind
    part(sphere_cap("hair", 0.253, M["hair"], H, loc=(0, 0.004, HEAD_C), scale=(1.02, 1.0, 1.0)), "head")
    style = s["hairstyle"]
    if style == "curly":
        k = 0
        for ring, (phi, n) in enumerate([(25, 6), (55, 10), (80, 9)]):
            for i in range(n):
                th = i / n * math.tau + ring * 0.3
                x, y, z = math.sin(math.radians(phi)) * math.cos(th), math.sin(math.radians(phi)) * math.sin(th), math.cos(math.radians(phi))
                if y < -0.55 and ring > 0:                # keep the face clear
                    continue
                part(sphere(f"curl{k}", 0.068 - ring * 0.006, M["hair"], loc=(x * 0.245, y * 0.245 + 0.01, HEAD_C + z * 0.245), seg=16, rings=8), "head"); k += 1
    if style == "ponytail":
        part(sphere("tail", 0.1, M["hair"], loc=(0, 0.25, HEAD_C + 0.1), scale=(0.75, 0.8, 1.35)), "head").rotation_euler = (math.radians(-25), 0, 0)
        part(torus("tie", 0.05, 0.014, material(f"{role}_tie", "#5b3fd1", rough=0.3), loc=(0, 0.23, HEAD_C + 0.17), rot=(math.radians(60), 0, 0)), "head")
        shell = [(0.258, HEAD_C + 0.06), (0.262, HEAD_C - 0.04), (0.25, HEAD_C - 0.12)]      # hair framing the face
        ang = math.radians(250)
        part(lathe("locks", smooth_profile(shell, 10), M["hair"], segments=48, angle=ang, start=math.pi / 2 - ang / 2), "head")
        part(sphere("swoop", 0.12, M["hair"], loc=(0.07, -0.17, HEAD_C + 0.16), scale=(1.3, 0.55, 0.5)), "head").rotation_euler = (0, math.radians(-14), 0)
    if style in ("long", "bob"):
        drop = 0.3 if style == "long" else 0.15
        shell = [(0.258, HEAD_C + 0.05), (0.262, HEAD_C - 0.05), (0.255, HEAD_C - drop * 0.6), (0.24, HEAD_C - drop)]
        ang = math.radians(230 if style == "long" else 260)
        part(lathe("locks", smooth_profile(shell, 12), M["hair"], segments=48, angle=ang, start=math.pi / 2 - ang / 2), "head")
    if s.get("beard"):                                   # jaw and sideburns, leaving the mouth and cheeks clear
        beard = lambda x, y, z: y < 0.09 and ((z < -0.1) or (abs(x) > 0.16 and z < 0.04) or (abs(x) > 0.09 and z < -0.07))
        part(sphere_cap("beard", 0.247, M["hair"], beard, loc=(0, -0.004, HEAD_C), scale=(1.03, 1.03, 1.05)), "head")
        for sx in (1, -1):
            part(sphere(f"stache{sx}", 0.032, M["hair"], loc=(sx * 0.03, -0.236, HEAD_C - 0.036), scale=(1.2, 0.55, 0.55)), "head")
    if s.get("glasses"):
        for side, sx in (("L", 1), ("R", -1)):
            part(torus(f"lens_{side}", 0.052, 0.008, M["ink"], loc=(sx * 0.085, -0.247, HEAD_C + 0.035), rot=(math.radians(90), 0, 0), minor=8), "head")
            arm_ = part(box(f"temple_{side}", (0.008, 0.2, 0.008), M["ink"], loc=(sx * 0.15, -0.14, HEAD_C + 0.04), bevel=0), "head")
            arm_.rotation_euler = (0, 0, sx * math.radians(-12))
        part(box("bridge", (0.05, 0.008, 0.008), M["ink"], loc=(0, -0.25, HEAD_C + 0.045), bevel=0), "head")
    hat, hc = s.get("hat"), material(f"{role}_hat", s.get("hat_color", "#333333"), rough=0.5, coat=0.2)
    if hat == "flatcap":
        crown = smooth_profile([(0.0005, 0.115), (0.14, 0.11), (0.23, 0.085), (0.272, 0.04), (0.274, 0.0), (0.262, -0.03), (0.0005, -0.03)], 20)
        c = part(lathe("cap_top", crown, hc, segments=56), "head"); c.location = (0, 0.015, HEAD_C + 0.15)
        c.rotation_euler = (math.radians(12), 0, 0); c.scale = (1.0, 1.1, 1.0)
        b = part(box("cap_brim", (0.27, 0.12, 0.022), hc, loc=(0, -0.255, HEAD_C + 0.13), bevel=0.01), "head"); b.rotation_euler = (math.radians(16), 0, 0)
    if hat == "cap":
        part(sphere_cap("cap_dome", 0.262, hc, lambda x, y, z: z > 0.035, loc=(0, 0, HEAD_C + 0.005)), "head")
        b = part(box("cap_brim", (0.2, 0.13, 0.02), hc, loc=(0, 0.27, HEAD_C + 0.07), bevel=0.01), "head"); b.rotation_euler = (math.radians(-12), 0, 0)
    if hat == "beret":
        c = part(sphere("beret", 0.28, hc, loc=(0.03, 0.01, HEAD_C + 0.2), scale=(1, 1, 0.32)), "head"); c.rotation_euler = (0, math.radians(14), 0)
        part(sphere("nub", 0.02, hc, loc=(0.05, 0.01, HEAD_C + 0.29)), "head")
    if s.get("headphones"):
        hm = material(f"{role}_phones", s["headphones"], rough=0.3)
        part(torus("band", 0.268, 0.016, material(f"{role}_band", "#2d2550", rough=0.3), loc=(0, 0, HEAD_C), rot=(math.radians(90), 0, 0), arc=math.pi, minor=8), "head")
        for sx in (1, -1):
            cup = part(cylinder(f"cup{sx}", 0.075, 0.075, 0.05, hm, loc=(sx * 0.262, 0, HEAD_C), bevel=0.012), "head"); cup.rotation_euler = (0, math.radians(90), 0)

    # ---- arms (they move: no baked contact shading)
    for side, sx in (("L", 1), ("R", -1)):
        part(sphere(f"cap_{side}", 0.062, M["sleeve"], loc=(sx * SH_X, 0, SH_Z)), f"shoulder_{side}", moves=True)
        up = capsule(f"upper_{side}", 0.053, 0.15, M["sleeve"]); up.location = (sx * SH_X, 0, SH_Z); part(up, f"shoulder_{side}", moves=True)
        fo = capsule(f"fore_{side}", 0.049, 0.12, M["sleeve"]); fo.location = (sx * SH_X, 0, EL_Z); part(fo, f"elbow_{side}", moves=True)
        part(sphere(f"mitten_{side}", 0.062, M["skin"], loc=(sx * SH_X, -0.005, HA_Z), scale=(1, 0.85, 1.05)), f"hand_{side}", moves=True)
        part(sphere(f"thumb_{side}", 0.025, M["skin"], loc=(sx * (SH_X - 0.045), -0.035, HA_Z + 0.02)), f"hand_{side}", moves=True)
    return J, fixed, moving


def bake_ao(fixed):
    """Contact shading into a colour attribute on the parts that never move against each other, multiplied into their
    base colour (exported as COLOR_0)."""
    sc = bpy.context.scene
    world = bpy.data.worlds.new("w"); sc.world = world
    world.light_settings.distance = 0.12
    sc.cycles.samples = 48
    meshes = [o for o in fixed if o.type == "MESH"]
    for o in meshes:
        o.data.color_attributes.new("ao", "BYTE_COLOR", "POINT")
        o.data.color_attributes.active_color = o.data.color_attributes["ao"]
        for m in o.modifiers:                                    # bake on the final shape (bevels applied)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    for m in {sl.material for o in meshes for sl in o.material_slots if sl.material}:
        nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
        if any(n.type == "VERTEX_COLOR" for n in nt.nodes):
            continue
        attr = nt.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "ao"
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
        mix.inputs[6].default_value = bsdf.inputs["Base Color"].default_value[:]
        nt.links.new(attr.outputs["Color"], mix.inputs[7]); nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])


def split_shared_materials(fixed, moving):
    """A material used by both a fixed part (gets AO) and a moving part (does not) is copied for the moving one."""
    fixed_mats = {sl.material for o in fixed if o.type == "MESH" for sl in o.material_slots}
    for o in moving:
        for sl in o.material_slots:
            if sl.material in fixed_mats:
                sl.material = sl.material.copy()


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    report = {}
    for role, spec in CAST.items():
        if ONLY and role not in ONLY:
            continue
        t0 = time.time()
        J, fixed, moving = build(role, spec)
        split_shared_materials(fixed, moving)
        bake_ao(fixed)
        path = os.path.join(OUT, role + ".glb")
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_animations=False, export_colors=True,
                                  export_apply=True, export_lights=False, export_cameras=False)
        report[role] = {"s": round(time.time() - t0, 2), "bytes": os.path.getsize(path),
                        "tris": sum(len(o.data.polygons) for o in fixed + moving if o.type == "MESH")}
        print("CAST", role, json.dumps(report[role]))
    with open(os.path.join(OUT, "cast.json"), "w") as f:
        json.dump(report, f, indent=1)
