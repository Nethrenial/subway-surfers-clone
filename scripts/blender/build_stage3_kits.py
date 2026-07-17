import bpy
import math
import os


ROOT = "/Users/nethrenial/Projects/Personal/Games/subway_surfer_clone"


def material(name):
    return bpy.data.materials[name]


def clear_collection(name):
    collection = bpy.data.collections[name]
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    return collection


def move_to(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def empty(name, collection):
    obj = bpy.data.objects.new(name, None)
    collection.objects.link(obj)
    return obj


def cube(name, location, dimensions, material_name, parent, collection, bevel=0.06, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    modifier = obj.modifiers.new("EdgeSoftening", "BEVEL")
    modifier.width = bevel
    modifier.segments = 3
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.materials.append(material(material_name))
    obj.parent = parent
    move_to(obj, collection)
    return obj


def cylinder(name, location, radius, depth, material_name, parent, collection, rotation=(0, 0, 0), vertices=20):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material(material_name))
    obj.parent = parent
    move_to(obj, collection)
    return obj


def sphere(name, location, scale, material_name, parent, collection):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material(material_name))
    obj.parent = parent
    move_to(obj, collection)
    return obj


def torus(name, location, major, minor, material_name, parent, collection, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=24,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material(material_name))
    obj.parent = parent
    move_to(obj, collection)
    return obj


def cone(name, location, radius1, radius2, depth, material_name, parent, collection, vertices=8):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material(material_name))
    obj.parent = parent
    move_to(obj, collection)
    return obj


def export_roots(roots, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for root in roots:
        root.location = (0, 0, 0)
        for obj in [root] + list(root.children_recursive):
            obj.select_set(True)
    bpy.context.view_layer.objects.active = roots[0]
    bpy.ops.export_scene.gltf(
        filepath=f"{ROOT}/public/assets/models/{filename}.glb",
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )


def build_rewards():
    collection = clear_collection("REWARDS")
    roots = []

    token = empty("RelayTokenRoot", collection)
    roots.append(token)
    token["value"] = 1
    torus("TokenOuter", (0, 0, 0), 0.31, 0.075, "NR_Gold", token, collection, (math.pi / 2, 0, 0))
    torus("TokenInner", (0, -0.012, 0), 0.17, 0.035, "NR_Cyan", token, collection, (math.pi / 2, 0, 0))
    for index, angle in enumerate((0, 2.094, 4.188)):
        x, z = math.cos(angle) * 0.17, math.sin(angle) * 0.17
        cube(f"TokenBlade_{index}", (x, -0.035, z), (0.09, 0.05, 0.21), "NR_Ceramic", token, collection, 0.025, (0, angle, 0))
    sphere("TokenCore", (0, -0.055, 0), (0.085, 0.045, 0.085), "NR_Coral", token, collection)

    shard = empty("RareShardRoot", collection)
    roots.append(shard)
    shard["value"] = 5
    cone("ShardCrystal", (0, 0, 0), 0.28, 0.055, 0.92, "NR_Cyan", shard, collection, 6)
    torus("ShardBrace", (0, 0, 0), 0.36, 0.045, "NR_Gold", shard, collection, (math.pi / 2, 0, 0))
    for x in (-0.31, 0.31):
        cube(f"ShardClamp_{x}", (x, 0, 0), (0.1, 0.18, 0.24), "NR_Coral", shard, collection, 0.035)

    magnet = empty("PowerMagnetRoot", collection)
    roots.append(magnet)
    torus("MagnetField", (0, 0, 0), 0.34, 0.07, "NR_Coral", magnet, collection, (math.pi / 2, 0, 0))
    for x in (-0.25, 0.25):
        cube(f"MagnetPole_{x}", (x, -0.02, -0.05), (0.18, 0.18, 0.38), "NR_Ceramic", magnet, collection, 0.05)
    cube("MagnetCore", (0, -0.04, 0.16), (0.28, 0.14, 0.16), "NR_Cyan", magnet, collection, 0.05)

    shield = empty("PowerShieldRoot", collection)
    roots.append(shield)
    sphere("ShieldShell", (0, 0, 0), (0.38, 0.12, 0.38), "NR_Cyan", shield, collection)
    cube("ShieldCrossV", (0, -0.13, 0), (0.1, 0.08, 0.46), "NR_Ceramic", shield, collection, 0.03)
    cube("ShieldCrossH", (0, -0.13, 0), (0.42, 0.08, 0.1), "NR_Ceramic", shield, collection, 0.03)

    multiplier = empty("PowerMultiplierRoot", collection)
    roots.append(multiplier)
    for x in (-0.17, 0.17):
        torus(f"MultiplierLoop_{x}", (x, 0, 0), 0.21, 0.055, "NR_Gold", multiplier, collection, (math.pi / 2, 0, 0))
    cube("MultiplierSlash", (0, -0.06, 0), (0.12, 0.08, 0.62), "NR_Coral", multiplier, collection, 0.035, (0, 0.68, 0))

    jump = empty("PowerJumpRoot", collection)
    roots.append(jump)
    for index, (z, scale) in enumerate(((-0.2, 1), (0.05, 0.78), (0.27, 0.56))):
        cube(f"JumpChevron_{index}", (0, 0, z), (0.58 * scale, 0.18, 0.13), "NR_Lime", jump, collection, 0.04, (0, 0, math.pi / 4))
    torus("JumpHalo", (0, 0.03, 0), 0.37, 0.035, "NR_Cyan", jump, collection, (math.pi / 2, 0, 0))

    export_roots(roots, "reward-power-kit")
    return roots


def build_world():
    collection = clear_collection("WORLD_KIT")
    roots = []

    arch = empty("TransitArchRoot", collection)
    roots.append(arch)
    for x in (-4.15, 4.15):
        cube(f"ArchPylon_{x}", (x, 0, 2.5), (0.42, 0.62, 5), "NR_Indigo", arch, collection, 0.12)
        cube(f"ArchLight_{x}", (x, -0.34, 2.7), (0.12, 0.04, 3.4), "NR_Cyan", arch, collection, 0.025)
    cube("ArchBeam", (0, 0, 5), (8.7, 0.7, 0.48), "NR_Ceramic", arch, collection, 0.16)
    cube("ArchSignal", (0, -0.38, 4.97), (3.3, 0.04, 0.13), "NR_Coral", arch, collection, 0.025)

    pylon = empty("RoutePylonRoot", collection)
    roots.append(pylon)
    cube("RoutePylonBody", (0, 0, 1.5), (0.72, 0.8, 3), "NR_Indigo", pylon, collection, 0.16)
    cube("RoutePylonFace", (0, -0.43, 1.7), (0.46, 0.05, 1.65), "NR_Ceramic", pylon, collection, 0.07)
    cube("RoutePylonLight", (0, -0.47, 1.8), (0.14, 0.025, 1.12), "NR_Cyan", pylon, collection, 0.02)
    sphere("RoutePylonBeacon", (0, -0.42, 3.12), (0.18, 0.1, 0.18), "NR_Gold", pylon, collection)

    lamp = empty("StreetLampRoot", collection)
    roots.append(lamp)
    cylinder("LampMast", (0, 0, 1.8), 0.09, 3.6, "NR_DarkMetal", lamp, collection, vertices=16)
    cube("LampArm", (0, -0.35, 3.55), (0.12, 0.75, 0.12), "NR_Ceramic", lamp, collection, 0.04)
    sphere("LampHead", (0, -0.75, 3.53), (0.28, 0.16, 0.12), "NR_Cyan", lamp, collection)
    cube("LampFlag", (0, 0.02, 2.6), (0.55, 0.08, 0.75), "NR_Coral", lamp, collection, 0.05, (0, 0, 0.08))

    billboard = empty("BillboardRoot", collection)
    roots.append(billboard)
    for x in (-1.3, 1.3):
        cylinder(f"BillPost_{x}", (x, 0, 1.35), 0.1, 2.7, "NR_DarkMetal", billboard, collection, vertices=14)
    cube("BillFrame", (0, 0, 2.65), (3.2, 0.3, 1.55), "NR_Ceramic", billboard, collection, 0.12)
    cube("BillScreen", (0, -0.18, 2.66), (2.82, 0.035, 1.18), "NR_Indigo", billboard, collection, 0.04)
    for index, (x, rotation) in enumerate(((-0.72, 0.55), (0, -0.55), (0.72, 0.55))):
        cube(f"BillGlyph_{index}", (x, -0.215, 2.66), (0.16, 0.025, 0.82), "NR_Cyan" if index != 1 else "NR_Coral", billboard, collection, 0.02, (0, rotation, 0))

    utility = empty("UtilityClusterRoot", collection)
    roots.append(utility)
    cube("UtilityBase", (0, 0, 0.22), (2.5, 1.1, 0.44), "NR_DarkMetal", utility, collection, 0.12)
    for x, height in ((-0.72, 1.55), (0, 1.95), (0.72, 1.35)):
        cylinder(f"UtilityTank_{x}", (x, 0, height / 2 + 0.38), 0.3, height, "NR_Indigo", utility, collection)
        torus(f"UtilityBand_{x}", (x, 0, 0.75), 0.31, 0.035, "NR_Coral", utility, collection)
        cube(f"UtilityLight_{x}", (x, -0.31, 0.7), (0.14, 0.035, 0.32), "NR_Cyan", utility, collection, 0.02)

    building_a = empty("BuildingARoot", collection)
    roots.append(building_a)
    cube("BuildingABase", (0, 0, 3.6), (5.2, 3.4, 7.2), "NR_IndigoMatte", building_a, collection, 0.32)
    cube("BuildingASetback", (0, 0.25, 7), (3.7, 2.8, 1.8), "NR_Ceramic", building_a, collection, 0.24)
    for z in (1.3, 2.4, 3.5, 4.6, 5.7):
        cube(f"BuildingAWindow_{z}", (0, -1.74, z), (4.45, 0.04, 0.36), "NR_Cyan", building_a, collection, 0.03)
    for x in (-1.6, 0, 1.6):
        cube(f"BuildingARoofFin_{x}", (x, 0.2, 8.4), (0.18, 1.4, 1.2), "NR_Coral", building_a, collection, 0.06)

    building_b = empty("BuildingBRoot", collection)
    roots.append(building_b)
    cube("BuildingBBody", (0, 0, 4.8), (3.6, 3, 9.6), "NR_Indigo", building_b, collection, 0.28)
    cube("BuildingBSpine", (1.65, 0.25, 5.4), (0.48, 2.8, 8.4), "NR_Ceramic", building_b, collection, 0.16)
    for z in (1.4, 2.6, 3.8, 5, 6.2, 7.4, 8.6):
        cube(f"BuildingBWindowL_{z}", (-0.72, -1.54, z), (0.92, 0.04, 0.33), "NR_Cyan", building_b, collection, 0.025)
        cube(f"BuildingBWindowR_{z}", (0.45, -1.54, z), (0.62, 0.04, 0.33), "NR_Coral", building_b, collection, 0.025)
    cube("BuildingBCrown", (0, 0, 10), (2.4, 2.2, 0.72), "NR_Gold", building_b, collection, 0.18)

    export_roots(roots, "world-kit")
    return roots


mode = os.environ.get("NEON_RELAY_KIT_MODE", "all")
reward_roots = build_rewards() if mode in ("all", "rewards") else []
world_roots = build_world() if mode in ("all", "world") else []
for index, root in enumerate(reward_roots):
    root.location.x = (index - 2.5) * 1.25
for index, root in enumerate(world_roots):
    root.location.x = (index - 3) * 5.8
    root.location.y = 8
bpy.ops.wm.save_as_mainfile(filepath=f"{ROOT}/art/blender/neon-relay-stage3.blend")
print(f"Kit mode {mode}: built {len(reward_roots)} reward roots and {len(world_roots)} world roots")
