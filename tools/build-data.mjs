// Zalaegerszeg helyi járat szimulátor - adatépítő
// Bemenet: raw/bus_stops.json (OSM buszmegállók), raw/osm_city.json (OSM utak/épületek)
// Kimenet: js/data/zalaegerszeg.js (CITY + ROUTES)
//
// Az útvonalak a valós MÁV-csoport / Volánbusz helyi menetrend szerinti
// járatleírásokon alapulnak, a megállók az OpenStreetMap valós megállói.
// Az útvonal geometriát az OSRM útvonaltervező adja (valós utakat követ).

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "js", "data", "zalaegerszeg.js");

const LAT0 = 46.8454;
const LON0 = 16.8472;
const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const MZ = 111320;

const projX = (lon) => (lon - LON0) * MX;
const projZ = (lat) => -(lat - LAT0) * MZ;

// Az Overpass válasz UTF-8 tartalma latin1-ként érkezett, ezt javítjuk.
function fixText(s) {
  if (typeof s !== "string") return s;
  if (!/[ÃÂÅâ]/.test(s)) return s;
  try {
    const t = Buffer.from(s, "latin1").toString("utf8");
    return t.includes("\uFFFD") ? s : t;
  } catch {
    return s;
  }
}
const fixTags = (tags = {}) => {
  const o = {};
  for (const [k, v] of Object.entries(tags)) o[k] = fixText(v);
  return o;
};

const readJson = (p) =>
  JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

const stopsRaw = readJson(path.join(RAW, "bus_stops.json"));
const cityRaw = readJson(path.join(RAW, "osm_city.json"));

// ---------- megállók ----------
const stopNodes = [];
for (const e of stopsRaw.elements) {
  if (e.type !== "node" || !e.tags) continue;
  const name = fixText((e.tags.name || "").trim());
  if (!name) continue;
  stopNodes.push({
    id: e.id,
    name,
    lat: e.lat,
    lon: e.lon,
    x: projX(e.lon),
    z: projZ(e.lat),
  });
}
const stopsByName = new Map();
// Az OSM-ben nem (vagy nem buszmegállóként) szereplő, de a menetrendben
// létező megállók. A koordináták a Göcseji út / Landorhegyi út / Rózsa liget
// úttengelyére lettek igazítva.
const EXTRA_STOPS = [
  { name: "Köztemető (Göcseji út)", lat: 46.837438, lon: 16.836033 },
  { name: "Rózsa liget", lat: 46.839380, lon: 16.848998 },
  { name: "Landorhegyi út 60.", lat: 46.837737, lon: 16.824548 },
];
for (const s of EXTRA_STOPS) {
  stopNodes.push({
    id: "extra-" + s.name,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    x: projX(s.lon),
    z: projZ(s.lat),
  });
}
for (const s of stopNodes) {
  if (!stopsByName.has(s.name)) stopsByName.set(s.name, []);
  stopsByName.get(s.name).push(s);
}
const stopList = [...stopsByName.entries()]
  .map(([name, arr]) => ({
    n: name,
    x: +(arr.reduce((a, s) => a + s.x, 0) / arr.length).toFixed(1),
    z: +(arr.reduce((a, s) => a + s.z, 0) / arr.length).toFixed(1),
  }))
  .sort((a, b) => a.n.localeCompare(b.n, "hu"));

// ---------- utak / épületek / zöldfelületek ----------
const WAY_WIDTH = {
  primary: 13,
  secondary: 10,
  tertiary: 8.5,
  residential: 6.5,
  unclassified: 6.5,
  living_street: 6,
  service: 4,
  pedestrian: 5,
  footway: 2,
  path: 1.6,
  steps: 1.6,
  cycleway: 2,
  track: 2.6,
  platform: 3,
  secondary_link: 9,
  tertiary_link: 7,
};
const DRIVABLE = new Set([
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "living_street",
  "secondary_link",
  "tertiary_link",
]);
const WALKABLE = new Set([
  "footway",
  "path",
  "steps",
  "cycleway",
  "pedestrian",
  "platform",
  "track",
]);

const roads = [];
const walkways = [];
const buildings = [];
const areas = [];
const rails = [];
const roadSegments = []; // traffic light detektáláshoz

const round1 = (v) => Math.round(v * 10) / 10;

function geomToFlat(geom) {
  const out = [];
  for (const p of geom) {
    out.push(round1(projX(p.lon)), round1(projZ(p.lat)));
  }
  return out;
}

let bIdx = 0;
let seed = 987654321;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
for (const e of cityRaw.elements) {
  if (e.type !== "way" || !e.geometry || e.geometry.length < 2) continue;
  const t = fixTags(e.tags || {});
  const flat = geomToFlat(e.geometry);

  if (t.highway && WAY_WIDTH[t.highway] != null) {
    const w = WAY_WIDTH[t.highway];
    const item = {
      t: t.highway,
      w,
      n: t.name || "",
      p: flat,
    };
    if (DRIVABLE.has(t.highway)) {
      roads.push(item);
      for (let i = 0; i < flat.length - 2; i += 2) {
        roadSegments.push({
          x1: flat[i],
          z1: flat[i + 1],
          x2: flat[i + 2],
          z2: flat[i + 3],
          w,
        });
      }
    } else if (WALKABLE.has(t.highway)) {
      walkways.push(item);
    } else {
      roads.push(item);
    }
  } else if (t.railway === "rail" || t.railway === "light_rail") {
    rails.push({ p: flat });
  } else if (t.building && e.geometry.length >= 4) {
    const levels = parseFloat(t["building:levels"]);
    const big = /apartments|retail|commercial|public|school|hospital|office|hotel|civic|government|church|industrial|warehouse/.test(
      t.building
    );
    let h;
    if (Number.isFinite(levels)) h = levels * 3.1 + 2.4;
    else h = big ? 9 + rnd() * 9 : 4.5 + rnd() * 4.5;
    h = Math.min(31, Math.max(3.2, h));
    // színindex 0..7
    const c = big ? 4 + (bIdx++ % 4) : bIdx++ % 4;
    buildings.push({ p: flat, h: round1(h), c });
  } else if (t.leisure === "park" || t.landuse === "grass" || t.landuse === "recreation_ground" || t.leisure === "garden" || t.landuse === "cemetery") {
    areas.push({ p: flat, k: t.landuse === "cemetery" ? "cemetery" : "park" });
  } else if (t.landuse === "forest" || t.natural === "wood") {
    areas.push({ p: flat, k: "forest" });
  } else if (t.waterway || t.natural === "water" || t.landuse === "reservoir") {
    areas.push({ p: flat, k: "water" });
  } else if (t.railway === "platform") {
    rails.push({ p: flat });
  }
}

// ---------- saját útvonaltervezés az OSM úthálózaton ----------
function buildRoadGraph(roads) {
  const nodes = [];
  const map = new Map();
  const keyOf = (x, z) => Math.round(x * 2) + "," + Math.round(z * 2);
  const getNode = (x, z) => {
    const k = keyOf(x, z);
    let id = map.get(k);
    if (id === undefined) {
      id = nodes.length;
      map.set(k, id);
      nodes.push({ x, z, e: [] });
    }
    return id;
  };
  for (const r of roads) {
    if (!DRIVABLE.has(r.t) && r.t !== "service") continue;
    for (let i = 0; i < r.p.length - 2; i += 2) {
      const a = getNode(r.p[i], r.p[i + 1]);
      const b = getNode(r.p[i + 2], r.p[i + 3]);
      if (a === b) continue;
      const w = Math.hypot(nodes[b].x - nodes[a].x, nodes[b].z - nodes[a].z);
      if (w < 0.4) continue;
      nodes[a].e.push([b, w]);
      nodes[b].e.push([a, w]);
    }
  }
  return { nodes, map, keyOf };
}

class MinHeap {
  constructor() {
    this.a = [];
  }
  push(item, pri) {
    const a = this.a;
    a.push([pri, item]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    if (!a.length) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let s = i;
        if (l < a.length && a[l][0] < a[s][0]) s = l;
        if (r < a.length && a[r][0] < a[s][0]) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

function nearestNode(graph, x, z) {
  let best = -1;
  let bd = Infinity;
  const nodes = graph.nodes;
  for (let i = 0; i < nodes.length; i++) {
    const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return { id: best, dist: Math.sqrt(bd) };
}

function astar(graph, startId, goalId) {
  const nodes = graph.nodes;
  const n = nodes.length;
  const g = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const h = (id) => Math.hypot(nodes[id].x - nodes[goalId].x, nodes[id].z - nodes[goalId].z);
  g[startId] = 0;
  const open = new MinHeap();
  open.push(startId, h(startId));
  while (open.size) {
    const [pri, id] = open.pop();
    if (closed[id]) continue;
    if (id === goalId) break;
    closed[id] = 1;
    for (const [nb, w] of nodes[id].e) {
      if (closed[nb]) continue;
      const ng = g[id] + w;
      if (ng < g[nb] - 1e-6) {
        g[nb] = ng;
        came[nb] = id;
        open.push(nb, ng + h(nb));
      }
    }
  }
  if (!Number.isFinite(g[goalId])) return null;
  const path = [];
  let cur = goalId;
  while (cur !== -1) {
    path.push(cur);
    if (cur === startId) break;
    cur = came[cur];
  }
  path.reverse();
  return { nodePath: path, distance: g[goalId] };
}

function pathPoints(graph, nodePath) {
  return nodePath.map((id) => [graph.nodes[id].x, graph.nodes[id].z]);
}
// ---------- járatok (valós menetrendi leírások, belvárosi szakaszok) ----------
// A megállósorok a MÁV-csoport helyi menetrendje (2026.09.01.) szerinti
// járatleírásokat követik, a valós OSM megállónevekkel.
const ROUTE_DEFS = [
  {
    ref: "20",
    name: "Belvárosi körjárat",
    color: "#e8b53a",
    // A valós menetrend szerinti útvonal (Csertán Sándor utca ► Kovács
    // Károly tér ► Gasparich utca ► Csertán Sándor utca), rövid szakaszokkal.
    stops: [
      "Zalaegerszeg, Csertán Sándor utca",
      "Köztemető (Göcseji út)",
      "Éva presszó",
      "Kórház, Göcseji út",
      "Rózsa liget",
      "Önkiszolgáló étterem",
      "Kovács Károly tér",
      "Kazinczy tér",
      "Zrínyi Gimnázium",
      "Olai templom (Interspar)",
      "Gasparich utca 16.",
      "Ganz Ábrahám Szakközépiskola",
      "Landorhegyi út 60.",
      "Landorhegyi út 34.",
      "Zalaegerszeg, Csertán Sándor utca",
    ],
  },
  {
    ref: "9",
    name: "Kertváros – Páterdomb – Tesco – Autóbusz-állomás",
    color: "#4ea3e0",
    stops: [
      "Kertvárosi forduló H",
      "Kertvárosi ABC",
      "Kertváros, Liszt Ferenc Általános Iskola",
      "Kertváros, Szent Család óvoda",
      "Kovács Károly tér",
      "Páterdomb, Szegfű utca",
      "Páterdomb, Kinizsi utca 78.",
      "Páterdomb, Baross Gábor utca 59.",
      "Tesco",
      "Zalaegerszeg, autóbusz-állomás",
    ],
  },
  {
    ref: "18",
    name: "Vasútállomás – Széchenyi tér – Kertváros – Kovács Károly tér",
    color: "#8fc84a",
    stops: [
      "Vasútállomás",
      "Széchenyi tér",
      "Kovács Károly tér",
      "Mártírok útja (Ady iskola)",
      "Kertváros, Szent Család óvoda",
      "Kertváros, Liszt Ferenc Általános Iskola",
      "Kertvárosi ABC",
      "Vasútállomás (ABC)",
    ],
  },
  {
    ref: "3",
    name: "Vasútállomás – Kaszaháza – Nekeresd – Pózva",
    color: "#c85a68",
    stops: [
      "Vasútállomás",
      "Széchenyi tér",
      "Kovács Károly tér",
      "Kaszaháza",
      "Nekeresd",
      "Pózva, Külsőkórház",
      "Pózva autóbusz-forduló",
    ],
  },
  {
    ref: "22",
    name: "Vasútállomás – Kertváros – Landorhegy – Csácsbozsok",
    color: "#9a72d8",
    stops: [
      "Vasútállomás",
      "Kertváros, Liszt Ferenc Általános Iskola",
      "Kertváros, Szent Család óvoda",
      "Landorhegyi ABC",
      "Mártírok útja (Ady iskola)",
      "Kovács Károly tér",
      "Tesco",
      "Csácsbozsok elágazó",
      "Csácsbozsok, Csácsi utca",
    ],
  },
  {
    ref: "21",
    name: "Csácsbozsok – Tesco – Mártírok útja – Kertváros",
    color: "#3fb79b",
    stops: [
      "Csácsbozsok, Csácsi utca",
      "Csácsbozsok elágazó",
      "Tesco",
      "Kovács Károly tér",
      "Mártírok útja (Ady iskola)",
      "Kertváros, Szent Család óvoda",
      "Kertváros, Liszt Ferenc Általános Iskola",
      "Kertvárosi ABC",
      "Kertvárosi forduló H",
    ],
  },
  {
    ref: "5",
    name: "Kertváros – Kovács Károly tér – Neszele – Ságod",
    color: "#e0783a",
    stops: [
      "Kertvárosi forduló H",
      "Kertvárosi ABC",
      "Kovács Károly tér",
      "Széchenyi tér",
      "Neszele, autóbusz-forduló",
      "Ságodi ipartelep",
      "Ságod, Termál lakópark",
      "Ságod, Termálfürdő (AquaCity)",
      "Ságod, iskola",
    ],
  },
  {
    ref: "6",
    name: "Autóbusz-állomás – Hűtőipari Zrt. – Szenterzsébethegy",
    color: "#d8d2c4",
    stops: [
      "Zalaegerszeg, autóbusz-állomás",
      "Hock János utca (Bíbor utca)",
      "Hűtőipari Zrt.",
      "Szenterzsébethegy elágazás",
      "Szenterzsébethegy, kút",
      "Szenterzsébethegy, Molnárház",
      "Szenterzsébethegy, Újhegy",
    ],
  },
  {
    ref: "25",
    name: "Olai bisztró – Kertváros – Kovács Károly tér",
    color: "#7f9ae0",
    stops: [
      "Olai bisztró",
      "Olai templom (Interspar)",
      "Kertváros, Szent Család óvoda",
      "Kertváros, Liszt Ferenc Általános Iskola",
      "Mártírok útja (Ady iskola)",
      "Kovács Károly tér",
    ],
  },
  {
    ref: "29",
    name: "Vasútállomás – Kertváros – Landorhegy – Vasútállomás",
    color: "#d46fb0",
    stops: [
      "Vasútállomás",
      "Kertváros, Liszt Ferenc Általános Iskola",
      "Landorhegyi ABC",
      "Landorhegyi út 20.",
      "Olai templom (Interspar)",
      "Olai bisztró",
      "Malom utca",
      "Széchenyi tér",
      "Vasútállomás (Kisposta)",
    ],
  },
  {
    ref: "19A",
    name: "Kertváros – Kovács Károly tér – Autóbusz-állomás",
    color: "#b8c34a",
    stops: [
      "Kertvárosi forduló H",
      "Kertvárosi ABC",
      "Kertváros, Liszt Ferenc Általános Iskola",
      "Kertváros, Szent Család óvoda",
      "Kovács Károly tér",
      "Széchenyi tér",
      "Zalaegerszeg, autóbusz-állomás",
    ],
  },
];

// ---------- OSRM útvonaltervezés ----------
async function osrmRoute(points) {
  const coords = points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=false`;
  const res = await fetch(url, { headers: { "User-Agent": "zeg-bus-sim/1.0" } });
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const js = await res.json();
  if (js.code !== "Ok" || !js.routes?.length) throw new Error(`OSRM ${js.code}`);
  return js.routes[0];
}

function densify(pathXZ, maxStep = 6) {
  const out = [];
  for (let i = 0; i < pathXZ.length - 1; i++) {
    const ax = pathXZ[i][0],
      az = pathXZ[i][1],
      bx = pathXZ[i + 1][0],
      bz = pathXZ[i + 1][1];
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / maxStep));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([ax + (bx - ax) * t, az + (bz - az) * t]);
    }
  }
  out.push(pathXZ[pathXZ.length - 1]);
  return out;
}

async function buildRoutes(graph) {
  const routes = [];
  for (const def of ROUTE_DEFS) {
    const picked = [];
    let prev = null;
    for (const name of def.stops) {
      const arr = stopsByName.get(name);
      if (!arr || !arr.length) {
        console.warn("!! hiányzó megálló:", name);
        continue;
      }
      let best = arr[0];
      if (prev) {
        best = arr.reduce(
          (a, b) =>
            Math.hypot(a.x - prev.x, a.z - prev.z) <=
            Math.hypot(b.x - prev.x, b.z - prev.z)
              ? a
              : b
        );
      }
      picked.push(best);
      prev = best;
    }
    if (picked.length < 2) continue;

    let rawPath = [];
    let length = 0;
    let legs = [];
    let routed = false;
    for (let i = 0; i < picked.length - 1; i++) {
      const a = nearestNode(graph, picked[i].x, picked[i].z);
      const b = nearestNode(graph, picked[i + 1].x, picked[i + 1].z);
      const res = astar(graph, a.id, b.id);
      if (!res) break;
      legs.push(Math.round(res.distance));
      const pts = pathPoints(graph, res.nodePath);
      if (rawPath.length) pts.shift();
      rawPath.push(...pts);
      routed = i === picked.length - 2;
    }
    if (routed && rawPath.length > 1) {
      length = legs.reduce((s, v) => s + v, 0);
      process.stdout.write("      szakaszok: " + legs.join(", ") + " m\n");
      process.stdout.write(
        `  útvonal ${def.ref}: ${(length / 1000).toFixed(2)} km (${rawPath.length} gráfpont)\n`
      );
    } else {
      console.warn(`  gráf hiba (${def.ref}) – OSRM tartalék`);
      try {
        const r = await osrmRoute(picked);
        rawPath = r.geometry.coordinates.map(([lon, lat]) => [projX(lon), projZ(lat)]);
        length = r.distance;
        legs = (r.legs || []).map((l) => Math.round(l.distance));
        await new Promise((r2) => setTimeout(r2, 900));
      } catch (err) {
        console.warn(`  OSRM hiba (${def.ref}): ${err.message} – egyenes vonal`);
        rawPath = picked.map((p) => [p.x, p.z]);
      }
    }

    const path = densify(rawPath, 4);
    // ívhossz
    const cum = [0];
    for (let i = 1; i < path.length; i++) {
      cum.push(
        cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
      );
    }
    const total = cum[cum.length - 1];

    // megállók vetítése az útvonalra (legközelebbi pont, előrefelé haladva)
    let minIdx = 0;
    const stops = picked.map((s) => {
      let bi = minIdx,
        bd = Infinity;
      for (let i = minIdx; i < path.length; i++) {
        const d = Math.hypot(path[i][0] - s.x, path[i][1] - s.z);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      minIdx = Math.min(path.length - 1, bi + 1);
      return {
        n: s.name,
        x: +path[bi][0].toFixed(1),
        z: +path[bi][1].toFixed(1),
        s: Math.round(cum[bi]),
        off: Math.round(bd),
      };
    });

    routes.push({
      ref: def.ref,
      name: def.name,
      color: def.color,
      stops,
      path: path.map((p) => [+p[0].toFixed(1), +p[1].toFixed(1)]),
      cum: cum.map((c) => Math.round(c)),
      length: Math.round(total),
      legs,
    });
  }
  return routes;
}

// ---------- kereszteződések / jelzőlámpák ----------
const CELL = 24;
const segGrid = new Map();
const gkey = (cx, cz) => cx + "," + cz;
for (const s of roadSegments) {
  const minX = Math.floor(Math.min(s.x1, s.x2) / CELL);
  const maxX = Math.floor(Math.max(s.x1, s.x2) / CELL);
  const minZ = Math.floor(Math.min(s.z1, s.z2) / CELL);
  const maxZ = Math.floor(Math.max(s.z1, s.z2) / CELL);
  for (let cx = minX; cx <= maxX; cx++)
    for (let cz = minZ; cz <= maxZ; cz++) {
      const k = gkey(cx, cz);
      if (!segGrid.has(k)) segGrid.set(k, []);
      segGrid.get(k).push(s);
    }
}

function pointSegDist(px, pz, s) {
  const vx = s.x2 - s.x1,
    vz = s.z2 - s.z1;
  const wx = px - s.x1,
    wz = pz - s.z1;
  const len2 = vx * vx + vz * vz || 1;
  let t = (wx * vx + wz * vz) / len2;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (s.x1 + vx * t),
    dz = pz - (s.z1 + vz * t);
  return { d: Math.hypot(dx, dz), ang: Math.atan2(vz, vx) };
}

function detectLights(route) {
  const cands = [];
  const path = route.path;
  for (let i = 2; i < path.length - 2; i++) {
    if (route.cum[i] - (cands.length ? cands[cands.length - 1].s : -999) < 40) continue;
    const fx = path[i + 1][0] - path[i - 1][0];
    const fz = path[i + 1][1] - path[i - 1][1];
    const flen = Math.hypot(fx, fz) || 1;
    const fAng = Math.atan2(fz, fx);
    const px = path[i][0],
      pz = path[i][1];
    let bestD = Infinity,
      bestAng = 0,
      bestSeg = null;
    const cx = Math.floor(px / CELL),
      cz = Math.floor(pz / CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx++)
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        const arr = segGrid.get(gkey(gx, gz));
        if (!arr) continue;
        for (const s of arr) {
          const r = pointSegDist(px, pz, s);
          if (r.d > 7.5 || r.d < 1.2) continue;
          if (s.w < 8.4) continue;
          if (Math.hypot(s.x2 - s.x1, s.z2 - s.z1) < 14) continue;
          // szögeltérés az útvonalhoz képest [0..π]
          const dA = Math.abs(((r.ang - fAng + Math.PI) % (Math.PI * 2)) - Math.PI);
          if (Math.abs(dA - Math.PI / 2) > 0.5) continue; // csak keresztirányú utca
          if (r.d < bestD) {
            bestD = r.d;
            bestAng = r.ang;
            bestSeg = s;
          }
        }
      }
    if (bestSeg) {
      cands.push({ s: route.cum[i], i, px, pz, ang: bestAng });
    }
  }
  // klaszterezés 35 m-en belül
  const lights = [];
  for (const c of cands) {
    const last = lights[lights.length - 1];
    if (last && c.s - last.s < 62) continue;
    lights.push(c);
  }
  return lights
    .filter((l) => l.s > 22)
    .map((l) => ({ s: l.s, x: +l.px.toFixed(1), z: +l.pz.toFixed(1) }));
}

// Fontosabb csomópontok, ahol a valóságban is van jelzőlámpa.
// Ha az útvonal elhalad mellettük (55 m-en belül), kapnak lámpát.
const MANUAL_JUNCTIONS = [
  [46.83321, 16.84759], // Vasútállomás
  [46.84469, 16.84601], // Széchenyi tér
  [46.8445, 16.84758], // Kovács Károly tér
  [46.84485, 16.85976], // Tesco
  [46.8531, 16.84525], // Kaszaháza
  [46.83432, 16.82819], // Csertán Sándor utca
  [46.83805, 16.82364], // Gasparich utca – Landorhegyi út
  [46.83555, 16.85313], // Páterdomb
  [46.84665, 16.8337], // Olai templom
  [46.85981, 16.84656], // Új köztemető
  [46.86379, 16.8526], // Nekeresd
  [46.84187, 16.87719], // Csácsbozsok elágazó
  [46.86544, 16.83269], // Ságodi ipartelep
  [46.8537, 16.79893], // Hűtőipari Zrt.
  [46.87336, 16.8585], // Pózva, Külsőkórház
  [46.84844, 16.82459], // Malom utca
];

// Jelzőlámpák, amelyeket el kell távolítani a generált adatokból.
// A vasútállomás előtti lámpa nem létezik a valóságban, ezért kikerül.
const REMOVED_LIGHTS = [
  { x: 14.3, z: 1293, r: 25 }, // Vasútállomás / Kisposta előtti csomópont
];

function removeUnwantedLights(route) {
  route.lights = route.lights.filter(
    (l) => !REMOVED_LIGHTS.some((e) => Math.hypot(l.x - e.x, l.z - e.z) < e.r)
  );
}

function addManualJunctions(route) {
  const path = route.path;
  const cum = route.cum;
  for (const [lat, lon] of MANUAL_JUNCTIONS) {
    const x = projX(lon);
    const z = projZ(lat);
    let bi = -1;
    let bd = Infinity;
    for (let i = 0; i < path.length; i++) {
      const d = Math.hypot(path[i][0] - x, path[i][1] - z);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    if (bd > 55) continue;
    const s = Math.round(cum[bi]);
    if (s < 12) continue;
    if (route.lights.some((l) => Math.abs(l.s - s) < 50)) continue;
    route.lights.push({ s, x: +path[bi][0].toFixed(1), z: +path[bi][1].toFixed(1) });
  }
  route.lights.sort((a, b) => a.s - b.s);
}
// ---------- mentés ----------
console.log("Útvonaltervezés az OSM gráfon...");
const roadGraph = buildRoadGraph(roads);
console.log("  gráf: " + roadGraph.nodes.length + " csomópont");
const routes = await buildRoutes(roadGraph);
for (const r of routes) {
  r.lights = detectLights(r);
  addManualJunctions(r);
  removeUnwantedLights(r);
  process.stdout.write(
    `  ${r.ref}: ${r.path.length} pont, ${r.length} m, ${r.lights.length} lámpa\n`
  );
}

const city = {
  meta: {
    name: "Zalaegerszeg",
    lat: LAT0,
    lon: LON0,
    generated: new Date().toISOString(),
    stopsSource: "OpenStreetMap (ODbL)",
    routesSource:
      "MÁV-csoport / Volánbusz zalaegerszegi helyi menetrend (2026.09.01.)",
  },
  bounds: { minX: -1500, maxX: 1750, minZ: -1500, maxZ: 1500 },
  roads,
  walkways,
  buildings,
  areas,
  rails,
  stops: stopList,
  routes,
};

const js = `// Automatikusan generált fájl – tools/build-data.mjs
// Forrás: OpenStreetMap (ODbL) + MÁV-csoport helyi menetrend
export const CITY = ${JSON.stringify(city)};
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, js, "utf8");

const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`\nKész: ${OUT} (${kb} KB)`);
console.log(
  `utak: ${roads.length}, sétány: ${walkways.length}, épület: ${buildings.length}, zöld: ${areas.length}, megálló: ${stopList.length}, járat: ${routes.length}`
);











