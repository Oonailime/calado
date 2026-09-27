"""Prepare the wisdom totem for the game from the supplied Meshy AI model.

Source: assets_referencia/totem/referencia/Meshy_AI_Silent_Wisdom_0927102534_texture.glb
(about 2.1 million triangles and 4096 px textures, 85 MB). From the front,
left to right: hands over the ears, over the mouth and over the eyes.

Run:
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python scripts/prepare-wisdom-totem.py

The carving is scaled to the game, set on the ground and reduced to a light
mesh with fresh UVs; the original's colour and relief (its geometry and its
normal map) are baked onto that mesh. Output:
public/assets/models/totem/three-wise-monkeys.glb, with review renders in
test-results/totem-game-*.png.
"""
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets_referencia/totem/referencia/Meshy_AI_Silent_Wisdom_0927102534_texture.glb"
OUT = ROOT / "public/assets/models/totem/three-wise-monkeys.glb"
PREVIEW = ROOT / "test-results"
WIDTH = 2.3            # metres across the plinth in the game
TRIANGLES = 50000      # of the game mesh
TEXTURE_SIZE = 2048
ROUGHNESS = 0.55       # satin wood (the source's roughness map averages ~0.46)
OUT.parent.mkdir(parents=True, exist_ok=True)
PREVIEW.mkdir(exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.world = bpy.data.worlds.new("Studio")


def select_only(objects, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def use_gpu():
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA"):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            if [d for d in prefs.devices if d.type == kind]:
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = "GPU"
                return
    except Exception as error:  # noqa: BLE001 - CPU rendering still works
        print("GPU unavailable:", error, flush=True)


# The original: scaled to WIDTH, centred, with the plinth on the ground.
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes = [o for o in scene.objects if o.type == "MESH"]
select_only(meshes)
if len(meshes) > 1:
    bpy.ops.object.join()
high = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
co = np.empty(len(high.data.vertices) * 3)
high.data.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
low_corner, high_corner = co.min(0), co.max(0)
scale = WIDTH / (high_corner[0] - low_corner[0])
centre = (low_corner + high_corner) / 2
high.data.transform(Matrix.Diagonal((scale, scale, scale, 1.0))
                    @ Matrix.Translation((-centre[0], -centre[1], -low_corner[2])))
high.data.update()

# The game mesh: decimated, smooth, with its own UV layout.
low = high.copy()
low.data = high.data.copy()
low.name = "three-wise-monkeys"
scene.collection.objects.link(low)
select_only([low])
# The source is split along its UV seams; weld it so the reduction and the
# new UV layout work on one continuous surface.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode="OBJECT")
print("WELDED_VERTICES", len(low.data.vertices), "of", len(high.data.vertices), flush=True)
decimate = low.modifiers.new("Decimate", "DECIMATE")
decimate.ratio = TRIANGLES / triangles(high)
bpy.ops.object.modifier_apply(modifier=decimate.name)
if low.data.has_custom_normals:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
low.data.shade_smooth()
while low.data.uv_layers:
    low.data.uv_layers.remove(low.data.uv_layers[0])
low.data.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.003, area_weight=0.0, correct_aspect=True,
                         scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
print("GAME_TRIANGLES", triangles(low), flush=True)

material = bpy.data.materials.new("Carved walnut totem")
material.use_nodes = True
material.use_backface_culling = True  # a closed carving: single-sided in glTF
nodes, links = material.node_tree.nodes, material.node_tree.links
bsdf = nodes["Principled BSDF"]
bsdf.inputs["Roughness"].default_value = ROUGHNESS
bsdf.inputs["Metallic"].default_value = 0.0


def bake_image(label, colorspace):
    image = bpy.data.images.new(label, TEXTURE_SIZE, TEXTURE_SIZE, alpha=False)
    image.colorspace_settings.name = colorspace
    node = nodes.new("ShaderNodeTexImage")
    node.image = image
    return node


color_node = bake_image("totem-color", "sRGB")
normal_node = bake_image("totem-normal", "Non-Color")
low.data.materials.clear()
low.data.materials.append(material)

scene.render.engine = "CYCLES"
use_gpu()
scene.cycles.samples = 1
bake = scene.render.bake
bake.margin = 16
bake.margin_type = "EXTEND"
select_only([high, low], active=low)
nodes.active = normal_node
bpy.ops.object.bake(type="NORMAL", use_selected_to_active=True, cage_extrusion=0.02, max_ray_distance=0.05,
                    normal_space="TANGENT", margin=16)

# The source's base colour, read as emission so lighting and its (unused)
# metallic channel cannot tint the bake.
for source_material in high.data.materials:
    tree = source_material.node_tree
    principled = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    output = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
    emission = tree.nodes.new("ShaderNodeEmission")
    base = principled.inputs["Base Color"]
    if base.links:
        tree.links.new(base.links[0].from_socket, emission.inputs["Color"])
    else:
        emission.inputs["Color"].default_value = base.default_value
    tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
nodes.active = color_node
bpy.ops.object.bake(type="EMIT", use_selected_to_active=True, cage_extrusion=0.02, max_ray_distance=0.05,
                    margin=16)
print("BAKED", flush=True)
bpy.data.objects.remove(high, do_unlink=True)

links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])
normal_map = nodes.new("ShaderNodeNormalMap")
links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

co = np.empty(len(low.data.vertices) * 3)
low.data.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
print("TOTEM_BOUNDS x %.3f..%.3f height %.3f..%.3f front %.3f..%.3f"
      % (co[:, 0].min(), co[:, 0].max(), co[:, 2].min(), co[:, 2].max(), -co[:, 1].max(), -co[:, 1].min()),
      flush=True)
select_only([low])
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB", use_selection=True, export_apply=True,
                          export_yup=True, export_tangents=True, export_image_format="JPEG",
                          export_jpeg_quality=88, export_extras=False)
print("TOTEM_EXPORTED", OUT.stat().st_size, flush=True)

# Review renders of the game mesh.
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1280, 800
scene.view_settings.view_transform = "AgX"
scene.world.color = (0.12, 0.13, 0.15)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


for name, location, energy in (("Key", (-3.5, -4.5, 5.0), 900), ("Fill", (4.0, -3.0, 2.5), 300),
                               ("Back", (1.0, 4.5, 4.0), 500)):
    light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
    light.data.energy, light.data.size = energy, 4.0
    scene.collection.objects.link(light)
    light.location = location
    aim(light, (0, 0, 0.7))
camera = bpy.data.objects.new("Review camera", bpy.data.cameras.new("Review camera"))
scene.collection.objects.link(camera)
scene.camera = camera
for label, location, target in (("front", (0.0, -5.5, 1.3), (0.0, 0.0, 0.72)),
                                ("quarter", (3.4, -4.3, 1.7), (0.0, 0.0, 0.7)),
                                ("back", (0.0, 5.5, 1.3), (0.0, 0.0, 0.72))):
    camera.location = location
    aim(camera, target)
    scene.render.filepath = str(PREVIEW / f"totem-game-{label}.png")
    bpy.ops.render.render(write_still=True)
print("TOTEM_READY", flush=True)
