"""Rebuild the mobile-friendly banana grove asset with Blender 5.2.

blender --background --python scripts/prepare-banana-plant.py
"""

from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/models/banana/PlantWithBananas.fbx"
TARGET = ROOT / "public/assets/models/banana/PlantWithBananas.glb"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.fbx(filepath=str(SOURCE))

# The FBX embeds several large images. Resizing the images in Blender keeps
# their alpha channels and material assignments while reducing GPU memory.
for image in bpy.data.images:
    if image.source != "FILE" or not image.has_data:
        continue
    width, height = image.size
    if max(width, height) > 1024:
        factor = 1024 / max(width, height)
        image.scale(max(1, round(width * factor)), max(1, round(height * factor)))

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
for obj in meshes:
    modifier = obj.modifiers.new("Mobile triangle budget", "DECIMATE")
    modifier.ratio = 0.35
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)
print(f"Banana plant: {len(meshes)} meshes, {len(bpy.data.images)} images")
bpy.ops.export_scene.gltf(
    filepath=str(TARGET),
    export_format="GLB",
    export_apply=True,
    export_image_format="AUTO",
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
)
print(f"Wrote {TARGET} ({TARGET.stat().st_size} bytes)")
