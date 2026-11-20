# Zalaegerszeg Local Bus Simulator

A browser-based 3D bus simulator set in downtown Zalaegerszeg, Hungary. It
features real bus stops, real local bus routes, an electric solo bus,
first- and third-person views, a GPS minimap and working traffic lights.

## Running

You need **Node.js 18 or newer** (https://nodejs.org/). After installing it:

- Windows: double-click `indito.bat`, or
- from a terminal: `node server.mjs`

The simulator then opens at <http://127.0.0.1:8123/>. `server.mjs` only
serves static files and has no dependencies.

Opening `index.html` directly is not recommended: browsers do not allow
ES modules to be loaded from a `file://` URL.

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | throttle |
| `S` / `↓` | brake, then reverse |
| `A` `D` / `←` `→` | steering |
| `Space` | parking brake |
| `C` | first / third-person view |
| `G` | autopilot on/off |
| `H` | spoken stop announcements on/off |
| `R` | reset the bus to the start of the route |
| mouse drag | orbit the camera (third person) |
| `B` | horn |

Pick a route by clicking a card on the start screen. A direct link also
works: `http://127.0.0.1:8123/?route=20`.

## Passengers, sounds, potholes

- Passengers wait at the stops; when you stop, they board and the seats fill
  up, while alighting passengers leave as the bus departs.
- The bus is electric: quiet tyre and road noise, a tonal motor whine that
  rises with speed, a faint inverter tone and wind noise. Above 40 km/h the
  cabin rattles and creaks.
- AVAS (the pedestrian warning sound) only plays while the bus is rolling
  below about 29 km/h -- never at standstill -- and is a low, soft whir
  rather than a beep or siren.
- There are potholes along the route: driving through one shakes the bus and
  produces a dull thump.
- Buildings are solid: collisions use the real building footprint, so there
  are no invisible walls along diagonal or L-shaped blocks. A collision
  bounces the bus back and bleeds off speed.
- Parks and forests have 3D grass tufts. Grass is cosmetic: you never collide
  with it, it only slows the bus slightly.
- The bus handles like a 12 m vehicle, with a wide turning circle; sharp
  corners need to be taken slowly.

## Stops and traffic lights

- **Stop:** stop at the yellow marking, within 10 metres and below 5 km/h.
  The doors open, the route continues after 3 seconds, and the next stop is
  announced both in the HUD and by voice.
- **Traffic light:** lights run their own red-yellow-green cycle. If you stop
  at a red light, it holds you for about 4.5 seconds and then turns green --
  it never stays red forever. This is a gameplay simplification: the light
  effectively waits for the bus to arrive.
- **Red-light penalty:** driving through a red or yellow light adds 10 seconds
  to the ride time and shows a warning on the HUD.

## Routes

Downtown routes are included (the Botfa and Kökényesmindszent directions are
not yet):

| Ref | Route |
| --- | --- |
| 20 | Csertán Sándor utca – Kovács Károly tér – Gasparich utca – Csertán Sándor utca (circular) |
| 9 | Kertváros – Páterdomb – Tesco – Autóbusz-állomás |
| 18 | Vasútállomás – Széchenyi tér – Kertváros – Kovács Károly tér |
| 3 | Vasútállomás – Kaszaháza – Nekeresd – Pózva |
| 22 | Vasútállomás – Kertváros – Landorhegy – Csácsbozsok |
| 21 | Csácsbozsok – Tesco – Mártírok útja – Kertváros |
| 5 | Kertváros – Kovács Károly tér – Neszele – Ságod |
| 6 | Autóbusz-állomás – Hűtőipari Zrt. – Szenterzsébethegy |
| 25 | Olai bisztró – Kertváros – Kovács Károly tér |
| 29 | Vasútállomás – Kertváros – Landorhegy – Vasútállomás (circular) |
| 19A | Kertváros – Kovács Károly tér – Autóbusz-állomás |

## Data and credits

- **City and stops:** OpenStreetMap (© OpenStreetMap contributors, ODbL
  licence). The roads, buildings, green areas and the 164 OSM bus stops come
  from OSM; three timetable stops missing from OSM are added from the
  official stop list.
- **Routes:** route descriptions from the MÁV-csoport / Volánbusz Zalaegerszeg
  local timetable (1 September 2026). The real route geometry is produced by
  the public OSRM router from the order of the stops.
- **Bus:** an original, custom-modelled low-floor electric solo bus inspired
  by the BYD electric buses running in Zalaegerszeg. It contains no factory
  trademarks, logos or copied livery.

## Layout

```
index.html                  start screen and HUD
css/style.css               interface styling
js/main.js                  scene, camera, game loop, HUD
js/city.js                  OSM city -> 3D geometry (roads, buildings, trees)
js/bus.js                   bus model and cockpit
js/driver.js                vehicle physics, route following, stop logic
js/traffic.js               traffic lights
js/markers.js               route line, stop signs, bay markings
js/minimap.js               GPS minimap
js/passengers.js            waiting, boarding and alighting passengers
js/potholes.js              potholes on the route
js/audio.js                 procedural electric bus soundscape
js/data/zalaegerszeg.js     generated data (do not edit by hand)
tools/build-data.mjs        data builder (OSM + routing)
raw/                        downloaded raw OSM data
vendor/three.module.js      three.js
server.mjs                  local web server
docs/agent/                 guides for AI coding agents
AGENTS.md                   entry point for AI coding agents
```

Regenerate the data (requires an internet connection):

```
node tools/build-data.mjs
```

## Known simplifications

- The city follows the real street network, but buildings are block masses,
  not photorealistic models.
- Traffic rules are simplified: pavements are drivable and other vehicles are
  not simulated.
- Traffic lights are scripted per route rather than simulating full junction
  phases.
