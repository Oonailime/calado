"""Prepare the carved stump and hammer for the bridge construction site.

Source: assets_referencia/toco_construção/toco_martelo_talhado.glb (148k
triangles, 4096 px textures), never modified. One GLB per graphics tier, so
a lower quality also downloads and draws less (BridgeBuildStump.tsx maps the
game's four qualities onto them):

  ultra          carved-stump-ultra.glb   40k triangles, 2048 px
  high, medium   carved-stump-high.glb    20k triangles, 1024 px
  low            carved-stump-low.glb     10k triangles,  512 px

Each tier is scaled to WIDTH, centred with its base on the ground, reduced,
given fresh UVs and baked from the source: colour, relief (the source's
geometry and normal map) and roughness/metal. The bake margin pads every UV
island, so the textures mipmap without the seams of the source's atlas.

Run:
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python scripts/prepare-bridge-stump.py
Review renders: test-results/stump-<tier>.png (and stump-source.png).
"""
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets_referencia/toco_construção/toco_martelo_talhado.glb"
OUT_DIR = ROOT / "public/assets/models/bridge-stump"
PREVIEW = ROOT / "test-results"
WIDTH = 1.16  # metres; the game draws it at 50%
TIERS = {"ultra": (40000, 2048), "high": (20000, 1024), "low": (10000, 512)}
JPEG_QUALITY = 90
OUT_DIR.mkdir(parents=True, exist_ok=True)
PREVIEW.mkdir(exist_ok=True)


def select_only(objects, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[0]


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def use_gpu(scene):
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


def load_source(scene):
    """The original, scaled to WIDTH, centred, with its base on the ground."""
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
    return high


def source_images(material):
    """The source's colour and roughness/metal images (glTF import layout)."""
    nodes = material.node_tree.nodes
    principled = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")

    def image_behind(socket):
        node = socket.links[0].from_node
        while node.type != "TEX_IMAGE":
            node = next(i for i in node.inputs if i.links).links[0].from_node
        return node

    return image_behind(principled.inputs["Base Color"]), image_behind(principled.inputs["Roughness"])


def show_as_emission(material, image_node):
    tree = material.node_tree
    output = next(n for n in tree.nodes if n.type == "OUTPUT_MATERIAL")
    emission = next((n for n in tree.nodes if n.type == "EMISSION"), None) or tree.nodes.new("ShaderNodeEmission")
    tree.links.new(image_node.outputs["Color"], emission.inputs["Color"])
    tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])


def render_review(scene, obj, label):
    for other in scene.objects:
        if other.type == "MESH":
            other.hide_render = other != obj
    scene.cycles.samples = 48  # the bakes run at 1
    scene.render.filepath = str(PREVIEW / f"stump-{label}.png")
    bpy.ops.render.render(write_still=True)


def setup_review(scene):
    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1000, 700
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("Studio")
    scene.world.color = (0.12, 0.13, 0.15)

    def aim(obj, target):
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

    for name, location, energy in (("Key", (-1.8, -2.2, 2.4), 260), ("Fill", (2.0, -1.5, 1.2), 90),
                                   ("Back", (0.5, 2.2, 2.0), 150)):
        light = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        light.data.energy, light.data.size = energy, 2.0
        scene.collection.objects.link(light)
        light.location = location
        aim(light, (0, 0, 0.3))
    camera = bpy.data.objects.new("Review camera", bpy.data.cameras.new("Review camera"))
    scene.collection.objects.link(camera)
    scene.camera = camera
    camera.location = (1.3, -1.7, 1.0)
    aim(camera, (0.0, 0.0, 0.28))


def prepare(tier, target, size):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    high = load_source(scene)
    if tier == "ultra":
        setup_review(scene)
        render_review(scene, high, "source")
    source_material = high.data.materials[0]
    color_source, surface_source = source_images(source_material)

    low = high.copy()
    low.data = high.data.copy()
    low.name = "bridge-stump-carved-hammer"
    scene.collection.objects.link(low)
    select_only([low])
    # The source is split along its UV seams; weld it so the reduction and the
    # new UV layout work on one continuous surface.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.object.mode_set(mode="OBJECT")
    decimate = low.modifiers.new("Decimate", "DECIMATE")
    decimate.ratio = target / triangles(high)
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    if low.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    low.data.shade_smooth()
    while low.data.uv_layers:
        low.data.uv_layers.remove(low.data.uv_layers[0])
    low.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=6 / size, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    material = bpy.data.materials.new("Carved stump")
    material.use_nodes = True
    material.use_backface_culling = False  # double-sided, as the source
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes["Principled BSDF"]

    def bake_target(label, colorspace):
        image = bpy.data.images.new(f"stump-{label}", size, size, alpha=False)
        image.colorspace_settings.name = colorspace
        node = nodes.new("ShaderNodeTexImage")
        node.image = image
        return node

    color_node = bake_target("color", "sRGB")
    surface_node = bake_target("roughness-metal", "Non-Color")
    normal_node = bake_target("normal", "Non-Color")
    low.data.materials.clear()
    low.data.materials.append(material)

    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.samples = 1
    margin = max(8, size // 64)
    # A coarser mesh strays further from the source; reach further to find it.
    reach = 0.015 * (40000 / target) ** 0.5
    bake_settings = dict(use_selected_to_active=True, cage_extrusion=reach, max_ray_distance=reach * 2.5,
                         margin=margin)
    scene.render.bake.margin_type = "EXTEND"
    select_only([high, low], active=low)
    nodes.active = normal_node
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", **bake_settings)
    # Colour and roughness/metal read as emission, so lighting cannot tint them.
    show_as_emission(source_material, color_source)
    nodes.active = color_node
    bpy.ops.object.bake(type="EMIT", **bake_settings)
    show_as_emission(source_material, surface_source)
    nodes.active = surface_node
    bpy.ops.object.bake(type="EMIT", **bake_settings)

    links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])
    separate = nodes.new("ShaderNodeSeparateColor")
    links.new(surface_node.outputs["Color"], separate.inputs["Color"])
    links.new(separate.outputs["Green"], bsdf.inputs["Roughness"])
    links.new(separate.outputs["Blue"], bsdf.inputs["Metallic"])
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    bpy.data.objects.remove(high, do_unlink=True)

    co = np.empty(len(low.data.vertices) * 3)
    low.data.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    out = OUT_DIR / f"carved-stump-{tier}.glb"
    select_only([low])
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_tangents=True, export_image_format="JPEG",
                              export_jpeg_quality=JPEG_QUALITY, export_extras=False)
    print("STUMP_EXPORTED", tier, out.stat().st_size, "triangles", triangles(low),
          "width %.3f depth %.3f height %.3f" % tuple(co.max(0) - co.min(0)), flush=True)

    if tier != "ultra":
        setup_review(scene)
    render_review(scene, low, tier)


for tier, (target, size) in TIERS.items():
    prepare(tier, target, size)
print("STUMP_READY", flush=True)
