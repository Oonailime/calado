"""Create a door rig and a real opening in the original business GLB.
Run: python3 scripts/animate-business-building.py
The source remains available for reproducible re-exports.
"""
import json
import math
import struct
from pathlib import Path

folder = Path('public/assets/models/business')
source = (folder / 'business-building.glb').read_bytes()
json_length = struct.unpack_from('<I', source, 12)[0]
gltf = json.loads(source[20:20 + json_length])
binary = source[28 + json_length:]

def read_accessor(index):
    accessor = gltf['accessors'][index]
    view = gltf['bufferViews'][accessor['bufferView']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[accessor['type']]
    fmt = {5123: 'H', 5125: 'I', 5126: 'f'}[accessor['componentType']]
    stride = view.get('byteStride', struct.calcsize(fmt) * width)
    offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
    return [list(struct.unpack_from('<' + fmt * width, binary, offset + i * stride)) for i in range(accessor['count'])]

def world(p):
    return [p[0] * 100, p[2] * 100, -p[1] * 100]

primitives = gltf['meshes'][0]['primitives']
all_positions = [world(p) for primitive in primitives for p in read_accessor(primitive['attributes']['POSITION'])]
floor = min(p[1] for p in all_positions)
scale = 2.9 / (max(p[1] for p in all_positions) - floor)
# Original front door bounds, measured from its disconnected Wood_Light panel.
door_left, door_right, door_top = -0.086, 0.080, 0.262
door_center = (door_left + door_right) / 2
front = 0.504

def placement(p):
    return [(p[0] - door_center) * scale, (p[1] - floor) * scale, (p[2] - front) * scale + 1.2]

# Clip wall triangles around the doorway, interpolating normal/UV attributes.
def clip(poly, axis, limit, keep_less):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        da, db = a[axis] - limit, b[axis] - limit
        inside_a = da <= 0 if keep_less else da >= 0
        inside_b = db <= 0 if keep_less else db >= 0
        if inside_a:
            out.append(a)
        if inside_a != inside_b:
            t = da / (da - db)
            out.append([x + (y - x) * t for x, y in zip(a, b)])
    return out

def outside_door(poly):
    remainder = poly
    pieces = []
    for axis, limit, outside_less in [(0, -0.081, True), (0, 0.075, False), (1, 0.0, True), (1, 0.263, False)]:
        exterior = clip(remainder, axis, limit, outside_less)
        if len(exterior) >= 3:
            pieces.append(exterior)
        remainder = clip(remainder, axis, limit, not outside_less)
        if not remainder:
            break
    return pieces

output = {'asset': {'version': '2.0', 'generator': 'animate-business-building.py'},
          'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [], 'meshes': [],
          'materials': gltf['materials'], 'bufferViews': [], 'accessors': []}
data = bytearray()

def accessor(values, width, kind='f'):
    while len(data) % 4:
        data.append(0)
    offset = len(data)
    for value in values:
        data.extend(struct.pack('<' + kind * width, *value))
    view = len(output['bufferViews'])
    output['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data) - offset})
    acc = {'bufferView': view, 'componentType': 5126 if kind == 'f' else 5125,
           'count': len(values), 'type': {1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4'}[width]}
    acc['min'] = [min(v[i] for v in values) for i in range(width)]
    acc['max'] = [max(v[i] for v in values) for i in range(width)]
    index = len(output['accessors'])
    output['accessors'].append(acc)
    return index

hinge = placement([door_left, 0, front])
static, moving = [], []
door_triangles = 0
for primitive in primitives:
    attrs = primitive['attributes']
    positions = [world(p) for p in read_accessor(attrs['POSITION'])]
    normals = [[p[0], p[2], -p[1]] for p in read_accessor(attrs['NORMAL'])]
    uvs = read_accessor(attrs['TEXCOORD_0'])
    indices = [i[0] for i in read_accessor(primitive['indices'])]
    buckets = {'static': [], 'door': []}
    material = gltf['materials'][primitive['material']]['name']
    for i in range(0, len(indices), 3):
        triangle = [positions[j] + normals[j] + uvs[j] for j in indices[i:i+3]]
        is_door = material == 'Wood_Light' and all(-0.09 < v[0] < 0.09 and v[1] < 0.27 and 0.46 < v[2] < 0.52 for v in triangle)
        if is_door:
            buckets['door'].extend(triangle)
            door_triangles += 1
        elif material in ['Walls', 'Stone'] and all(0.44 < v[2] < 0.51 for v in triangle):
            for poly in outside_door(triangle):
                for j in range(1, len(poly) - 1):
                    buckets['static'].extend([poly[0], poly[j], poly[j+1]])
        else:
            buckets['static'].extend(triangle)
    for bucket, vertices in buckets.items():
        if not vertices:
            continue
        ps = [placement(v[:3]) for v in vertices]
        if bucket == 'door':
            ps = [[p[i] - hinge[i] for i in range(3)] for p in ps]
        primitive_out = {'attributes': {'POSITION': accessor(ps, 3),
                                       'NORMAL': accessor([v[3:6] for v in vertices], 3),
                                       'TEXCOORD_0': accessor([v[6:8] for v in vertices], 2)},
                         'material': primitive['material'], 'mode': 4}
        (moving if bucket == 'door' else static).append(primitive_out)
assert door_triangles >= 10, 'Front door extraction failed'
output['meshes'] = [{'name': 'BusinessShell', 'primitives': static}, {'name': 'BusinessDoor', 'primitives': moving}]
output['nodes'] = [
    {'name': 'BusinessBuilding', 'children': [1, 2, 4]},
    {'name': 'BusinessShell', 'mesh': 0},
    {'name': 'BusinessDoorHinge', 'translation': hinge, 'children': [3]},
    {'name': 'BusinessDoor', 'mesh': 1},
    {'name': 'DoorThreshold', 'translation': [0, 0, 1.2]},
]
times = accessor([[0], [1]], 1)
angle = -math.pi * 0.62
rotations = accessor([[0, 0, 0, 1], [0, math.sin(angle / 2), 0, math.cos(angle / 2)]], 4)
output['animations'] = [{'name': 'Door_Open', 'samplers': [{'input': times, 'output': rotations, 'interpolation': 'LINEAR'}],
                         'channels': [{'sampler': 0, 'target': {'node': 2, 'path': 'rotation'}}]}]
output['buffers'] = [{'byteLength': len(data)}]
json_chunk = json.dumps(output, separators=(',', ':')).encode()
json_chunk += b' ' * (-len(json_chunk) % 4)
data.extend(b'\x00' * (-len(data) % 4))
packed = struct.pack('<III', 0x46546C67, 2, 28 + len(json_chunk) + len(data))
packed += struct.pack('<II', len(json_chunk), 0x4E4F534A) + json_chunk
packed += struct.pack('<II', len(data), 0x004E4942) + data
(folder / 'business-building-animated.glb').write_bytes(packed)
print(f'Exported animated business: {len(packed)} bytes, {door_triangles} door triangles; threshold [0, 0, 1.2]')
