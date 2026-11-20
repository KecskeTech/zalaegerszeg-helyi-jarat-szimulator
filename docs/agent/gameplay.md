# Gameplay systems

## Driver and vehicle physics

`js/driver.js` owns the bus state (`x`, `z`, `heading`, `speed`, `steer`,
`progress`, `nextStop`, ...). `driver.update(dt, input, autopilot, traffic)`
returns the current state object consumed by `main.js`.

- Units are metres and seconds; `speed` is m/s. There is no forward speed
  clamp. The electric torque curve (`3.4 - 0.03 * speed`, floor 0.8 m/s²)
  and rolling drag settle at about 21.8 m/s (~78 km/h). Reverse maximum is
  -4.2 m/s.
- Steering is speed-sensitive: the maximum steer angle shrinks with speed.
  `WHEELBASE = 7.0` and the low-speed steer limit of 0.62 rad give a ~10 m
  turning circle, so the bus can turn at walking pace. The steer rate is also
  faster at low speed (`maxRate` 2.2 rad/s, down to 0.7 at top speed).
- The cockpit steering wheel follows `+steer`, and the player input maps
  left to +1 and right to -1. Flip both together or the wheel will turn
  against the key press.
- Crossing a red or yellow light is a penalty: the driver emits
  `redlight`, and `main.js` adds 10 seconds to the ride time. Detection
  compares `prevProgress` with the light's `s` inside `driver.update()`.
- The bus follows a route by projecting its position onto the route path and
  tracking `progress` (metres along the route).
- Buildings are solid: `hitsBuilding()` uses a spatial grid of exact building
  polygons (point-in-polygon plus edge distance), not bounding boxes, so there
  are no invisible walls around diagonal or L-shaped buildings. A collision
  bounces the bus and cuts speed.
- Parks and forests are a cosmetic grass cover. `onGrass()` uses a polygon grid
  and only applies a small drag; grass is never a collision target.
- Street names are looked up from the road graph and shown in the HUD.

## Stops

- A stop is served when the bus is within 10 m of the stop point and slower
  than 1.5 m/s (about 5 km/h).
- Serving sets `dwelling = true`, opens the doors and triggers the `stop`
  event. After 3.0 seconds the bus departs, `nextStop` advances, and `depart`
  fires.
- Passing a stop by more than 28 m without stopping fires `skip`.
- The last stop fires `complete`.
- Events are delivered through `driver.onEvent(type, stop)`; `main.js` maps
  them to announcements, speech, doors and the completion screen.

## Autopilot

`autopilot` is a toggle in `main.js` (key `G`). The driver computes a target
speed from route look-ahead, upcoming stop distance, traffic light state and
current dwelling, then produces throttle input. Autopilot still respects red
lights and stops.

## Traffic lights

`js/traffic.js` builds one light per `route.lights` entry: pole, arm, head and
stop line. The pole stands 5.6 m to the driver's right of the route centreline
and the arm/head reach 2.35 m back over the right lane, so the head is not in
the middle of the roadway. Keep the right vector as `(-fz, fx)`; the opposite
sign puts the pole on the left kerb. Each light cycles red -> green ->
yellow -> red using the `GREEN_TIME`, `YELLOW_TIME` and `RED_TIME` constants.
`traffic.update()` returns the nearest active light within 320 m ahead,
including its distance and state.

Each light runs its own red -> green -> yellow -> red cycle. When the bus is
stopped at a red light within 26 m, `MIN_RED_WAIT` (4.5 s) is applied once via
the `holdApplied` flag. Do not re-apply it every frame: the old code kept
resetting the timer and the light never turned green. A red light must always
reach green.

The removed station light is controlled from the data builder
(`REMOVED_LIGHTS` in `tools/build-data.mjs`), not from `traffic.js`.

## Audio

`js/audio.js` is a procedural WebAudio soundscape; there are no audio files.
Layers and intent:

| Layer | Character | When |
| --- | --- | --- |
| `rumbleGain` | low tyre/road rumble | with speed |
| `treadGain` | band-limited tread hiss | with speed |
| `windGain` | high-passed wind | with speed squared |
| `motorGain` | tonal motor whine, pitch follows RPM | while driving |
| `inverterGain` | faint high switching tone | while driving |
| `avasGain` | soft low whir (pedestrian warning) | only while rolling below ~29 km/h |
| `rattleGain` | cabin rattle and creaks | above ~40 km/h |

Important behaviour: AVAS must **not** play at standstill. It fades in only
above walking pace and out by 8 m/s. Avoid single high-pitched sines with deep
vibrato; they read as a siren or "alien" rather than a vehicle. Motor whine
should be a clean tone with harmonics, kept below the road noise level.

`update(speed, throttle, active, dt)` is called every frame from `main.js`.
Use `setTargetAtTime` for smooth gain and frequency changes. One-shot effects
(`bell`, `door`, `thud`, `horn`) create short-lived nodes and stop them.

## Passengers and potholes

- `Passengers` spawns waiting figures at stops and seated figures on board.
  `board()` and `alight()` are called from `main.js` when the driver reports
  dwelling.
- `Potholes` places dark patches along the route and returns a hit when the bus
  passes close enough; `main.js` then plays a thud and applies a camera shake.
