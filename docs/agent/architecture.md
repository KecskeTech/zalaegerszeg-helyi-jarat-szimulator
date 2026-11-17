# Architecture

## Overview

Everything runs in the browser. `index.html` loads `js/main.js` as an ES
module; three.js is resolved through the import map in `index.html`
(`three` -> `vendor/three.module.js`). There is no build step and no
dependency install.

`main.js` owns all mutable application state (current route, traffic light
manager, camera mode, autopilot, sound). Other modules are classes or factory
functions that receive the three.js `scene`, the route, or the city data.

## Module map

| File | Responsibility |
| --- | --- |
| `js/main.js` | Scene/renderer/camera setup, game loop, input, HUD, start screen, `window.SIM` debug hooks |
| `js/city.js` | Builds static city geometry from `CITY` (roads, walkways, buildings, green areas, rails, trees, 3D grass) and lights |
| `js/bus.js` | `createBus()` low-floor electric bus model and `createCockpit()` interior |
| `js/driver.js` | Vehicle physics, route following, stop timing, street name lookup, building collision, grass slowdown |
| `js/traffic.js` | Per-route traffic lights and their state cycle |
| `js/markers.js` | Route line, stop signs, stop bay markings |
| `js/minimap.js` | 2D canvas GPS minimap |
| `js/passengers.js` | Waiting, boarding and alighting passenger meshes |
| `js/potholes.js` | Pothole placement, detection and shake trigger |
| `js/audio.js` | Procedural WebAudio electric bus soundscape |
| `js/data/zalaegerszeg.js` | Generated `CITY` object (roads, stops, routes, lights) |
| `tools/build-data.mjs` | Offline data builder (OSM + routing + light detection) |

## Runtime flow

1. `main.js` builds the static scene once with `buildCity(scene, CITY)`.
2. The start screen lists `CITY.routes`. Clicking a card calls `startRoute(r)`.
3. `startRoute` disposes the previous per-route objects, creates
   `TrafficLights`, `RouteMarkers` and `Potholes`, and calls `driver.setRoute`.
4. `frame()` requests the next animation frame, advances `driver.update`, then
   updates passengers, potholes, traffic lights, minimap, audio and the HUD.
5. `backToMenu()` disposes per-route objects and shows the start screen.

## State and disposables

Per-route objects (`traffic`, `markers`, `potholes`) are created in
`startRoute` and must be disposed before replacing them. Each class exposes a
`dispose()` that removes its group from the scene and disposes geometries and
materials. The static city is built once and never disposed.

## Debug hooks

`window.SIM` exposes `{ driver, bus, CITY, camera, renderer, passengers, audio,
startRoute }`, plus `route` and `traffic` once a route starts. Useful for manual
inspection from DevTools:

```js
SIM.route.lights;          // traffic lights for the current route
SIM.driver.progress;       // metres along the route
SIM.driver.speed;          // m/s
SIM.startRoute(SIM.CITY.routes[2]);
```

The driver does not expose a public teleport method; changing `progress`,
`x`, `z` and `heading` directly works for debugging only.
