"""The figurine kit: shape and material helpers for blender/cast.py (and anything else built in code).

Units are metres, Blender axes: Z up, the figure faces -Y, its left hand is +X. Every helper returns a linked object.
"""
import bpy
import bmesh
import math
from mathutils import Vector


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.use_denoising = False          # Ubuntu's Blender is built without OpenImageDenoise (blender/NOTES.md)
    sc.cycles.device = "CPU"                 # no GB10 kernels in this build: GPU bakes come out black
    return sc


def srgb(h):
    """'#rrggbb' -> linear RGB (Blender colours are linear)."""
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def material(name, hex_color, rough=0.32, coat=0.5, metal=0.0, double=False):
    """Lacquered paint by default: a glossy clear coat over a soft base (exports as KHR_materials_clearcoat)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(hex_color), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
        b.inputs["Coat Roughness"].default_value = 0.08
    m.use_backface_culling = not double
    return m


def link(obj):
    bpy.context.collection.objects.link(obj)
    return obj


def _finish(name, bm, mat, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    if mat:
        me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def smooth_profile(points, n=24):
    """Catmull-Rom through (radius, height) control points: a soft turned silhouette from a few numbers."""
    pts = [Vector((r, 0, z)) for r, z in points]
    out = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = pts[max(0, i - 1)], pts[i], pts[i + 1], pts[min(len(pts) - 1, i + 2)]
        steps = max(2, n // (len(pts) - 1))
        for k in range(steps):
            t = k / steps
            t2, t3 = t * t, t * t * t
            v = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append((max(0.0005, v.x), v.z))
    out.append((max(0.0005, pts[-1].x), pts[-1].z))
    return out


def lathe(name, profile, mat, segments=48, angle=math.tau, start=0.0, cap=False):
    """Spin a (radius, height) profile around Z. angle < tau makes a shell (a vest, a shirt front); start rotates it
    (radians, from +X toward +Y): a shell centred on the front (-Y) needs start = -pi/2 - angle/2."""
    bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    full = abs(angle - math.tau) < 1e-6
    bmesh.ops.spin(bm, geom=verts + edges, axis=(0, 0, 1), cent=(0, 0, 0), angle=angle,
                   steps=segments if full else max(4, int(segments * angle / math.tau)), use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _finish(name, bm, mat)
    o.rotation_euler.z = start
    return o


def capsule(name, radius, length, mat, segments=24):
    """A rounded rod hanging down from its origin (an arm part): length is the straight part, radius the rounding."""
    q = math.pi / 2                                          # bottom hemisphere (centre -length), then the top one (centre 0)
    prof = [(radius * math.cos(-q + k / 8 * q), -length + radius * math.sin(-q + k / 8 * q)) for k in range(9)]
    prof += [(radius * math.cos(k / 8 * q), radius * math.sin(k / 8 * q)) for k in range(1, 9)]
    return lathe(name, prof, mat, segments=segments)


def sphere(name, r, mat, loc=(0, 0, 0), scale=(1, 1, 1), seg=40, rings=20):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    o = _finish(name, bm, mat)
    o.location = loc; o.scale = scale
    return o


def sphere_cap(name, r, mat, keep, loc=(0, 0, 0), scale=(1, 1, 1), seg=48, rings=24):
    """A sphere with the vertices removed where keep(x, y, z) is False (a hairline, a beard, a cap's dome)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v.co.x, v.co.y, v.co.z)], context="VERTS")
    o = _finish(name, bm, mat)
    o.location = loc; o.scale = scale
    return o


def cylinder(name, r1, r2, depth, mat, loc=(0, 0, 0), seg=48, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)       # caps face outward (a flipped cap vanishes under culling)
    o = _finish(name, bm, mat)
    o.location = loc
    if bevel:
        bv = o.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 3; bv.limit_method = "ANGLE"
        o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
        o.data.use_auto_smooth = True            # weighted normals need it (Blender 4.0)
        ws = o.modifiers.new("weighted", "WEIGHTED_NORMAL"); ws.keep_sharp = True
    return o


def box(name, size, mat, loc=(0, 0, 0), bevel=0.01):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    o = _finish(name, bm, mat, smooth=False)
    o.location = loc
    if bevel:
        bv = o.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 3
        o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))
        o.data.use_auto_smooth = True
        o.modifiers.new("weighted", "WEIGHTED_NORMAL")
    return o


def torus(name, R, r, mat, loc=(0, 0, 0), rot=(0, 0, 0), arc=math.tau, seg=48, minor=12):
    """A ring, or an arc of one (arc < tau) lying in the XY plane before rot is applied."""
    bm = bmesh.new()
    steps = max(4, int(seg * arc / math.tau))
    for i in range(steps + (0 if arc >= math.tau else 1)):
        a = arc * i / steps
        cx, cy = R * math.cos(a), R * math.sin(a)
        ring = []
        for j in range(minor):
            b = math.tau * j / minor
            d = R + r * math.cos(b)
            ring.append(bm.verts.new((d * math.cos(a), d * math.sin(a), r * math.sin(b))))
        if i:
            for j in range(minor):
                bm.faces.new((prev[j], prev[(j + 1) % minor], ring[(j + 1) % minor], ring[j]))
        else:
            first = ring
        prev = ring
    if arc >= math.tau:
        for j in range(minor):
            bm.faces.new((prev[j], prev[(j + 1) % minor], first[(j + 1) % minor], first[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = _finish(name, bm, mat)
    o.location = loc; o.rotation_euler = rot
    return o


def disc(name, r, mat, loc=(0, 0, 0), rot=(0, 0, 0), seg=24):
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=seg, radius=r)
    o = _finish(name, bm, mat)
    o.location = loc; o.rotation_euler = rot
    return o


def empty(name, loc=(0, 0, 0), parent=None):
    e = link(bpy.data.objects.new(name, None))
    e.empty_display_size = 0.04
    e.location = loc
    e.rotation_mode = "XYZ"
    if parent is not None:
        e.parent = parent
    return e


def attach(obj, parent):
    """Parent keeping the world transform (parts hang from the axis-free joint pivots)."""
    bpy.context.view_layer.update()
    mw = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    obj.matrix_world = mw
    return obj
