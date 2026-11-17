# Data pipeline

## Inputs

- `raw/osm_city.json` - Overpass export of Zalaegerszeg roads, buildings,
  green areas and railways.
- `raw/bus_stops.json` - Overpass export of real bus stop nodes.
- `raw/bus_routes.json` / `raw/stop_names.txt` - reference material for route
  definitions.

## Output

`tools/build-data.mjs` writes `js/data/zalaegerszeg.js`:

```js
export const CITY = { meta, bounds, roads, walkways, buildings, areas, rails, stops, routes };
```

The file is committed. It is large (about 2.5 MB) and **always generated**:
change the builder and regenerate rather than editing it by hand.

## Coordinate system

Local metric coordinates in metres, relative to `LAT0 = 46.8454`,
`LON0 = 16.8472`:

- `x = (lon - LON0) * 111320 * cos(LAT0)`
- `z = -(lat - LAT0) * 111320` (so north is negative z, south is positive z)
- `y` is up.

Route `path` is a flat `[x, z, x, z, ...]` array; `cum` holds the cumulative
distance at each point. A position along a route is called `s` (metres).

## Route building

1. `ROUTE_DEFS` lists each route ref, name, colour and ordered stop names.
   Names must match the OSM stop names; `EXTRA_STOPS` adds stops that the
   timetable has but OSM does not export as bus stops (for example
   `Köztemető (Göcseji út)` and `Landorhegyi út 60.` on route 20).
   Route 20 follows the real timetable order
   (Csertán Sándor utca -> Kovács Károly tér -> Gasparich utca -> Csertán
   Sándor utca), not the old Landorhegy loop.
2. Stops are resolved by name, choosing the nearest candidate stop to the
   previous stop for repeated names.
3. Each leg is routed on a locally built road graph from `CITY.roads` using
   A* (the primary path).
4. If the local graph cannot route a leg, the builder falls back to the public
   OSRM router, then to a straight line.
5. The path is densified to about 4 m steps; stops are projected onto it.

## Traffic lights

Two mechanisms add lights:

- `detectLights(route)` scans the route for perpendicular drivable roads close
  to the path (crossing junctions with a wide enough road segment).
- `MANUAL_JUNCTIONS` adds lights at known real signalised junctions within
  55 m of the route.

`REMOVED_LIGHTS` is an explicit deny-list applied after both passes. It exists
for lights that must not appear in the sim (currently the light in front of the
railway station / Kisposta). Keep it in the builder so regeneration does not
bring the light back.

## Regenerating

```
node tools/build-data.mjs
```

Requires internet only if the local graph fails and OSRM is used. After
regenerating, check `git diff` for unintended geometry changes and verify the
affected routes in the browser.
