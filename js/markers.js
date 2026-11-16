import * as THREE from "three";

function stopSignTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#f4f6f7";
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#0f5fa6";
  g.fillRect(0, 0, 256, 66);
  g.fillStyle = "#ffffff";
  g.font = "bold 44px Segoe UI, Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("VOLÁN", 128, 35);
  g.fillStyle = "#1b2b33";
  g.font = "bold 150px Segoe UI, Arial";
  g.fillText("H", 128, 160);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class RouteMarkers {
  constructor(scene, route) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    const cum = route.cum;
    const path = route.path;
    const idxAt = (s) => {
      let lo = 0,
        hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < s) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };

    // útvonalvezető vonal az úton
    const pos = [];
    const col = [];
    const color = new THREE.Color(route.color);
    for (let i = 0; i < path.length - 1; i++) {
      const ax = path[i][0],
        az = path[i][1],
        bx = path[i + 1][0],
        bz = path[i + 1][1];
      const dx = bx - ax,
        dz = bz - az;
      const l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * 0.17,
        nz = (dx / l) * 0.17;
      const y = 0.072;
      pos.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
      pos.push(ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
      for (let k = 0; k < 6; k++) col.push(color.r, color.g, color.b);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    lineGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const line = new THREE.Mesh(
      lineGeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    line.renderOrder = 4;
    this.group.add(line);

    // megállóhelyek
    const signTex = stopSignTexture();
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x6c7378 });
    const bayMat = new THREE.MeshBasicMaterial({
      color: 0xf0c419,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    });

    for (let si = 0; si < route.stops.length; si++) {
      const s = route.stops[si];
      const i = idxAt(s.s);
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(path.length - 1, i + 1)];
      let fx = b[0] - a[0],
        fz = b[1] - a[1];
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const rx = -fz,
        rz = fx;

      // sárga megállóöböl
      const bayGeo = new THREE.PlaneGeometry(1.7, 11);
      bayGeo.rotateX(-Math.PI / 2);
      const bay = new THREE.Mesh(bayGeo, bayMat);
      bay.rotation.y = Math.atan2(fx, fz);
      bay.position.set(s.x + rx * 2.9, 0.068, s.z + rz * 2.9);
      bay.renderOrder = 4;
      this.group.add(bay);

      // tábla
      const g = new THREE.Group();
      g.position.set(s.x + rx * 5.2, 0, s.z + rz * 5.2);
      g.rotation.y = Math.atan2(-fx, -fz);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 2.5, 8), poleMat);
      pole.position.y = 1.25;
      g.add(pole);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), signMat);
      sign.position.set(0, 2.3, 0.04);
      g.add(sign);
      this.group.add(g);
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}


