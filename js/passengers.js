import * as THREE from "three";

const SHIRTS = [0x2f6f9e, 0xb5493f, 0x4d7a4a, 0x8767a5, 0xd0a03a, 0x3c4650, 0xc2c7cc, 0x8a4f35];
const PANTS = [0x2c3440, 0x3a3f46, 0x514842, 0x27364a];
const SKIN = [0xd9a882, 0xc9936b, 0xefc7a4, 0x8d6247];

let geo = null;
function getGeo() {
  if (geo) return geo;
  geo = {
    torso: new THREE.BoxGeometry(0.44, 0.62, 0.26),
    legs: new THREE.BoxGeometry(0.34, 0.72, 0.22),
    seatLegs: new THREE.BoxGeometry(0.36, 0.24, 0.52),
    head: new THREE.SphereGeometry(0.135, 10, 8),
    arm: new THREE.BoxGeometry(0.11, 0.54, 0.13),
  };
  return geo;
}

function makePerson(rnd, seated = false) {
  const g = getGeo();
  const root = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: SKIN[(rnd() * SKIN.length) | 0] });
  const shirtMat = new THREE.MeshLambertMaterial({ color: SHIRTS[(rnd() * SHIRTS.length) | 0] });
  const pantMat = new THREE.MeshLambertMaterial({ color: PANTS[(rnd() * PANTS.length) | 0] });

  const torso = new THREE.Mesh(g.torso, shirtMat);
  const head = new THREE.Mesh(g.head, skinMat);
  const legs = new THREE.Mesh(seated ? g.seatLegs : g.legs, pantMat);
  const arms = [];
  if (seated) {
    torso.position.set(0, 1.34, 0);
    head.position.set(0, 1.74, 0.02);
    legs.position.set(0, 1.09, 0.32);
  } else {
    legs.position.set(0, 0.36, 0);
    torso.position.set(0, 1.03, 0);
    head.position.set(0, 1.5, 0);
    for (const sx of [1, -1]) {
      const a = new THREE.Mesh(g.arm, shirtMat);
      a.position.set(sx * 0.28, 1.02, 0);
      a.rotation.z = sx * 0.08;
      root.add(a);
      arms.push(a);
    }
  }
  root.add(torso, head, legs);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const s = 0.94 + (rnd() - 0.5) * 0.12;
  root.scale.set(s, s, s);
  return root;
}

export class Passengers {
  constructor(scene, bus) {
    this.scene = scene;
    this.bus = bus;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.waiting = new Map();
    this.walkers = [];
    this.onboard = 0;
    this.maxSeats = 12;
    this.seats = [];
    this.route = null;

    let s = 98765;
    this.rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    // ülő utasok az utastérben
    for (let i = 0; i < this.maxSeats; i++) {
      const p = makePerson(this.rnd, true);
      const row = Math.floor(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      p.position.set(side * 0.62, 0, 3.4 - row * 1.15);
      p.visible = false;
      bus.add(p);
      this.seats.push(p);
    }
  }

  clear() {
    for (const arr of this.waiting.values()) {
      for (const p of arr) this.group.remove(p.group);
    }
    this.waiting.clear();
    for (const w of this.walkers) this.group.remove(w.group);
    this.walkers = [];
    this.onboard = 0;
    for (const s of this.seats) s.visible = false;
    this.route = null;
  }

  setRoute(route) {
    this.clear();
    this.route = route;
    const path = route.path;
    const cum = route.cum;
    const idxAt = (sd) => {
      let lo = 0,
        hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < sd) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    };
    route.stops.forEach((stop, si) => {
      const i = idxAt(stop.s);
      const a = path[Math.max(0, i - 1)];
      const b = path[Math.min(path.length - 1, i + 1)];
      let fx = b[0] - a[0],
        fz = b[1] - a[1];
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const rx = -fz,
        rz = fx;
      const n = 2 + Math.floor(this.rnd() * 4);
      const arr = [];
      for (let k = 0; k < n; k++) {
        const along = (this.rnd() - 0.5) * 7;
        const out = 4.3 + this.rnd() * 1.3;
        const x = stop.x + rx * out + fx * along;
        const z = stop.z + rz * out + fz * along;
        const person = makePerson(this.rnd, false);
        person.position.set(x, 0, z);
        person.rotation.y = Math.atan2(-rx, -rz) + (this.rnd() - 0.5) * 0.6;
        this.group.add(person);
        arr.push({ group: person, x, z, walking: false, target: null, speed: 2.3 });
      }
      this.waiting.set(si, arr);
    });
  }

  // beszállás a megállóban
  board(stopIndex, busState) {
    const arr = this.waiting.get(stopIndex);
    if (!arr || !arr.length) return 0;
    const fx = Math.sin(busState.heading);
    const fz = Math.cos(busState.heading);
    const rx = -fz;
    const rz = fx;
    const doorX = busState.x + fx * 3.3 + rx * 1.2;
    const doorZ = busState.z + fz * 3.3 + rz * 1.2;
    let n = Math.min(arr.length, 1 + Math.floor(this.rnd() * 3));
    const taken = arr.splice(0, n);
    for (const p of taken) {
      this.walkers.push({
        group: p.group,
        x: p.x,
        z: p.z,
        target: { x: doorX, z: doorZ },
        speed: 2.4,
        mode: "board",
        life: 0,
      });
    }
    return taken.length;
  }

  // leszállás
  alight(busState) {
    const n = Math.min(this.onboard, Math.floor(this.rnd() * 2));
    this.onboard -= n;
    const fx = Math.sin(busState.heading);
    const fz = Math.cos(busState.heading);
    const rx = -fz;
    const rz = fx;
    for (let i = 0; i < n; i++) {
      const person = makePerson(this.rnd, false);
      const x = busState.x + fx * 3.3 + rx * 1.35;
      const z = busState.z + fz * 3.3 + rz * 1.35;
      person.position.set(x, 0, z);
      this.group.add(person);
      const tx = x + rx * (5 + this.rnd() * 3) + fx * (this.rnd() - 0.5) * 4;
      const tz = z + rz * (5 + this.rnd() * 3) + fz * (this.rnd() - 0.5) * 4;
      this.walkers.push({
        group: person,
        x,
        z,
        target: { x: tx, z: tz },
        speed: 1.3,
        mode: "leave",
        life: 0,
      });
    }
    this.refreshSeats();
    return n;
  }

  addOnboard(n) {
    this.onboard = Math.min(this.maxSeats, this.onboard + n);
    this.refreshSeats();
  }

  refreshSeats() {
    for (let i = 0; i < this.seats.length; i++) this.seats[i].visible = i < this.onboard;
  }

  update(dt) {
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      const dx = w.target.x - w.x;
      const dz = w.target.z - w.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.9) {
        if (w.mode === "board") {
          this.group.remove(w.group);
          this.walkers.splice(i, 1);
          this.addOnboard(1);
        } else {
          this.group.remove(w.group);
          this.walkers.splice(i, 1);
        }
        continue;
      }
      const v = Math.min(w.speed, d) * dt;
      w.x += (dx / d) * v;
      w.z += (dz / d) * v;
      w.group.position.set(w.x, Math.abs(Math.sin((w.life += dt) * 9)) * 0.045, w.z);
      w.group.rotation.y = Math.atan2(dx, dz);
    }
    // a várakozók kicsit mozognak
    const t = performance.now() * 0.001;
    for (const arr of this.waiting.values()) {
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        p.group.position.y = Math.sin(t * 1.4 + i * 1.7) * 0.012;
      }
    }
  }
}

