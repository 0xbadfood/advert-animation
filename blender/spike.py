"""Blender spike (DESIGN.md build order step 2): one figurine, rigged and animated, baked, exported as GLB.

    blender -b --factory-startup -P blender/spike.py -- --out public/models/spike.glb [--device CPU|CUDA]

What it proves on this box (aarch64 GB10, Ubuntu Blender 4.0.2):
  1. a figurine built entirely from code (lathe body, sphere head, base with a rim, arms with mittens);
  2. an armature (skeleton) with the runtime's joint layout; the figurine's parts are rigid, each parented to a bone
     (a figurine has no skin to bend, so no weight painting is needed);
  3. actions (animation clips) keyed from code: "idle" and "wave";
  4. ambient occlusion baked into the parts' colour attributes (soft contact shading that moves with the figure);
  5. full lighting (soft shadow included) baked into a texture on a static floor patch;
  6. one GLB with meshes, materials, the skeleton, both actions and the baked texture, for Three.js.
Timings and findings go to <out>.json next to the GLB.
"""
import bpy
import bmesh
import json
import math
import os
import sys
import time

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
arg = lambda k, d: argv[argv.index(k) + 1] if k in argv else d
OUT = os.path.abspath(arg("--out", "public/models/spike.glb"))
DEVICE = arg("--device", "CPU")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
report = {"blender": bpy.app.version_string, "device": DEVICE, "steps": {}}
T0 = time.time()


def step(name):
    report["steps"][name] = round(time.time() - T0, 2)


# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.render.fps = 30


def material(name, color, rough=0.32, coat=0.4):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    if "Coat Weight" in b.inputs:            # the lacquer clearcoat (Principled v2, Blender 4.0+)
        b.inputs["Coat Weight"].default_value = coat
    return m


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)   # Blender wants linear


def link(obj):
    bpy.context.collection.objects.link(obj)
    return obj


def mesh_obj(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def lathe(name, profile, mat, segments=40):
    """A surface of revolution around Z from (radius, height) points: how a turned figurine body is made."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, axis=(0, 0, 1), cent=(0, 0, 0), angle=math.tau, steps=segments, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat)


def sphere(name, r, mat, loc=(0, 0, 0), scale=(1, 1, 1), seg=32, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    o = mesh_obj(name, bm, mat)
    o.location = loc; o.scale = scale
    return o


def cylinder(name, r1, r2, depth, mat, loc=(0, 0, 0), seg=40):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth)
    o = mesh_obj(name, bm, mat)
    o.location = loc
    return o


def torus(name, R, r, mat, loc=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=48, minor_segments=10, location=loc)
    o = bpy.context.active_object; o.name = name
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# ---------------------------------------------------------------- the researcher, from parts (units: metres, Z up)
coat, inner, skin, hair, base_c, gold, ink = (material(n, srgb(c)) for n, c in [
    ("coat", "#f4f3f8"), ("inner", "#3d6fe0"), ("skin", "#f0c7a2"), ("hair", "#2b211c"), ("base", "#2e4aa8"), ("gold", "#ffc857"), ("ink", "#1d1838")])
gold.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 0.6

parts = {}
parts["base"] = cylinder("base", 0.33, 0.30, 0.08, base_c, loc=(0, 0, 0.04))
parts["rim"] = torus("rim", 0.31, 0.012, gold, loc=(0, 0, 0.08))
parts["body"] = lathe("body", [(0.001, 0.08), (0.25, 0.08), (0.27, 0.14), (0.25, 0.38), (0.2, 0.6), (0.13, 0.68), (0.001, 0.70)], coat)
parts["band"] = lathe("band", [(0.001, 0.32), (0.17, 0.32), (0.16, 0.5), (0.001, 0.5)], inner)
parts["band"].scale = (0.6, 1.0, 1.0); parts["band"].location = (0, -0.11, 0)      # the blue hoodie showing at the front (-Y)
parts["head"] = sphere("head", 0.24, skin, loc=(0, 0, 0.94))
parts["hair"] = sphere("hair", 0.25, hair, loc=(0, 0.02, 1.0), scale=(1, 1, 0.8))
for i, sx in enumerate((-1, 1)):
    parts[f"eye{i}"] = sphere(f"eye{i}", 0.028, ink, loc=(sx * 0.085, -0.225, 0.97), scale=(1, 0.5, 1), seg=16, rings=8)
    parts[f"lens{i}"] = torus(f"lens{i}", 0.055, 0.009, ink, loc=(sx * 0.085, -0.235, 0.97))
    parts[f"lens{i}"].rotation_euler = (math.pi / 2, 0, 0)
arm = {}
for side, sx in (("L", 1), ("R", -1)):
    arm[f"upper.{side}"] = sphere(f"upper.{side}", 0.06, coat, loc=(sx * 0.2, 0, 0.5), scale=(0.9, 0.9, 2.0))
    arm[f"fore.{side}"] = sphere(f"fore.{side}", 0.052, coat, loc=(sx * 0.2, 0, 0.32), scale=(0.9, 0.9, 1.8))
    arm[f"mitten.{side}"] = sphere(f"mitten.{side}", 0.06, skin, loc=(sx * 0.2, 0, 0.21))
parts.update(arm)
step("model")

# ---------------------------------------------------------------- the skeleton: the runtime's joint layout
arm_data = bpy.data.armatures.new("rig")
rig = link(bpy.data.objects.new("researcher", arm_data))
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
eb = arm_data.edit_bones
def bone(name, head, tail, parent=None):
    b = eb.new(name); b.head = head; b.tail = tail
    if parent: b.parent = eb[parent]
    return b
bone("root", (0, 0, 0), (0, 0, 0.08))
bone("hop", (0, 0, 0.08), (0, 0, 0.16), "root")
bone("body", (0, 0, 0.08), (0, 0, 0.68), "hop")
bone("head", (0, 0, 0.7), (0, 0, 1.18), "body")
for side, sx in (("L", 1), ("R", -1)):
    bone(f"shoulder.{side}", (sx * 0.2, 0, 0.6), (sx * 0.2, 0, 0.4), "body")
    bone(f"elbow.{side}", (sx * 0.2, 0, 0.4), (sx * 0.2, 0, 0.21), f"shoulder.{side}")
bpy.ops.object.mode_set(mode="OBJECT")

owner = {"base": "root", "rim": "root", "body": "body", "band": "body", "head": "head", "hair": "head",
         "eye0": "head", "eye1": "head", "lens0": "head", "lens1": "head"}
for side in "LR":
    owner[f"upper.{side}"] = f"shoulder.{side}"; owner[f"fore.{side}"] = f"elbow.{side}"; owner[f"mitten.{side}"] = f"elbow.{side}"
for name, o in parts.items():
    mw = o.matrix_world.copy()
    o.parent = rig; o.parent_type = "BONE"; o.parent_bone = owner[name]
    bpy.context.view_layer.update()
    o.matrix_world = mw                                   # keep it where it was built
step("rig")

# ---------------------------------------------------------------- actions (animation clips) keyed from code
def key(action_name, frames):
    """frames: [(frame, {bone: (rx, ry, rz) degrees | ('loc', (x, y, z))})]"""
    act = bpy.data.actions.new(action_name)
    rig.animation_data_create(); rig.animation_data.action = act
    for f, pose in frames:
        for bname, v in pose.items():
            pb = rig.pose.bones[bname]
            if isinstance(v, tuple) and v and v[0] == "loc":
                pb.location = v[1]; pb.keyframe_insert("location", frame=f)
            else:
                pb.rotation_mode = "XYZ"; pb.rotation_euler = tuple(math.radians(a) for a in v); pb.keyframe_insert("rotation_euler", frame=f)
    act.use_fake_user = True
    return act

rest = {"shoulder.R": (0, 0, 0), "elbow.R": (0, 0, 0), "head": (0, 0, 0), "body": (0, 0, 0)}
idle = key("idle", [(1, rest), (30, {**rest, "head": (4, 0, 3), "body": (2, 0, 0)}), (60, rest)])
wave = key("wave", [
    (1, rest),
    (8, {**rest, "shoulder.R": (0, 0, -150), "elbow.R": (0, 0, -20), "head": (0, 0, -6)}),
    (14, {**rest, "shoulder.R": (0, 0, -150), "elbow.R": (0, 0, -55), "head": (0, 0, -6)}),
    (20, {**rest, "shoulder.R": (0, 0, -150), "elbow.R": (0, 0, -15), "head": (0, 0, -6)}),
    (26, {**rest, "shoulder.R": (0, 0, -150), "elbow.R": (0, 0, -55), "head": (0, 0, -6)}),
    (36, rest),
])
for act in (idle, wave):                          # each clip becomes its own NLA track, so the GLB carries both
    tr = rig.animation_data.nla_tracks.new(); tr.name = act.name
    tr.strips.new(act.name, 1, act)
rig.animation_data.action = None
step("actions")

# ---------------------------------------------------------------- lights and a static floor patch with a prop
sun = link(bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN")))
sun.data.energy = 3.0; sun.data.angle = math.radians(12); sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-35))
fill = link(bpy.data.objects.new("fill", bpy.data.lights.new("fill", "AREA")))
fill.data.energy = 120; fill.data.size = 4; fill.location = (2.5, -3, 3); fill.rotation_euler = (math.radians(55), 0, math.radians(35))
world = bpy.data.worlds.new("world"); scene.world = world
world.use_nodes = True; world.node_tree.nodes["Background"].inputs["Color"].default_value = (*srgb("#eee6ff"), 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8

floor_mat = material("floor", srgb("#e2d8fb"), rough=0.9, coat=0)
bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.6)
floor = mesh_obj("floor", bm, floor_mat)
crate = cylinder("stool", 0.22, 0.22, 0.45, material("stool", srgb("#c79a6b"), rough=0.6, coat=0), loc=(0.75, 0.35, 0.225))
step("set")

# ---------------------------------------------------------------- bakes
scene.cycles.device = "GPU" if DEVICE != "CPU" else "CPU"
if DEVICE != "CPU":
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = DEVICE; prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == DEVICE
scene.cycles.samples = 64
scene.cycles.use_denoising = False          # Ubuntu's Blender is built without OpenImageDenoise: denoising on = every Cycles job fails
scene.render.bake.margin = 4

def select_only(objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]

# (a) ambient occlusion into each figurine part's colour attribute: soft contact shading that travels with the part
for o in parts.values():
    o.data.color_attributes.new("ao", "BYTE_COLOR", "POINT")
    o.data.color_attributes.active_color = o.data.color_attributes["ao"]
select_only(list(parts.values()))
t = time.time()
bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
report["ao_bake_s"] = round(time.time() - t, 2)
# the baked AO multiplies the base colour (so the exporter writes it as COLOR_0 and Three.js uses it)
for m in {s.material for o in parts.values() for s in o.material_slots}:
    nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
    attr = nt.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "ao"
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
    mix.inputs[6].default_value = bsdf.inputs["Base Color"].default_value[:]
    nt.links.new(attr.outputs["Color"], mix.inputs[7]); nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
step("bake_ao")

# (b) full lighting into a texture on the static floor patch (its own UVs), shadows of the figure and the stool included
bpy.ops.object.select_all(action="DESELECT"); floor.select_set(True); bpy.context.view_layer.objects.active = floor
bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.smart_project(island_margin=0.02); bpy.ops.object.mode_set(mode="OBJECT")
img = bpy.data.images.new("floor_baked", 1024, 1024)
nt = floor_mat.node_tree; tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; nt.nodes.active = tex
scene.render.bake.use_pass_direct = True; scene.render.bake.use_pass_indirect = True
t = time.time()
bpy.ops.object.bake(type="COMBINED")
report["light_bake_s"] = round(time.time() - t, 2)
img.filepath_raw = os.path.splitext(OUT)[0] + "_floor.png"; img.file_format = "PNG"; img.save()
# the floor shows the bake as is: an emission-only material, so the browser does not light it twice
for n in list(nt.nodes):
    if n != tex: nt.nodes.remove(n)
outn = nt.nodes.new("ShaderNodeOutputMaterial"); emis = nt.nodes.new("ShaderNodeEmission")
nt.links.new(tex.outputs["Color"], emis.inputs["Color"]); nt.links.new(emis.outputs["Emission"], outn.inputs["Surface"])
step("bake_light")

# ---------------------------------------------------------------- export
bpy.ops.object.select_all(action="SELECT")
t = time.time()
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animations=True, export_nla_strips=True,
                          export_colors=True, export_apply=True, export_lights=False, export_cameras=False)
report["export_s"] = round(time.time() - t, 2)
report["glb_bytes"] = os.path.getsize(OUT)
report["total_s"] = round(time.time() - T0, 2)
step("export")
with open(os.path.splitext(OUT)[0] + ".json", "w") as f:
    json.dump(report, f, indent=1)
print("SPIKE", json.dumps(report))
