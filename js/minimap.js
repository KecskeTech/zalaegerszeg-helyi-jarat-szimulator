const K = 0.3; // px / méter

export class Minimap {
  constructor(canvas, CITY, size = 210) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.size = size;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // világ határok
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    const acc = (x, z) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    };
    for (const r of CITY.roads) for (let i = 0; i < r.p.length; i += 2) acc(r.p[i], r.p[i + 1]);
    for (const s of CITY.stops) acc(s.x, s.z);
    minX -= 120;
    maxX += 120;
    minZ -= 120;
    maxZ += 120;
    this.world = { minX, maxX, minZ, maxZ };

    const w = Math.ceil((maxX - minX) * K);
    const h = Math.ceil((maxZ - minZ) * K);
    this.map = document.createElement("canvas");
    this.map.width = w;
    this.map.height = h;
    this.routeCanvas = document.createElement("canvas");
    this.routeCanvas.width = w;
    this.routeCanvas.height = h;

    this.drawBase(CITY);
  }

  px(x) {
    return (x - this.world.minX) * K;
  }
  pz(z) {
    return (z - this.world.minZ) * K;
  }

  drawBase(CITY) {
    const g = this.map.getContext("2d");
    g.fillStyle = "#0a1015";
    g.fillRect(0, 0, this.map.width, this.map.height);

    // zöld / víz
    for (const a of CITY.areas) {
      if (a.k === "water") g.fillStyle = "#0f2433";
      else if (a.k === "forest") g.fillStyle = "#0f1d13";
      else if (a.k === "cemetery") g.fillStyle = "#141d15";
      else g.fillStyle = "#12200f";
      g.beginPath();
      for (let i = 0; i < a.p.length; i += 2) {
        const X = this.px(a.p[i]),
          Y = this.pz(a.p[i + 1]);
        if (i === 0) g.moveTo(X, Y);
        else g.lineTo(X, Y);
      }
      g.closePath();
      g.fill();
    }

    // sétányok
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const w of CITY.walkways) {
      g.strokeStyle = "#1d262c";
      g.lineWidth = Math.max(1, w.w * K * 0.7);
      this.strokePath(g, w.p);
    }

    // utak (kicsitől a nagyig)
    const sorted = [...CITY.roads].sort((a, b) => a.w - b.w);
    for (const r of sorted) {
      g.strokeStyle = r.w >= 8.5 ? "#3b4a57" : "#2a353e";
      g.lineWidth = Math.max(1.2, r.w * K);
      this.strokePath(g, r.p);
    }

    // vasút
    for (const r of CITY.rails) {
      g.strokeStyle = "#4a4640";
      g.lineWidth = 2;
      this.strokePath(g, r.p);
    }

    // megállók
    for (const s of CITY.stops) {
      g.fillStyle = "#8fa4b0";
      g.beginPath();
      g.arc(this.px(s.x), this.pz(s.z), 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }

  strokePath(g, p) {
    g.beginPath();
    for (let i = 0; i < p.length; i += 2) {
      const X = this.px(p[i]),
        Y = this.pz(p[i + 1]);
      if (i === 0) g.moveTo(X, Y);
      else g.lineTo(X, Y);
    }
    g.stroke();
  }

  setRoute(route) {
    const g = this.routeCanvas.getContext("2d");
    g.clearRect(0, 0, this.routeCanvas.width, this.routeCanvas.height);
    if (!route) return;
    // halvány sáv
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "rgba(20,40,50,0.85)";
    g.lineWidth = 7;
    this.strokePathRoute(g, route.path);
    g.strokeStyle = route.color;
    g.lineWidth = 3.2;
    this.strokePathRoute(g, route.path);
    // megállók
    for (const s of route.stops) {
      g.beginPath();
      g.arc(this.px(s.x), this.pz(s.z), 3.2, 0, Math.PI * 2);
      g.fillStyle = "#0a1015";
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = "#e8eef2";
      g.stroke();
    }
  }

  strokePathRoute(g, p) {
    g.beginPath();
    for (let i = 0; i < p.length; i++) {
      const X = this.px(p[i][0]),
        Y = this.pz(p[i][1]);
      if (i === 0) g.moveTo(X, Y);
      else g.lineTo(X, Y);
    }
    g.stroke();
  }

  update(bus, route, state) {
    const ctx = this.ctx;
    const S = this.size;
    const cx = S / 2,
      cy = S / 2,
      R = S / 2 - 3;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // háttér
    ctx.fillStyle = "#070c10";
    ctx.fillRect(0, 0, S, S);

    const fx = Math.sin(bus.heading),
      fz = Math.cos(bus.heading);
    const a = -Math.PI / 2 - Math.atan2(fz, fx);

    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.globalAlpha = 0.95;
    ctx.drawImage(this.map, -this.px(bus.x), -this.pz(bus.z));
    ctx.globalAlpha = 1;
    if (route) ctx.drawImage(this.routeCanvas, -this.px(bus.x), -this.pz(bus.z));

    // lámpák
    if (route) {
      const lights = state && state.lights;
      if (lights) {
        for (const l of lights.items) {
          const d = Math.hypot(l.pos.x - bus.x, l.pos.z - bus.z);
          if (d > 260) continue;
          ctx.beginPath();
          ctx.arc(this.px(l.pos.x), this.pz(l.pos.z), 2.4, 0, Math.PI * 2);
          ctx.fillStyle = l.state === "red" ? "#ff3b3b" : "#39e07a";
          ctx.fill();
        }
      }
    }

    // következő megálló
    if (state && state.nextStop && route) {
      const s = state.nextStop;
      const X = this.px(s.x),
        Y = this.pz(s.z);
      const t = (performance.now() % 1200) / 1200;
      ctx.beginPath();
      ctx.arc(X, Y, 5 + t * 7, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,210,74,${1 - t})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(X, Y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd24a";
      ctx.fill();
    }

    ctx.restore();

    // busz nyíl
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6.4, 7);
    ctx.lineTo(0, 3.4);
    ctx.lineTo(-6.4, 7);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 5;
    ctx.fill();
    ctx.restore();

    // északjelző
    const nx = cx + Math.sin(a + Math.PI / 2) * (R - 13) * 0;
    ctx.save();
    const northAngle = a - Math.PI / 2;
    ctx.translate(cx + Math.cos(northAngle) * (R - 14), cy + Math.sin(northAngle) * (R - 14));
    ctx.fillStyle = "#8fa4b0";
    ctx.font = "bold 10px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("É", 0, 0);
    ctx.restore();

    // keret
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(150,190,210,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // lépték
    const meters = 100;
    const w = meters * K;
    ctx.strokeStyle = "rgba(210,230,240,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S - 14 - w, S - 14);
    ctx.lineTo(S - 14, S - 14);
    ctx.stroke();
    ctx.fillStyle = "rgba(210,230,240,0.85)";
    ctx.font = "9px Segoe UI, Arial";
    ctx.textAlign = "right";
    ctx.fillText("100 m", S - 14, S - 20);
  }
}

