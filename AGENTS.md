# Zalaegerszeg Local Bus Simulator

Browser-based 3D bus simulator for downtown Zalaegerszeg, built with plain ES
modules and three.js. No bundler, no package manager, no test suite.

## Quick Reference

- **Run:** `node server.mjs` then open <http://127.0.0.1:8123/>
- **Regenerate map/route data:** `node tools/build-data.mjs` (needs internet)
- **Single route:** <http://127.0.0.1:8123/?route=18>
- **Generated data:** `js/data/zalaegerszeg.js` is generated; never edit by hand
- **UI strings:** Hungarian. Documentation and code comments: English.

## Detailed Instructions

- [Architecture](docs/agent/architecture.md) - module map, runtime flow, debug hooks
- [Data pipeline](docs/agent/data-pipeline.md) - OSM/OSRM input, route and light generation
- [Rendering and scene](docs/agent/rendering.md) - three.js conventions, disposal, materials
- [Gameplay systems](docs/agent/gameplay.md) - driver, stops, traffic lights, audio, passengers
- [Code style and workflow](docs/agent/code-style.md) - conventions, verification, git
