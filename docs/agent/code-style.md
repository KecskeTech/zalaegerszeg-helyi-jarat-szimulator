# Code style and workflow

## Language

- User-facing strings (HUD, announcements, route names, help text) are
  Hungarian.
- Documentation (`README.md`, `AGENTS.md`, `docs/agent/`) is English.
- New code comments should be English; existing Hungarian comments may stay.

## JavaScript conventions

- Plain ES modules, no TypeScript, no bundler, no framework.
- Two-space indentation, double quotes, semicolons.
- Prefer `const`; use small pure helpers at module scope.
- Keep the per-frame path allocation-free: reuse vectors/objects.
- Do not add dependencies or a build step without an explicit request. The
  project intentionally has no `package.json`.
- Import three.js as `import * as THREE from "three"`.

## File naming

- Lowercase module names under `js/` (`driver.js`, `traffic.js`).
- One exported class or factory per file; the class name matches the file
  concept (`Driver`, `TrafficLights`, `BusAudio`).
- Data modules under `js/data/` are generated; `tools/` holds Node scripts.

## Changing generated data

Do **not** edit `js/data/zalaegerszeg.js` directly. Update
`tools/build-data.mjs` and regenerate with `node tools/build-data.mjs`, or in
an offline-only situation patch it with a script and mirror the same change in
the builder so the next regeneration keeps it.

## Verification

There is no automated test suite or linter. Verify manually:

1. `node server.mjs` (or `indito.bat` on Windows).
2. Open <http://127.0.0.1:8123/> and start the affected route, e.g.
   `?route=18`.
3. Check the HUD, minimap, lighting, audio and start/completion screens.
4. Use `window.SIM` in DevTools for state inspection.
5. If data changed, run `node --check` on modified `.js`/`.mjs` files and
   inspect `git diff`.

## Git

- Default branch: `master`.
- Keep commits focused and use short, descriptive messages (English or
  Hungarian is both acceptable in history; new commits may use English).
- Never commit generated noise, logs or editor files.
