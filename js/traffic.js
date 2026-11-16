import * as THREE from "three";

const LAMP_OFF = { red: 0x3a0b0b, yellow: 0x3a2a06, green: 0x0b3220 };
const LAMP_ON = { red: 0xff2b2b, yellow: 0xffc32b, green: 0x2bff7a };

// valósághoz közeli jelzésváltási idők (másodperc)
const GREEN_TIME = 13;
const YELLOW_TIME = 2.6;
const RED_TIME = 15;
const MIN_RED_WAIT = 4.5; // ha megállsz pirosnál, ne váltson zöldre azonnal

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
let glowTex = null;

export class TrafficLights {
  constructor(scene, route) {
    this.scene = scene;
    this.route = route;
    this.items = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.poleMat = new THREE.MeshLambertMaterial({ color: 0x3b4147 });
    this.headMat = new THREE.MeshLambertMaterial({ color: 0x181b1e });
    if (!glowTex) glowTex = glowTexture();

    const path = route.path;
    const cum = route.cum;
    let seed = 424242;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (const l of route.lights || []) {
      let i = this.findIndexAt(cum, l.s);
      const a = path[Math.max(0, i - 2)];
      const b = path[Math.min(path.length - 1, i + 2)];
      let fx = b[0] - a[0],
        fz = b[1] - a[1];
      const fl = Math.hypot(fx, fz) || 1;
      fx /= fl;
      fz /= fl;
      const yaw = Math.atan2(-fx, -fz);
      const rightX = -fz,
        rightZ = fx;
      const g = new THREE.Group();
      g.position.set(l.x + rightX * 5.0, 0, l.z + rightZ * 5.0);
      g.rotation.y = yaw;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 4.1, 8), this.poleMat);
      pole.position.y = 2.05;
      g.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.11, 0.11), this.poleMat);
      arm.position.set(-1.2, 3.95, 0);
      g.add(arm);

      // hátlap
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.5, 0.1), this.poleMat);
      back.position.set(-2.35, 3.3, -0.03);
      g.add(back);

      const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.42, 0.2), this.headMat);
      board.position.set(-2.35, 3.3, 0);
      g.add(board);

      const lampGeo = new THREE.CircleGeometry(0.155, 16);
      const lamps = {};
      const order = ["red", "yellow", "green"];
      order.forEach((k, idx) => {
        const mat = new THREE.MeshBasicMaterial({ color: LAMP_OFF[k] });
        const m = new THREE.Mesh(lampGeo, mat);
        m.position.set(-2.35, 3.72 - idx * 0.42, 0.11);
        g.add(m);
        lamps[k] = mat;
      });

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xff2020,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      glow.scale.set(1.05, 1.05, 1);
      glow.position.set(-2.35, 3.72, 0.2);
      g.add(glow);

      // stopvonal az úton
      const lineGeo = new THREE.PlaneGeometry(12.6, 0.5);
      lineGeo.rotateX(-Math.PI / 2);
      const stopLine = new THREE.Mesh(
        lineGeo,
        new THREE.MeshBasicMaterial({ color: 0xdedbd2, transparent: true, opacity: 0.92 })
      );
      stopLine.rotation.y = Math.atan2(fx, fz);
      stopLine.position.set(l.x - fx * 2.5, 0.075, l.z - fz * 2.5);
      this.group.add(stopLine);

      this.group.add(g);
      // a városi forgalomhoz hasonlóan a lámpák nincsenek szinkronban
      const state = rnd() < 0.62 ? "red" : "green";
      const item = {
        s: l.s,
        state,
        timer: state === "red" ? 5 + rnd() * 11 : 3 + rnd() * 8,
        lamps,
        glow,
        pos: { x: l.x, z: l.z },
      };
      this.items.push(item);
      this.applyState(item);
    }
    this.active = null;
  }

  findIndexAt(cum, s) {
    let lo = 0,
      hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < s) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  applyState(item) {
    const st = item.state;
    item.lamps.red.color.setHex(st === "red" ? LAMP_ON.red : LAMP_OFF.red);
    item.lamps.yellow.color.setHex(st === "yellow" ? LAMP_ON.yellow : LAMP_OFF.yellow);
    item.lamps.green.color.setHex(st === "green" ? LAMP_ON.green : LAMP_OFF.green);
    item.glow.visible = st !== "yellow";
    item.glow.material.color.setHex(st === "red" ? 0xff2020 : 0x20ff80);
    item.glow.material.opacity = st === "red" ? 0.55 : 0.4;
    item.glow.position.y = st === "red" ? 3.72 : 2.88;
  }

  setState(item, state, time) {
    item.state = state;
    item.timer = time;
    this.applyState(item);
  }

  update(dt, progress, speed) {
    let active = null;
    let bestD = Infinity;
    for (const item of this.items) {
      const d = item.s - progress;
      if (d < -10 || d > 320) continue;
      if (!active || d < bestD) {
        bestD = d;
        active = item;
      }
      // valós ciklus
      item.timer -= dt;
      if (item.timer <= 0) {
        if (item.state === "red") this.setState(item, "green", GREEN_TIME);
        else if (item.state === "green") this.setState(item, "yellow", YELLOW_TIME);
        else this.setState(item, "red", RED_TIME);
      }
      // ha a busz megállt a pirosnál, ne váltson zöldre azonnal
      if (
        item.state === "red" &&
        d > 0 &&
        d < 26 &&
        Math.abs(speed) < 0.8 &&
        item.timer < MIN_RED_WAIT
      ) {
        item.timer = MIN_RED_WAIT;
      }
    }
    this.active = active ? { d: bestD, state: active.state, item: active } : null;
    return this.active;
  }

  reset() {
    for (const item of this.items) {
      this.setState(item, "red", 8 + Math.random() * 10);
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
    this.items = [];
  }
}
