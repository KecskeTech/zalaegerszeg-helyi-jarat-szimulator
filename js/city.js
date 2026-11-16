import * as THREE from "three";

const ROAD_COLORS = {
  primary: 0x3c4149,
  secondary: 0x41464e,
  tertiary: 0x454b53,
  residential: 0x4a5058,
  unclassified: 0x4a5058,
  living_street: 0x4d535b,
  service: 0x51575f,
  pedestrian: 0x5a6067,
  secondary_link: 0x41464e,
  tertiary_link: 0x454b53,
  footway: 0x6d7176,
  path: 0x6a6a5f,
  steps: 0x7a7d81,
  cycleway: 0x7b5a4a,
  track: 0x6d6247,
  platform: 0x777b80,
};

const BUILDING_COLORS = [
  [0.85, 0.82, 0.75],
  [0.79, 0.71, 0.61],
  [0.72, 0.62, 0.53],
  [0.86, 0.86, 0.84],
  [0.66, 0.72, 0.78],
  [0.78, 0.78, 0.79],
  [0.71, 0.58, 0.51],
  [0.55, 0.58, 0.62],
];

const ROOF_COLORS = [
  [0.42, 0.43, 0.46],
  [0.48, 0.40, 0.36],
  [0.55, 0.42, 0.36],
  [0.36, 0.38, 0.41],
];

function hash01(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildingTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#959ba1";
  g.fillRect(56, 66, 144, 146);
  g.fillStyle = "#5a6a76";
  g.fillRect(64, 74, 128, 130);
  g.fillStyle = "rgba(255,255,255,0.24)";
  g.fillRect(64, 74, 128, 18);
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.fillRect(64, 142, 128, 4);
  g.fillStyle = "rgba(0,0,0,0.14)";
  g.fillRect(56, 208, 144, 10);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(56, 206, 144, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function grassTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#5f6b4b";
  g.fillRect(0, 0, 256, 256);
  let s = 7;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 3200; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const r = 2 + rnd() * 7;
    const v = rnd();
    g.fillStyle = `rgba(${64 + v * 46 | 0},${82 + v * 52 | 0},${48 + v * 34 | 0},0.32)`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    g.fillStyle = `rgba(${110 + rnd() * 40 | 0},${112 + rnd() * 36 | 0},${78 + rnd() * 24 | 0},0.18)`;
    g.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(420, 420);
  tex.anisotropy = 8;
  return tex;
}

class Builder {
  constructor() {
    this.pos = [];
    this.col = [];
    this.uv = [];
  }
  tri(a, b, c, color, ua, ub, uc) {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let i = 0; i < 3; i++) this.col.push(color[0], color[1], color[2]);
    if (ua) this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    else this.uv.push(0, 0, 0, 0, 0, 0);
  }
  quad(a, b, c, d, color, ua, ub, uc, ud) {
    this.tri(a, b, c, color, ua, ub, uc);
    this.tri(a, c, d, color, ua, uc, ud);
  }
  get empty() {
    return this.pos.length === 0;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    return g;
  }
}

const scaleColor = (c, f) => [c[0] * f, c[1] * f, c[2] * f];

// miteres szalag: nincs önátfedés a töréspontoknál
function ribbon(builder, flat, width, y, color) {
  const hw = width / 2;
  const n = flat.length / 2;
  if (n < 2) return;
  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = flat[(i + 1) * 2] - flat[i * 2];
    const dz = flat[(i + 1) * 2 + 1] - flat[i * 2 + 1];
    const l = Math.hypot(dx, dz) || 1;
    segN.push([-dz / l, dx / l]);
  }
  const offs = [];
  for (let i = 0; i < n; i++) {
    let nx, nz, scale = 1;
    if (i === 0) {
      [nx, nz] = segN[0];
    } else if (i === n - 1) {
      [nx, nz] = segN[n - 2];
    } else {
      const [ax, az] = segN[i - 1];
      const [bx, bz] = segN[i];
      let mx = ax + bx;
      let mz = az + bz;
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml;
      mz /= ml;
      const d = mx * bx + mz * bz;
      scale = 1 / Math.max(0.42, d);
      nx = mx;
      nz = mz;
    }
    offs.push([
      flat[i * 2] + nx * hw * scale,
      flat[i * 2 + 1] + nz * hw * scale,
      flat[i * 2] - nx * hw * scale,
      flat[i * 2 + 1] - nz * hw * scale,
    ]);
  }
  for (let i = 0; i < n - 1; i++) {
    const a = offs[i],
      b = offs[i + 1];
    builder.quad(
      [a[0], y, a[1]],
      [b[0], y, b[1]],
      [b[2], y, b[3]],
      [a[2], y, a[3]],
      color
    );
  }
}

function polygonShape(flat) {
  const shape = new THREE.Shape();
  shape.moveTo(flat[0], flat[1]);
  for (let i = 2; i < flat.length; i += 2) shape.lineTo(flat[i], flat[i + 1]);
  shape.closePath();
  return shape;
}

function addFlatPolygon(builder, flat, y, color) {
  if (flat.length < 6) return;
  const geom = new THREE.ShapeGeometry(polygonShape(flat));
  geom.rotateX(Math.PI / 2);
  const pos = geom.toNonIndexed().getAttribute("position");
  for (let i = 0; i < pos.count; i += 3) {
    builder.tri(
      [pos.getX(i), y, pos.getZ(i)],
      [pos.getX(i + 1), y, pos.getZ(i + 1)],
      [pos.getX(i + 2), y, pos.getZ(i + 2)],
      color
    );
  }
  geom.dispose();
}

function addBuilding(wallB, roofB, plinthB, flat, height, colorIdx) {
  const n = flat.length / 2;
  if (n < 3) return;
  const wall = BUILDING_COLORS[colorIdx % BUILDING_COLORS.length];
  const roof = ROOF_COLORS[colorIdx % ROOF_COLORS.length];
  const brightness = 0.88 + hash01(colorIdx * 3 + n) * 0.18;
  const cx = flat[0];
  const cz = flat[1];
  for (let i = 0; i < n; i++) {
    const ax = flat[i * 2],
      az = flat[i * 2 + 1];
    const j = (i + 1) % n;
    const bx = flat[j * 2],
      bz = flat[j * 2 + 1];
    const dx = bx - ax,
      dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.4) continue;
    const shade = (0.78 + 0.22 * Math.abs(dz / (len || 1))) * brightness;
    const c = scaleColor(wall, shade);
    const u1 = len / 2.9;
    const v1 = height / 3.15;
    wallB.quad(
      [ax, 0, az],
      [bx, 0, bz],
      [bx, height, bz],
      [ax, height, az],
      c,
      [0, 0],
      [u1, 0],
      [u1, v1],
      [0, v1]
    );
    // lábazat (kifelé 8 cm)
    const sign = (ax - cx) * (bz - az) - (az - cz) * (bx - ax) > 0 ? 1 : -1;
    const ox = (-dz / len) * 0.08 * sign;
    const oz = (dx / len) * 0.08 * sign;
    const plinthCol = scaleColor(wall, shade * 0.62);
    plinthB.quad(
      [ax + ox, 0, az + oz],
      [bx + ox, 0, bz + oz],
      [bx + ox, YM, bz + oz],
      [ax + ox, YM, az + oz],
      plinthCol
    );
  }
  if (flat.length >= 6) {
    const geom = new THREE.ShapeGeometry(polygonShape(flat));
    geom.rotateX(Math.PI / 2);
    const pos = geom.toNonIndexed().getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      roofB.tri(
        [pos.getX(i), height, pos.getZ(i)],
        [pos.getX(i + 1), height, pos.getZ(i + 1)],
        [pos.getX(i + 2), height, pos.getZ(i + 2)],
        roof
      );
    }
    geom.dispose();
  }
}
const YM = 0.85; // lábazat magassága

function makeSky(scene) {
  const geo = new THREE.SphereGeometry(7000, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x4a7cb3) },
      mid: { value: new THREE.Color(0x9dc0dd) },
      bottom: { value: new THREE.Color(0xdde5e7) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
      varying vec3 vPos;
      void main() {
        float h = clamp(normalize(vPos).y, -1.0, 1.0);
        vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.7, h))
                          : mix(bottom, mid, smoothstep(-0.25, 0.08, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  scene.add(sky);
}

function pointInPoly(x, z, flat) {
  let inside = false;
  const n = flat.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = flat[i * 2],
      zi = flat[i * 2 + 1];
    const xj = flat[j * 2],
      zj = flat[j * 2 + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// durva épület-elfoglaltsági rács a fák ütközésmentes helyezéséhez
function buildingGrid(CITY) {
  const CELL = 45;
  const grid = new Map();
  const key = (cx, cz) => cx + "," + cz;
  for (const b of CITY.buildings) {
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < b.p.length; i += 2) {
      minX = Math.min(minX, b.p[i]);
      maxX = Math.max(maxX, b.p[i]);
      minZ = Math.min(minZ, b.p[i + 1]);
      maxZ = Math.max(maxZ, b.p[i + 1]);
    }
    const x0 = Math.floor(minX / CELL),
      x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL),
      z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++)
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push([minX - 1.2, maxX + 1.2, minZ - 1.2, maxZ + 1.2]);
      }
  }
  return {
    CELL,
    blocked(x, z) {
      const arr = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
      if (!arr) return false;
      for (const [minX, maxX, minZ, maxZ] of arr) {
        if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return true;
      }
      return false;
    },
  };
}

function createTrees(scene, CITY) {
  let s = 1234567;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const bgrid = buildingGrid(CITY);
  const points = [];

  // parkok, erdők
  for (const a of CITY.areas) {
    if (a.k !== "park" && a.k !== "forest") continue;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < a.p.length; i += 2) {
      minX = Math.min(minX, a.p[i]);
      maxX = Math.max(maxX, a.p[i]);
      minZ = Math.min(minZ, a.p[i + 1]);
      maxZ = Math.max(maxZ, a.p[i + 1]);
    }
    const area = (maxX - minX) * (maxZ - minZ);
    const want = Math.min(80, Math.max(2, Math.round(area / 800)));
    for (let k = 0; k < want * 4 && points.length < 1500; k++) {
      const x = minX + rnd() * (maxX - minX);
      const z = minZ + rnd() * (maxZ - minZ);
      if (pointInPoly(x, z, a.p) && !bgrid.blocked(x, z)) points.push([x, z]);
    }
  }

  // fasorok az utak mentén
  for (const r of CITY.roads) {
    if (r.t === "service" || r.t === "footway" || r.w < 6.5) continue;
    let acc = 0;
    let side = rnd() < 0.5 ? 1 : -1;
    for (let i = 0; i < r.p.length - 2; i += 2) {
      const ax = r.p[i],
        az = r.p[i + 1],
        bx = r.p[i + 2],
        bz = r.p[i + 3];
      const dx = bx - ax,
        dz = bz - az;
      const len = Math.hypot(dx, dz);
      acc += len;
      if (acc < 48) continue;
      acc = 0;
      if (rnd() < 0.45) continue;
      side = -side;
      const nx = (-dz / len) * (r.w / 2 + 2.7) * side;
      const nz = (dx / len) * (r.w / 2 + 2.7) * side;
      const x = ax + nx,
        z = az + nz;
      if (points.length < 2400 && !bgrid.blocked(x, z)) points.push([x, z]);
    }
  }

  if (!points.length) return;
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
  const leafGeo = new THREE.ConeGeometry(1.55, 5.4, 7);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x4f7038 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, points.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, points.length);
  trunks.castShadow = true;
  leaves.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const col = new THREE.Color();
  for (let i = 0; i < points.length; i++) {
    const [x, z] = points[i];
    const sc = 0.7 + rnd() * 0.7;
    scale.set(sc, sc, sc);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, 1.1 * sc, z), q, scale);
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 4.6 * sc, z), q, scale);
    leaves.setMatrixAt(i, m);
    col.setHSL(0.24 + rnd() * 0.06, 0.32 + rnd() * 0.15, 0.28 + rnd() * 0.1);
    leaves.setColorAt(i, col);
  }
  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  scene.add(trunks, leaves);
}

export function buildCity(scene, CITY) {
  scene.add(new THREE.HemisphereLight(0xcfe0f2, 0x55614c, 0.62));
  const sun = new THREE.DirectionalLight(0xfff2da, 2.45);
  sun.position.set(-320, 480, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -95;
  sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95;
  sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.55;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0x9fb6d0, 0.26);
  fill.position.set(400, 200, -300);
  scene.add(fill);

  makeSky(scene);

  // talaj
  const groundGeo = new THREE.PlaneGeometry(16000, 16000);
  groundGeo.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshLambertMaterial({ map: grassTexture() })
  );
  ground.position.y = -0.06;
  ground.receiveShadow = true;
  scene.add(ground);

  // zöld / víz / temető felületek
  const areaB = new Builder();
  for (const a of CITY.areas) {
    const color =
      a.k === "water"
        ? [0.20, 0.34, 0.44]
        : a.k === "forest"
          ? [0.20, 0.30, 0.17]
          : a.k === "cemetery"
            ? [0.30, 0.36, 0.26]
            : [0.24, 0.37, 0.20];
    addFlatPolygon(areaB, a.p, 0.008, color);
  }
  if (!areaB.empty) {
    const m = new THREE.Mesh(
      areaB.geometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
    );
    m.receiveShadow = true;
    m.renderOrder = 1;
    scene.add(m);
  }

  // járdák / ösvények
  const walkB = new Builder();
  for (const w of CITY.walkways) {
    const col = new THREE.Color(ROAD_COLORS[w.t] || 0x6d7176);
    ribbon(walkB, w.p, w.w, 0.026, [col.r, col.g, col.b]);
  }
  if (!walkB.empty) {
    const m = new THREE.Mesh(
      walkB.geometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true })
    );
    m.receiveShadow = true;
    m.renderOrder = 2;
    scene.add(m);
  }

  // utak + járdaszegély (útvonalanként apró magassági eltolás a z-fighting ellen)
  const roadB = new Builder();
  let wi = 0;
  for (const r of CITY.roads) {
    const dy = (wi++ % 31) * 0.00022;
    const baseY = 0.044 + dy;
    if (r.w >= 4) {
      ribbon(roadB, r.p, r.w + 4.2, baseY, [0.53, 0.53, 0.5]);
    }
    const col = new THREE.Color(ROAD_COLORS[r.t] || 0x4a5058);
    ribbon(roadB, r.p, r.w, baseY + 0.006, [col.r, col.g, col.b]);
    if (r.w >= 8.5) {
      ribbon(roadB, r.p, 0.35, baseY + 0.009, [0.64, 0.64, 0.6]);
    }
  }
  if (!roadB.empty) {
    const m = new THREE.Mesh(
      roadB.geometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true })
    );
    m.receiveShadow = true;
    m.renderOrder = 3;
    scene.add(m);
  }

  // vasút
  const railB = new Builder();
  for (const r of CITY.rails) {
    ribbon(railB, r.p, 2.4, 0.024, [0.24, 0.23, 0.22]);
    ribbon(railB, r.p, 0.18, 0.027, [0.55, 0.54, 0.5]);
  }
  if (!railB.empty) {
    const m = new THREE.Mesh(railB.geometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // épületek: falak (ablaktextúrával), lábazat, tetők
  const wallB = new Builder();
  const roofB = new Builder();
  const plinthB = new Builder();
  for (let i = 0; i < CITY.buildings.length; i++) {
    const b = CITY.buildings[i];
    addBuilding(wallB, roofB, plinthB, b.p, b.h, i);
  }
  if (!wallB.empty) {
    const wallMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      map: buildingTexture(),
      side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(wallB.geometry(), wallMat);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  if (!plinthB.empty) {
    const m = new THREE.Mesh(
      plinthB.geometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
    );
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  if (!roofB.empty) {
    const m = new THREE.Mesh(
      roofB.geometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
    );
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  createTrees(scene, CITY);

  scene.fog = new THREE.Fog(0xb9cbd8, 240, 1200);

  return { sun };
}

