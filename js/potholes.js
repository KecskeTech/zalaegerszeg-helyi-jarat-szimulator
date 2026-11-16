import * as THREE from "three";

// Kátyúk az útvonalon: sötét foltok az aszfalton + rázkódás áthaladáskor.
export class Potholes {
  constructor(scene, route) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.items = [];
    this.cooldown = 0;

    let s = 20261;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const geos = [
      new THREE.CircleGeometry(0.55, 9),
      new THREE.CircleGeometry(0.42, 8),
      new THREE.CircleGeometry(0.68, 10),
    ];
    geos.forEach((g) => g.rotateX(-Math.PI / 2));
    const mat = new THREE.MeshBasicMaterial({
      color: 0x191c1e,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });

    let d = 55;
    let i = 2;
    while (d < route.length - 40) {
      const idx = this.indexAt(route.cum, d);
      const a = route.path[Math.max(0, idx - 1)];
      const b = route.path[Math.min(route.path.length - 1, idx + 1)];
      let fx = b[0] - a[0],
        fz = b[1] - a[1];
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const rx = -fz,
        rz = fx;
      const off = (rnd() - 0.5) * 3.0;
      const x = route.path[idx][0] + rx * off;
      const z = route.path[idx][1] + rz * off;
      const m = new THREE.Mesh(geos[(rnd() * geos.length) | 0], mat);
      m.position.set(x, 0.079, z);
      m.rotation.y = rnd() * Math.PI * 2;
      m.scale.set(0.8 + rnd() * 0.7, 1, 0.7 + rnd() * 0.6);
      this.group.add(m);
      this.items.push({ x, z, hit: false });
      d += 70 + rnd() * 90;
      i++;
    }
    this.items.sort((a, b) => a.x - b.x);
  }

  indexAt(cum, s) {
    let lo = 0,
      hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < s) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  update(x, z, speed, dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown > 0 || Math.abs(speed) < 2) return 0;
    for (const p of this.items) {
      if (p.hit) continue;
      const dx = p.x - x,
        dz = p.z - z;
      if (dx * dx + dz * dz < 2.4) {
        p.hit = true;
        this.cooldown = 0.4;
        return Math.min(1, 0.4 + Math.abs(speed) / 20);
      }
    }
    return 0;
  }

  reset() {
    for (const p of this.items) p.hit = false;
    this.cooldown = 0;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.items = [];
  }
}
