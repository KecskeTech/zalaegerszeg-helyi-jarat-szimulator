const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Driver {
  constructor(CITY) {
    this.CITY = CITY;
    this.route = null;
    this.onEvent = () => {};
    this.buildStreetIndex(CITY);
    this.buildBuildingGrid(CITY);
    this.crashCooldown = 0;
  }

  buildStreetIndex(CITY) {
    this.cell = 60;
    this.streets = new Map();
    const key = (cx, cz) => cx + "," + cz;
    for (const r of CITY.roads) {
      if (!r.n) continue;
      for (let i = 0; i < r.p.length - 2; i += 2) {
        const x1 = r.p[i],
          z1 = r.p[i + 1],
          x2 = r.p[i + 2],
          z2 = r.p[i + 3];
        const minX = Math.floor(Math.min(x1, x2) / this.cell);
        const maxX = Math.floor(Math.max(x1, x2) / this.cell);
        const minZ = Math.floor(Math.min(z1, z2) / this.cell);
        const maxZ = Math.floor(Math.max(z1, z2) / this.cell);
        for (let cx = minX; cx <= maxX; cx++)
          for (let cz = minZ; cz <= maxZ; cz++) {
            const k = key(cx, cz);
            if (!this.streets.has(k)) this.streets.set(k, []);
            this.streets.get(k).push({ n: r.n, x1, z1, x2, z2 });
          }
      }
    }
    this.streetName = "Zalaegerszeg";
    this.streetTimer = 0;
  }

  buildBuildingGrid(CITY) {
    this.bCell = 45;
    this.bGrid = new Map();
    const key = (a, b) => a + "," + b;
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
      if (maxX - minX < 2.5 || maxZ - minZ < 2.5) continue;
      const x0 = Math.floor(minX / this.bCell),
        x1 = Math.floor(maxX / this.bCell);
      const z0 = Math.floor(minZ / this.bCell),
        z1 = Math.floor(maxZ / this.bCell);
      for (let cx = x0; cx <= x1; cx++)
        for (let cz = z0; cz <= z1; cz++) {
          const k = key(cx, cz);
          if (!this.bGrid.has(k)) this.bGrid.set(k, []);
          this.bGrid.get(k).push([minX, minZ, maxX, maxZ]);
        }
    }
  }

  hitsBuilding(x, z, m) {
    const cx = Math.floor(x / this.bCell);
    const cz = Math.floor(z / this.bCell);
    for (let gx = cx - 1; gx <= cx + 1; gx++)
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        const arr = this.bGrid.get(gx + "," + gz);
        if (!arr) continue;
        for (const [minX, minZ, maxX, maxZ] of arr) {
          if (
            x > minX - m &&
            x < maxX + m &&
            z > minZ - m &&
            z < maxZ + m
          )
            return true;
        }
      }
    return false;
  }

  lookupStreet(x, z) {
    const cx = Math.floor(x / this.cell),
      cz = Math.floor(z / this.cell);
    let best = null,
      bd = 30 * 30;
    for (let gx = cx - 1; gx <= cx + 1; gx++)
      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        const arr = this.streets.get(gx + "," + gz);
        if (!arr) continue;
        for (const s of arr) {
          const vx = s.x2 - s.x1,
            vz = s.z2 - s.z1;
          const wx = x - s.x1,
            wz = z - s.z1;
          const len2 = vx * vx + vz * vz || 1;
          const t = clamp((wx * vx + wz * vz) / len2, 0, 1);
          const dx = x - (s.x1 + vx * t),
            dz = z - (s.z1 + vz * t);
          const d = dx * dx + dz * dz;
          if (d < bd) {
            bd = d;
            best = s.n;
          }
        }
      }
    return best;
  }

  setRoute(route) {
    this.route = route;
    this.reset();
  }

  reset() {
    const r = this.route;
    if (!r) return;
    this.x = r.path[0][0];
    this.z = r.path[0][1];
    const k = Math.min(8, r.path.length - 1);
    this.heading = Math.atan2(r.path[k][0] - r.path[0][0], r.path[k][1] - r.path[0][1]);
    this.speed = 0;
    this.steer = 0;
    this.accel = 0;
    this.pi = 0;
    this.progress = 0;
    this.nextStop = r.stops.length > 1 ? 1 : 0;
    this.dwelling = false;
    this.dwellTimer = 0;
    this.announced = new Set();
    this.completed = false;
    this.offRoute = false;
    this.streetName = "Zalaegerszeg";
    this.skipped = new Set();
    this.startedStop = 0;
    this.doorOpen = false;
    this.lightHoldTimer = 0;
    this.justDeparted = false;
  }

  teleport(s) {
    const r = this.route;
    if (!r) return;
    const i = this.indexAt(s);
    this.pi = i;
    this.x = r.path[i][0];
    this.z = r.path[i][1];
    this.progress = s;
    const t = this.tangent(i);
    this.heading = Math.atan2(t[0], t[1]);
    this.speed = 0;
  }

  tangent(i) {
    const p = this.route.path;
    const a = p[Math.max(0, i - 1)],
      b = p[Math.min(p.length - 1, i + 1)];
    let dx = b[0] - a[0],
      dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  }

  indexAt(progress) {
    const cum = this.route.cum;
    let lo = 0,
      hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < progress) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  update(dt, input, autopilot, traffic) {
    dt = Math.min(dt, 0.05);
    const r = this.route;
    if (!r) return this.state();

    // --- autopilot ---
    let throttle = input.throttle;
    let steerTarget = input.steer;
    const brake = input.brake;
    let autoSpeed = 0;

    if (autopilot && !this.completed) {
      let j = this.pi;
      const look = this.progress + 13;
      while (j < r.path.length - 1 && r.cum[j] < look) j++;
      const tgt = r.path[j];
      const dx = tgt[0] - this.x,
        dz = tgt[1] - this.z;
      const desired = Math.atan2(dx, dz);
      const diff = wrap(desired - this.heading);
      steerTarget = clamp(diff * 2.4, -0.55, 0.55);

      autoSpeed = 11.5;
      autoSpeed *= 1 - Math.min(0.7, Math.abs(diff) * 1.7);

      // következő megálló
      const ns = r.stops[this.nextStop];
      if (ns) {
        const d = ns.s - this.progress;
        if (d < 45 && d > 2) autoSpeed = Math.min(autoSpeed, Math.max(1.2, (d - 5) * 0.42));
        if (d <= 2) autoSpeed = 0;
      }
      // jelzőlámpa
      if (traffic && traffic.active) {
        const d = traffic.active.d;
        const mustStop =
          traffic.active.state === "red" ||
          (traffic.active.state === "yellow" && d > 11);
        if (mustStop && d > 1 && d < 55)
          autoSpeed = Math.min(autoSpeed, Math.max(0, (d - 9) * 0.5));
      }
      if (this.dwelling) autoSpeed = 0;

      const err = autoSpeed - this.speed;
      throttle = clamp(err * 0.55, -1, 1);
    }

    // --- fizika ---
    const MAXF = 16.6,
      MAXR = -4.2;
    const steerLim = Math.max(0.14, 0.44 - Math.abs(this.speed) * 0.021);
    const targetSteer = clamp(steerTarget, -1, 1) * steerLim;
    const maxRate = 0.85; // rad/s – ne legyen ideges a kormány
    this.steer += clamp(targetSteer - this.steer, -maxRate * dt, maxRate * dt);

    const prevSpeed = this.speed;
    if (brake) {
      this.speed -= Math.sign(this.speed || 1) * 7.5 * dt;
      if (Math.abs(this.speed) < 0.15) this.speed = 0;
    } else if (throttle > 0.01) {
      this.speed += 2.1 * throttle * dt;
    } else if (throttle < -0.01) {
      if (this.speed > 0.4) this.speed -= 4.6 * Math.abs(throttle) * dt;
      else this.speed += 1.5 * throttle * dt;
    }
    // menetellenállás
    this.speed -= this.speed * 0.11 * dt;
    if (this.speed > 0) this.speed = Math.max(0, this.speed - 0.35 * dt);
    if (this.speed < 0) this.speed = Math.min(0, this.speed + 0.35 * dt);
    this.speed = clamp(this.speed, MAXR, MAXF);
    this.accel = (this.speed - prevSpeed) / dt;

    const yawRate = (this.speed / 8.6) * Math.tan(this.steer);
    this.heading = wrap(this.heading + yawRate * dt);
    const fx = Math.sin(this.heading),
      fz = Math.cos(this.heading);
    const nx = this.x + fx * this.speed * dt;
    const nz = this.z + fz * this.speed * dt;
    this.crashCooldown = Math.max(0, this.crashCooldown - dt);
    if (this.hitsBuilding(nx, nz, 1.9)) {
      if (Math.abs(this.speed) > 2.2 && this.crashCooldown <= 0) {
        this.onEvent("crash", null);
        this.crashCooldown = 0.9;
      }
      this.speed *= -0.12;
    } else {
      this.x = nx;
      this.z = nz;
    }
    this.yawRate = yawRate;

    // --- útvonal követés ---
    let bestI = this.pi,
      bestD = Infinity;
    const lo = Math.max(0, this.pi - 70),
      hi = Math.min(r.path.length - 1, this.pi + 90);
    for (let i = lo; i <= hi; i++) {
      const dx = r.path[i][0] - this.x,
        dz = r.path[i][1] - this.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    if (bestD > 50 * 50) {
      bestD = Infinity;
      for (let i = 0; i < r.path.length; i++) {
        const dx = r.path[i][0] - this.x,
          dz = r.path[i][1] - this.z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          bestI = i;
        }
      }
    }
    this.pi = bestI;
    this.offRoute = bestD > 30 * 30;
    const t = this.tangent(bestI);
    const along =
      (this.x - r.path[bestI][0]) * t[0] + (this.z - r.path[bestI][1]) * t[1];
    this.progress = clamp(r.cum[bestI] + along, 0, r.length);

    // --- megállók ---
    const stop = r.stops[this.nextStop];
    if (stop && !this.completed) {
      const d = stop.s - this.progress;
      if (!this.announced.has(this.nextStop) && d < 95 && d > -12) {
        this.announced.add(this.nextStop);
        this.onEvent("approach", stop);
      }
      if (this.dwelling) {
        this.dwellTimer += dt;
        this.doorOpen = true;
        if (this.dwellTimer > 3.0) {
          this.dwelling = false;
          this.dwellTimer = 0;
          this.doorOpen = false;
          this.nextStop++;
          this.onEvent("depart", stop);
          this.justDeparted = true;
          if (this.nextStop >= r.stops.length) {
            this.completed = true;
            this.onEvent("complete", null);
          }
        }
      } else {
        this.doorOpen = false;
        const slow = Math.abs(this.speed) < 1.5;
        const near = Math.abs(this.progress - stop.s) < 10;
        const passed = this.progress > stop.s + 28;
        if (near && slow) {
          this.dwelling = true;
          this.dwellTimer = 0;
          this.speed = 0;
          this.onEvent("stop", stop);
        } else if (passed) {
          this.skipped.add(this.nextStop);
          this.onEvent("skip", stop);
          this.nextStop++;
          if (this.nextStop >= r.stops.length) {
            this.completed = true;
            this.onEvent("complete", null);
          }
        }
      }
    }

    // --- utcanév ---
    this.streetTimer -= dt;
    if (this.streetTimer <= 0) {
      this.streetTimer = 0.4;
      const n = this.lookupStreet(this.x, this.z);
      if (n) this.streetName = n;
    }

    return this.state();
  }

  state() {
    const r = this.route;
    const stop = r ? r.stops[this.nextStop] : null;
    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      speed: this.speed,
      progress: this.progress,
      length: r ? r.length : 0,
      nextStop: stop,
      nextStopIndex: this.nextStop,
      nextStopDist: stop ? Math.max(0, stop.s - this.progress) : 0,
      dwelling: this.dwelling,
      completed: this.completed,
      offRoute: this.offRoute,
      street: this.streetName,
      steer: this.steer,
      yawRate: this.yawRate || 0,
      accel: this.accel,
      doorOpen: this.doorOpen,
      skipped: this.skipped,
    };
  }
}





