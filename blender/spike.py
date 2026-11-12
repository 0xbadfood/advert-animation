"""Blender spike (DESIGN.md build order step 2): one figurine, rigged and animated, baked, exported as GLB.

    blender -b --factory-startup -P blender/spike.py -- --out public/models/spike.glb [--device CPU|CUDA]

What it proves on this box (aarch64 GB10, Ubuntu Blender 4.0.2):
  1. a figurine built entirely from code (lathe body, sphere head, base with a rim, arms with mittens);
  2. joints as axis-free pivots (empties) in the runtime's layout and names; the rigid parts hang from them (a
     figurine has no skin to bend, so no skeleton or weight painting is needed);
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

# ---------------------------------------------------------------- joints: the runtime's layout, as plain pivots
# A figurine is a rigid toy, so its joints are empties (invisible pivot points) with NO rest rotation, placed where the
# runtime's joints are and named like them (src/world/figure.js: root > hop > body > head; body > shoulder_X > elbow_X >
# hand_X). Bones were tried first: a bone's axes follow the bone, so "raise the arm" turned the wrong way. With
# axis-free pivots the runtime sets rotations exactly as it does on the greybox, no conversion.
# Axes: Blender is Z-up with the figure facing -Y; glTF/Three.js is Y-up facing +Z. Three (x, y, z) = Blender (x, z, -y).
for n, o in parts.items():              # mesh parts get a prefix, so joint names stay exactly the runtime's
    o.name = "part_" + n
JOINTS = {   # name: (location in Blender coordinates, parent)
    "root": ((0, 0, 0), None), "hop": ((0, 0, 0.08), "root"), "body": ((0, 0, 0.08), "hop"), "head": ((0, 0, 0.72), "body"),
    "shoulder_L": ((0.19, 0, 0.6), "body"), "elbow_L": ((0.19, 0, 0.4), "shoulder_L"), "hand_L": ((0.19, 0, 0.21), "elbow_L"),
    "shoulder_R": ((-0.19, 0, 0.6), "body"), "elbow_R": ((-0.19, 0, 0.4), "shoulder_R"), "hand_R": ((-0.19, 0, 0.21), "elbow_R"),
}
J = {}
for name, (loc, parent) in JOINTS.items():
    e = link(bpy.data.objects.new(name, None)); e.empty_display_size = 0.05
    e.location = loc
    if parent:
        e.parent = J[parent]; e.location = tuple(l - p for l, p in zip(loc, JOINTS[parent][0]))   # local to the parent pivot
    e.rotation_mode = "XYZ"
    J[name] = e
J["root"].name = "researcher"; J["researcher"] = J.pop("root")       # the figure's top node carries its name
bpy.context.view_layer.update()

owner = {"base": "researcher", "rim": "researcher", "body": "body", "band": "body", "head": "head", "hair": "head",
         "eye0": "head", "eye1": "head", "lens0": "head", "lens1": "head"}
for side in "LR":
    owner[f"upper.{side}"] = f"shoulder_{side}"; owner[f"fore.{side}"] = f"elbow_{side}"; owner[f"mitten.{side}"] = f"hand_{side}"
for name, o in parts.items():
    mw = o.matrix_world.copy()
    o.parent = J[owner[name]]; o.matrix_parent_inverse = J[owner[name]].matrix_world.inverted()
    o.matrix_world = mw                                   # keep it where it was built
step("rig")

# ---------------------------------------------------------------- clips keyed in Blender (for motions too intricate to script)
# The runtime's joint values map onto Blender rotations as: swing forward s -> rot X = -s; raise sideways r -> rot Y =
# -(side * r) with side L = +1, R = -1; elbow bend e -> rot X = -e. (Three.js sets the same joints directly:
# rotation.x = -s, rotation.z = side * r.)
def key_clip(clip, frames):
    """frames: [(frame, {joint: (rx, ry, rz) in degrees, Blender axes})]; one NLA track per joint, named after the clip."""
    for jn in {j for _, pose in frames for j in pose}:
        ob = J[jn]; ob.animation_data_create()
        act = bpy.data.actions.new(f"{clip}_{jn}"); ob.animation_data.action = act
        for f, pose in frames:
            if jn in pose:
                ob.rotation_euler = tuple(math.radians(v) for v in pose[jn]); ob.keyframe_insert("rotation_euler", frame=f)
        tr = ob.animation_data.nla_tracks.new(); tr.name = clip       # same track name on every joint: one glTF animation
        tr.strips.new(clip, 1, act); ob.animation_data.action = None

R = -1                                                   # the right arm's side
raise_R = lambda r: (0, -math.degrees(R * math.radians(r)) * 1, 0)   # degrees in, Blender (rx, ry, rz) out
rest = {"shoulder_R": (0, 0, 0), "elbow_R": (0, 0, 0), "head": (0, 0, 0), "body": (0, 0, 0)}
key_clip("idle", [(1, rest), (30, {**rest, "head": (-4, 3, 0), "body": (2, 0, 0)}), (60, rest)])
up = raise_R(140)                                        # the arm raised sideways, outward
key_clip("wave", [
    (1, rest),
    (8, {**rest, "shoulder_R": up, "elbow_R": (-15, 0, 0), "head": (0, -6, 0)}),
    (14, {**rest, "shoulder_R": up, "elbow_R": (-15, 0, 35), "head": (0, -6, 0)}),
    (20, {**rest, "shoulder_R": up, "elbow_R": (-15, 0, -10), "head": (0, -6, 0)}),
    (26, {**rest, "shoulder_R": up, "elbow_R": (-15, 0, 35), "head": (0, -6, 0)}),
    (36, rest),
])
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

# (a) ambient occlusion into the colour attribute of the parts that never move against each other (base, body,
# head and what is fixed to them). Moving parts (arms) are left out: shading baked against the body at rest would stay
# dark when the arm is raised. A short AO distance keeps it to contact shading.
world.light_settings.distance = 0.15
fixed = {k: o for k, o in parts.items() if not k.split(".")[0] in ("upper", "fore", "mitten")}
for k, o in parts.items():                 # moving parts keep plain copies of their materials (no AO input)
    if k not in fixed:
        o.material_slots[0].material = o.material_slots[0].material.copy()
for o in fixed.values():
    o.data.color_attributes.new("ao", "BYTE_COLOR", "POINT")
    o.data.color_attributes.active_color = o.data.color_attributes["ao"]
select_only(list(fixed.values()))
t = time.time()
bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
report["ao_bake_s"] = round(time.time() - t, 2)
# the baked AO multiplies the base colour (so the exporter writes it as COLOR_0 and Three.js uses it)
for m in {s.material for o in fixed.values() for s in o.material_slots}:
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
