import * as THREE from "three";
import { CITY } from "./data/zalaegerszeg.js";
import { buildCity, terrainHeight } from "./city.js";
import { createBus, createCockpit } from "./bus.js";
import { Driver } from "./driver.js";
import { TrafficLights } from "./traffic.js";
import { Minimap } from "./minimap.js";
import { RouteMarkers } from "./markers.js";
import { Passengers } from "./passengers.js";
import { BusAudio } from "./audio.js";
import { Potholes } from "./potholes.js";

// ---------- renderer ----------
const canvas = document.getElementById("app");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.12,
  9000
);
scene.add(camera);

const { sun } = buildCity(scene, CITY);

const bus = createBus();
bus.visible = false;
bus.rotation.order = "YXZ";
scene.add(bus);

const cockpit = createCockpit();
cockpit.visible = false;
camera.add(cockpit);
// Belső fény, hogy a műszerfal ne legyen koromfekete.
const cockpitLight = new THREE.PointLight(0xfff1dc, 1.1, 4, 2);
cockpitLight.position.set(0.35, -0.1, -1.1);
camera.add(cockpitLight);

const driver = new Driver(CITY);
const minimap = new Minimap(document.getElementById("gps-canvas"), CITY);
const passengers = new Passengers(scene, bus);
const audio = new BusAudio();
window.SIM = { driver, bus, CITY, camera, renderer, passengers, audio, startRoute: (r) => startRoute(r) };

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $("hud"),
  ref: $("route-ref"),
  name: $("route-name"),
  sub: $("route-sub"),
  announce: $("announce"),
  nextName: $("next-stop-name"),
  nextDist: $("next-stop-dist"),
  stopIndex: $("stop-index"),
  progress: $("progress-fill"),
  progressText: $("route-progress-text"),
  pax: $("passenger-count"),
  speed: $("speed-value"),
  gear: $("gear"),
  street: $("street-name"),
  gpsStop: $("gps-stop"),
  light: $("light-indicator"),
  lightText: $("light-text"),
  start: $("screen-start"),
  complete: $("screen-complete"),
  stats: $("complete-stats"),
  btnView: $("btn-view"),
  btnAuto: $("btn-auto"),
  btnSound: $("btn-sound"),
  btnHelp: $("btn-help"),
  help: $("help"),
};

const crashOverlay = $("crash-overlay");
const crashInner = $("crash-inner");
let crashed = false;

function triggerCrash() {
  if (crashed) return;
  crashed = true;
  const kernel = Math.random() < 0.5;
  crashOverlay.classList.toggle("kernel", kernel);
  crashInner.innerHTML = kernel
    ? `<div class="crash-kernel">[    0.000000] Linux version 6.8.0-generic (buildd@lcy02) #1 SMP PREEMPT_DYNAMIC
[    3.104512] bus-sim[1337]: red light violation detected
[    4.211337] Kernel panic - not syncing: Fatal exception in interrupt
[    4.211500] CPU: 0 PID: 1 Comm: bus-sim Tainted: G           OE
[    4.211620] Hardware name: Zalaegerszeg Transit / eBus, BIOS 1.0
[    4.211700] Call Trace:
[    4.211780]  &lt;TASK&gt;
[    4.211860]  red_light_violation+0x10/0x20
[    4.211940]  driver_update+0x1a4/0x220
[    4.212020]  frame+0x2c/0x80
[    4.212100]  &lt;/TASK&gt;
[    4.212180] ---[ end Kernel panic - not syncing: Fatal exception in interrupt ]---</div>`
    : `<div class="face">:(</div>
<h1>A gép hibába futott, és újra kell indítania.</h1>
<p>Ha szeretne többet megtudni, később rákereshet a következőre: CRITICAL_PROCESS_DIED</p>
<p class="crash-code">Leállási kód: 0x000000EF · Piros jelzőlámpa szabálysértés</p>`;
  crashOverlay.classList.remove("hidden");
  speechSynthesis?.cancel?.();
  audio.setEnabled(false);
}

crashOverlay.addEventListener("click", () => location.reload());
window.addEventListener("keydown", () => {
  if (crashed) location.reload();
});

let route = null;
let traffic = null;
let markers = null;
let potholes = null;
let bumpT = 0;
let dwellStop = -1;
let auto = false;
let soundOn = true;
let view = 3;
let elapsed = 0;
let rideStarted = false;

const fmtKm = (m) => (m / 1000).toFixed(1).replace(".", ",") + " km";
const fmtM = (m) => (m >= 1000 ? fmtKm(m) : Math.round(m) + " m");

// ---------- route lista ----------
const list = $("route-list");
for (const r of CITY.routes) {
  const b = document.createElement("button");
  b.className = "route-card";
  b.innerHTML = `
    <span class="ref" style="background:${r.color}">${r.ref}</span>
    <span class="info">
      <span class="rname">${r.name}</span>
      <span class="rmeta">${fmtKm(r.length)} · ${r.stops.length} megálló · ${r.lights.length} jelzőlámpa</span>
    </span>`;
  b.addEventListener("click", () => startRoute(r));
  list.appendChild(b);
}

// ---------- indítás ----------
function startRoute(r) {
  route = r;
  window.SIM.route = r;
  if (traffic) traffic.dispose();
  if (markers) markers.dispose();
  traffic = new TrafficLights(scene, r);
  markers = new RouteMarkers(scene, r);
  if (potholes) potholes.dispose();
  potholes = new Potholes(scene, r);
  bumpT = 0;
  dwellStop = -1;
  window.SIM.traffic = traffic;
  driver.setRoute(r);
  minimap.setRoute(r);
  passengers.setRoute(r);
  audio.init();
  elapsed = 0;
  rideStarted = true;

  bus.visible = view === 3;
  cockpit.visible = view === 1;
  bus.userData.setDestination(`${r.ref}  ${shortDestination(r)}`);
  bus.userData.setDoors(false);

  ui.ref.textContent = r.ref;
  ui.ref.style.background = r.color;
  ui.name.textContent = r.name;
  const firstStop = r.stops[0].n;
  const lastStop = r.stops[r.stops.length - 1].n;
  ui.sub.textContent =
    firstStop === lastStop ? `Körjárat · ${r.stops[1] ? r.stops[1].n : ""}` : `${firstStop} → ${lastStop}`;

  ui.start.classList.add("hidden");
  ui.complete.classList.add("hidden");
  ui.hud.classList.remove("hidden");
  ui.light.classList.add("hidden");

  snapCamera();
  announce(`${r.ref} · ${r.name}`, "Indulás");
  speak(`A ${r.ref}-es járat elindult.`);
}

function shortDestination(r) {
  const last = r.stops[r.stops.length - 1].n;
  return last.replace(/^Zalaegerszeg,\s*/, "");
}

function backToMenu() {
  route = null;
  rideStarted = false;
  bus.visible = false;
  cockpit.visible = false;
  if (traffic) {
    traffic.dispose();
    traffic = null;
  }
  if (markers) {
    markers.dispose();
    markers = null;
  }
  if (potholes) {
    potholes.dispose();
    potholes = null;
  }
  minimap.setRoute(null);
  passengers.clear();
  audio.horn(false);
  ui.hud.classList.add("hidden");
  ui.complete.classList.add("hidden");
  ui.start.classList.remove("hidden");
  ui.help.classList.add("hidden");
}

// ---------- bejelentés ----------
let announceTimer = 0;
function announce(text, sub = "") {
  ui.announce.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ""}`;
  ui.announce.classList.add("show");
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => ui.announce.classList.remove("show"), 3400);
}

let voice = null;
function speak(text) {
  if (!soundOn || !("speechSynthesis" in window)) return;
  try {
    if (!voice) {
      const vs = speechSynthesis.getVoices();
      voice = vs.find((v) => v.lang && v.lang.toLowerCase().startsWith("hu")) || null;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "hu-HU";
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.pitch = 1;
    speechSynthesis.speak(u);
  } catch {
    /* csendben */
  }
}
if ("speechSynthesis" in window) {
  speechSynthesis.onvoiceschanged = () => {
    voice = null;
  };
}

// ---------- vezérlés ----------
const keys = new Set();
const isDown = (...codes) => codes.some((c) => keys.has(c));

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (k === "c") toggleView();
  if (k === "g") toggleAuto();
  if (k === "h") toggleSound();
  if (k === "r" && route) resetRide();
  if (k === "b") audio.horn(true);
  if (k === "?" || k === "f1") {
    e.preventDefault();
    ui.help.classList.toggle("hidden");
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
  if (e.key.toLowerCase() === "b") audio.horn(false);
});
window.addEventListener("blur", () => keys.clear());

function toggleView() {
  view = view === 3 ? 1 : 3;
  ui.btnView.innerHTML = `<span class="key">C</span> ${view === 3 ? "3. személy" : "1. személy"}`;
  cockpit.visible = view === 1 && !!route;
  bus.visible = !!route && view === 3;
  snapCamera();
}

function toggleAuto() {
  auto = !auto;
  ui.btnAuto.innerHTML = `<span class="key">G</span> Autopilot: ${auto ? "BE" : "KI"}`;
  ui.btnAuto.classList.toggle("primary", auto);
}

function toggleSound() {
  soundOn = !soundOn;
  ui.btnSound.innerHTML = `<span class="key">H</span> Hang: ${soundOn ? "BE" : "KI"}`;
  if (!soundOn) speechSynthesis?.cancel?.();
  audio.setEnabled(soundOn);
}

function resetRide() {
  driver.reset();
  if (traffic) traffic.reset();
  elapsed = 0;
  bus.userData.setDoors(false);
  announce("Busz visszaállítva", "Útvonal eleje");
  snapCamera();
}

ui.btnView.addEventListener("click", toggleView);
ui.btnAuto.addEventListener("click", toggleAuto);
ui.btnSound.addEventListener("click", toggleSound);
ui.btnHelp.addEventListener("click", () => ui.help.classList.toggle("hidden"));
$("btn-again").addEventListener("click", () => route && startRoute(route));
$("btn-other").addEventListener("click", backToMenu);

// egérrel kameraforgatás
let dragging = false,
  lastX = 0,
  lastY = 0,
  orbitYaw = 0,
  orbitPitch = 0;
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging || view !== 3) return;
  orbitYaw -= (e.clientX - lastX) * 0.005;
  orbitPitch = Math.max(-0.22, Math.min(0.6, orbitPitch + (e.clientY - lastY) * 0.003));
  lastX = e.clientX;
  lastY = e.clientY;
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("dblclick", () => {
  orbitYaw = 0;
  orbitPitch = 0;
});

// ---------- driver események ----------
driver.onEvent = (type, stop) => {
  if (type === "approach") {
    speak(`Következő megálló: ${stop.n}`);
  } else if (type === "stop") {
    announce(stop.n, "Megálló");
    speak(stop.n);
  } else if (type === "depart") {
    audio.door(false);
  } else if (type === "crash") {
    audio.thud();
    bumpT = 0.45;
  } else if (type === "redlight") {
    if (Math.random() < 0.1) {
      triggerCrash();
    } else {
      elapsed += 10;
      announce("Piros lámpa!", "+10 mp büntetés");
      speak("Piros lámpa. Tíz másodperc büntetés.");
    }
  } else if (type === "skip") {
    announce(stop.n, "Kihagyott megálló");
  } else if (type === "complete") {
    ui.complete.classList.remove("hidden");
    ui.stats.innerHTML = `
      <div><b>${(elapsed / 60).toFixed(0)}</b><span>perc</span></div>
      <div><b>${fmtKm(route.length)}</b><span>táv</span></div>
      <div><b>${route.stops.length - 1}</b><span>megálló</span></div>`;
    speak("Végállomás. Köszönjük, hogy velünk utazott.");
  }
};

// ---------- kamera ----------
const camPos = new THREE.Vector3(240, 180, 460);
const camTarget = new THREE.Vector3(0, 0, 0);
const tmpPos = new THREE.Vector3();
const tmpTarget = new THREE.Vector3();

function snapCamera() {
  if (!route) return;
  camPos.set(0, 0, 0);
  updateCamera(1, true);
}

function updateCamera(dt, snap = false) {
  const h = driver.heading;
  const fx = Math.sin(h),
    fz = Math.cos(h);
  const gy = route ? terrainHeight(driver.x, driver.z) : 0;
  if (!route) {
    // kezdőképernyő: lassú keringés a város felett
    const t = performance.now() * 0.00004;
    tmpPos.set(Math.cos(t) * 620, 210, Math.sin(t) * 620);
    tmpTarget.set(0, 0, 0);
    camPos.lerp(tmpPos, snap ? 1 : 1 - Math.exp(-dt * 1.4));
    camTarget.lerp(tmpTarget, snap ? 1 : 1 - Math.exp(-dt * 1.4));
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    return;
  }

  if (view === 1) {
    const rightX = -fz,
      rightZ = fx;
    const px = driver.x + fx * 4.15 - rightX * 0.72;
    const pz = driver.z + fz * 4.15 - rightZ * 0.72;
    camera.position.set(px, gy + 2.44, pz);
    camera.lookAt(px + fx * 40, gy + 1.95, pz + fz * 40);
    // apró dőlés
    camera.rotateZ(-driver.yawRate * 0.02);
    return;
  }

  const dist = 15.2 + Math.min(4.5, Math.abs(driver.speed) * 0.26);
  const el = 0.34 + orbitPitch;
  const ang = h + Math.PI + orbitYaw;
  tmpPos.set(
    driver.x + Math.sin(ang) * dist * Math.cos(el),
    gy + 1.4 + dist * Math.sin(el),
    driver.z + Math.cos(ang) * dist * Math.cos(el)
  );
  tmpPos.y = Math.max(tmpPos.y, terrainHeight(tmpPos.x, tmpPos.z) + 1.2);
  tmpTarget.set(driver.x + fx * 5.5, gy + 2.1, driver.z + fz * 5.5);
  const k = snap ? 1 : 1 - Math.exp(-dt * 5.5);
  camPos.lerp(tmpPos, k);
  camTarget.lerp(tmpTarget, k);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

// ---------- ciklus ----------
const clock = new THREE.Clock();
let lastLight = null;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (crashed) {
    renderer.render(scene, camera);
    return;
  }

  if (route && rideStarted) {
    elapsed += dt;
    const throttle = isDown("w", "arrowup") ? 1 : isDown("s", "arrowdown") ? -1 : 0;
    const steer = isDown("a", "arrowleft") ? 1 : isDown("d", "arrowright") ? -1 : 0;
    const input = { throttle, steer, brake: isDown(" ") };
    const st = driver.update(dt, input, auto, traffic);

    // megálló: utascsere (állapot alapján, eseménytől függetlenül)
    if (st.dwelling && dwellStop !== st.nextStopIndex) {
      dwellStop = st.nextStopIndex;
      passengers.alight(st);
      passengers.board(st.nextStopIndex, st);
      audio.bell();
      audio.door(true);
    } else if (!st.dwelling) {
      dwellStop = -1;
    }
    // kátyú
    const hit = potholes ? potholes.update(st.x, st.z, Math.abs(st.speed), dt) : 0;
    if (hit) {
      audio.thud();
      bumpT = 0.3;
    }
    bumpT = Math.max(0, bumpT - dt);
    const bump = bumpT > 0 ? Math.sin((bumpT / 0.45) * Math.PI) * 0.07 : 0;
    const groundY = terrainHeight(st.x, st.z);
    bus.position.set(st.x, groundY + 0.09 + bump, st.z);
    const pitch = Math.max(-0.035, Math.min(0.035, -st.accel * 0.004));
    const roll = Math.max(-0.045, Math.min(0.045, -st.yawRate * st.speed * 0.012));
    const hf = Math.sin(st.heading),
      hb = Math.cos(st.heading);
    const slope = -Math.atan2(
      terrainHeight(st.x + hf * 4, st.z + hb * 4) - terrainHeight(st.x - hf * 4, st.z - hb * 4),
      8
    );
    bus.rotation.set(pitch + Math.max(-0.14, Math.min(0.14, slope)), st.heading, roll);
    bus.userData.setDoors(st.doorOpen);
    const spin = (st.speed * dt) / 0.54;
    for (const w of bus.userData.wheels) w.rotation.x += spin;
    if (cockpit.userData.wheel) cockpit.userData.wheel.rotation.z = st.steer * 2.5;

    const info = traffic ? traffic.update(dt, st.progress, Math.abs(st.speed)) : null;
    lastLight = info;
    minimap.update({ x: st.x, z: st.z, heading: st.heading }, route, {
      nextStop: st.nextStop,
      lights: traffic,
    });
    passengers.update(dt);
    audio.update(Math.abs(st.speed), throttle, true, dt);
    sun.position.set(st.x - 135, 165, st.z + 95);
    sun.target.position.set(st.x, 0, st.z);
    sun.target.updateMatrixWorld();
    updateHud(st, info);
  } else {
    minimap.update(
      { x: driver.x || 0, z: driver.z || 0, heading: driver.heading || 0 },
      null,
      null
    );
  }

  updateCamera(dt);
  if (bumpT > 0) camera.position.y += Math.sin((bumpT / 0.45) * Math.PI) * 0.05;
  renderer.render(scene, camera);
}

function updateHud(st, light) {
  ui.speed.textContent = Math.round(Math.abs(st.speed) * 3.6);
  ui.gear.textContent = st.speed < -0.2 ? "R" : Math.abs(st.speed) < 0.2 ? "P" : "D";
  ui.street.textContent = st.street;

  const stop = st.nextStop;
  if (stop) {
    ui.nextName.textContent = stop.n;
    ui.nextDist.textContent = st.dwelling ? "Megálló" : fmtM(st.nextStopDist);
    ui.stopIndex.textContent = `${Math.min(st.nextStopIndex + 1, route.stops.length)} / ${route.stops.length}`;
    ui.gpsStop.textContent = `${stop.n} · ${fmtM(st.nextStopDist)}`;
  } else {
    ui.nextName.textContent = "Végállomás";
    ui.nextDist.textContent = "—";
  }
  const pct = Math.min(100, (st.progress / route.length) * 100);
  ui.progress.style.width = pct + "%";
  ui.pax.textContent = passengers.onboard;
  ui.progressText.textContent = `${fmtKm(st.progress)} / ${fmtKm(route.length)}`;

  if (light && light.d < 62 && light.d > -2) {
    ui.light.classList.remove("hidden");
    ui.light.classList.toggle("green", light.state === "green");
    ui.lightText.textContent =
      light.state === "red"
        ? "PIROS – állj meg"
        : light.state === "yellow"
          ? "SÁRGA – lassíts"
          : "ZÖLD – mehetsz";
  } else {
    ui.light.classList.add("hidden");
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// kezdő pozíció a busznak (még rejtett)
driver.x = 0;
driver.z = 0;
driver.heading = 0;
updateCamera(1, true);
frame();

// URL paraméter: ?route=20
const wanted = new URLSearchParams(location.search).get("route");
if (wanted) {
  const r = CITY.routes.find((x) => x.ref.toLowerCase() === wanted.toLowerCase());
  if (r) setTimeout(() => startRoute(r), 300);
}













