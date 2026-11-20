# Rendering and scene

## Conventions

- three.js is imported as `import * as THREE from "three"` everywhere.
- All lengths are metres, all rotations radians.
- Scene graph groups are added to the scene in the constructor or factory and
  removed in `dispose()`.
- `mesh.castShadow` / `receiveShadow` are enabled selectively; the sun is a
  directional light configured in `city.js`.
- Textures are generated with 2D canvas and `THREE.CanvasTexture`; set
  `tex.colorSpace = THREE.SRGBColorSpace` for colour maps.
- Shared geometry/material instances are reused inside a module where possible;
  per-route objects create their own and dispose them.

## Per-route lifecycle

`main.js` creates per-route objects in `startRoute` and disposes them in
`backToMenu` or before creating replacements. If you add a new per-route
system, follow the same contract:

```js
class Example {
  constructor(scene, route) { /* build group, scene.add(group) */ }
  update(dt, state) { /* per-frame work */ }
  dispose() { /* scene.remove(group); dispose geometries and materials */ }
}
```

Dispose both geometry and material, including arrays of materials:

```js
o.geometry?.dispose();
if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
else o.material?.dispose();
```

## Camera modes

- Third person: orbit offset behind the bus, mouse drag changes yaw/pitch,
  double-click resets the orbit.
- First person: camera sits in the cockpit; the cockpit group is attached to
  the camera and only visible in this mode.

`updateCamera()` in `main.js` is the single place that positions the camera.
Do not move the camera elsewhere.

## Performance notes

- Avoid adding per-frame allocations in the game loop and in `update()`
  methods; reuse vectors and objects.
- Prefer `setTargetAtTime` for audio gain changes over recreating nodes.
- The city data is large; do not clone it per frame.
- 3D grass is a single `InstancedMesh` of small blade triangles (`createGrass`
  in `city.js`). It is cosmetic only and must never be added to collision
  checks. Keep the instance cap in mind when increasing density.
- Terrain is a smooth height field: `terrainHeight(x, z)` in `city.js` drives
  the ground mesh vertices, road/walkway ribbons, area polygons, building
  bases, trees, grass and the bus. Every ground-placed object must sample it,
  or it will float or sink on a slope. Keep the field low-frequency; sharp
  changes break the flat building bases and road quads.
