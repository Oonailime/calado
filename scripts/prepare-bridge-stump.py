"""Export the supplied carved stump and hammer for the bridge construction site.

Run with Blender --background --python scripts/prepare-bridge-stump.py.
Keeps the source geometry, UVs and PBR materials; embeds 2048px textures.
The original GLB is never modified. Keep data maps lossless to avoid introducing
compression marks into surface normals and roughness.
"""
from pathlib import Path
import json
import struct

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets_referencia/toco_construção/toco_martelo_talhado.glb"
OUTPUT = ROOT / "public/assets/models/bridge-stump/carved-stump.glb"
WIDTH = 1.16

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and not obj.hide_render]
bpy.ops.object.select_all(action="DESELECT")
for obj in meshes:
    obj.hide_set(False)
    obj.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
corners = [Vector(corner) for obj in meshes for corner in obj.bound_box]
low = Vector([min(v[i] for v in corners) for i in range(3)])
high = Vector([max(v[i] for v in corners) for i in range(3)])
center = (low + high) / 2
scale = WIDTH / (high.x - low.x)
transform = Matrix.Diagonal((scale, scale, scale, 1.0)) @ Matrix.Translation((-center.x, -center.y, -low.z))
for obj in meshes:
    obj.data.transform(transform)
    obj.data.update()
    obj.name = "bridge-stump-carved-hammer"

for image in bpy.data.images:
    width, height = image.size
    if max(width, height) > 2048:
        ratio = 2048 / max(width, height)
        image.scale(round(width * ratio), round(height * ratio))
    image.file_format = "PNG"
    image.pack()

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT), export_format="GLB", use_selection=True,
    export_apply=True, export_yup=True, export_tangents=True,
    export_image_format="AUTO",
)

# This atlas has tightly packed UV islands. Averaged mip levels mix their
# colours and draw bright scratch-like seams over the bark. Store a linear,
# non-mipmapped colour sampler in the GLB itself; keep normal/roughness maps
# and the source's shading intact. Give it its own sampler, since Blender
# may share one sampler between all three textures.
glb = OUTPUT.read_bytes()
json_length = struct.unpack_from("<I", glb, 12)[0]
document = json.loads(glb[20:20 + json_length])
samplers = document.setdefault("samplers", [])
for material in document.get("materials", []):
    texture_index = material["pbrMetallicRoughness"]["baseColorTexture"]["index"]
    texture = document["textures"][texture_index]
    sampler = dict(samplers[texture["sampler"]]) if "sampler" in texture else {}
    sampler.update(minFilter=9729, magFilter=9729)  # glTF LINEAR
    texture["sampler"] = len(samplers)
    samplers.append(sampler)
encoded = json.dumps(document, separators=(",", ":")).encode("utf8")
encoded += b" " * (-len(encoded) % 4)
remaining_chunks = glb[20 + json_length:]
OUTPUT.write_bytes(
    struct.pack("<4sII", b"glTF", 2, 20 + len(encoded) + len(remaining_chunks))
    + struct.pack("<I4s", len(encoded), b"JSON") + encoded + remaining_chunks
)
print("STUMP_EXPORTED", OUTPUT.stat().st_size,
      "dimensions", list((high - low) * scale),
      "triangles", sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons), flush=True)
