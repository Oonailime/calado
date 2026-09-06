# Banana

https://polyfork.dev/asset/banana-09c206

A parametric low-poly model for three.js. One import, no loader, no textures,
one draw call. `createAsset()` returns a ready `THREE.Group`.

## What is in this folder

| file | what it is |
| --- | --- |
| `index.html` | a complete working page: **double-click it** |
| `banana-09c206.mjs` | the model as an ES module, with every option below |
| `banana-09c206.glb` | the same model baked, for Unity, Godot, Blender and glTF loaders |
| `LICENSE.txt` | the terms, in short: use it commercially, do not resell it, do not build a commercial asset generator from it |

## Run it

Double-click `index.html`. It needs an internet connection the first time,
because three.js is pulled from unpkg.com.

It carries its own copy of the model code so that it works from a `file://`
URL, where browsers refuse to load ES modules. If you would rather edit
`banana-09c206.mjs` and see the page pick up your changes, serve the folder
and it will import the file instead of the copy:

```
python3 -m http.server     # then open http://localhost:8000
```

## Use it in your own scene

```js
import { createAsset } from './banana-09c206.mjs';
scene.add(createAsset());
```

The bare `three` specifiers resolve through any bundler (Vite, webpack, esbuild),
or through an importmap in your page:

```html
<script type="importmap">
{ "imports": { "three": "https://unpkg.com/three@0.180.0/build/three.module.js",
               "three/addons/": "https://unpkg.com/three@0.180.0/examples/jsm/" } }
</script>
```

Prefer the GLB? `new GLTFLoader().load('banana-09c206.glb', g => scene.add(g.scene))`.
The module is the smaller and more flexible of the two: it carries the options
below, the GLB is one frozen configuration of them.

## Options

```js
createAsset({
  colorway: 'ripe',
  bend: 56,
  girth: 1,
});
```

| option | type | default | accepts | what it does |
| --- | --- | --- | --- | --- |
| `colorway` | choice | `'ripe'` | `'ripe'`, `'green'`, `'overripe'`, `'red'` | Curated scheme. ripe is the approved banana (mid-yellow peel, pale lit ridge, deep-gold belly ridge, near-dark brown stalk); green is a starchy unripe fruit; overripe is a deep tan baking banana; red is the red cultivar. Geometry never changes, only the four zone colours. |
| `bend` | range | `56` | `44` to `68` | Curl of the crescent in degrees: the centerline sweeps twice this angle tip to tip, so 44 is a gentle plantain curve (~0.20 m tip to tip), 56 is the approved build, 68 a tight tropical curl (~0.19 m tip to tip, ~0.12 m tall). Length along the arc and triangle count (286) never change; it still rests on y=0 at every setting. |
| `girth` | range | `1` | `0.8` to `1.25` | Scale factor on the whole cross-section, stalk included: 1.0 is the approved ~0.052 m mid-body diameter, 0.8 a slim lady-finger (~0.042 m), 1.25 a fat plantain (~0.065 m). Arc length and curl never change. Triangle count stays 286 at every setting. |

## Specs

286 triangles, 1 material, 0.2 × 0.1 × 0.05 m, real-world scale.

## Building this with an AI agent?

Point it at https://polyfork.dev/prompt.txt: the whole catalogue as working
instructions, no key needed to browse. There is an MCP server too, at https://polyfork.dev/mcp.

## License

Personal and commercial use: games, apps, websites, client work.
Modify freely, no attribution required. Do not resell or redistribute the files
themselves as assets, or use them to build or train a COMMERCIAL asset
generator: a model, service or pipeline that produces 3D assets and that you
sell or offer to others. Personal experiments, research and learning are fine.
Breaking these terms can end your license and your access, without a refund.

Full terms: https://polyfork.dev/licensing
