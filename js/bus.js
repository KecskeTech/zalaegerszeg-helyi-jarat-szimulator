import * as THREE from "three";

function labelTexture(text, { fg = "#ffcc55", bg = "#100c06", font = "bold 64px Segoe UI, Arial" } = {}) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.font = font;
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function sideTexture(text) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 192;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  g.font = "bold 92px Segoe UI, Arial";
  g.fillStyle = "#127d78";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBus() {
  const bus = new THREE.Group();
  bus.name = "bus";

  const white = new THREE.MeshLambertMaterial({ color: 0xf3f4ef });
  const teal = new THREE.MeshLambertMaterial({ color: 0x127d78 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x24282c });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x2a3c44,
    metalness: 0.35,
    roughness: 0.18,
    transparent: true,
    opacity: 0.88,
  });
  const trim = new THREE.MeshLambertMaterial({ color: 0x9aa1a6 });
  const rubber = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const hub = new THREE.MeshLambertMaterial({ color: 0xb8bcc0 });

  const add = (geo, mat, x, y, z, parent = bus) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  const L = 12,
    W = 2.55;

  // alváz / szoknya
  add(new THREE.BoxGeometry(W, 0.62, L), dark, 0, 0.52, 0);
  add(new THREE.BoxGeometry(W + 0.06, 0.3, L + 0.1), trim, 0, 0.9, 0);

  // utastér
  add(new THREE.BoxGeometry(W, 1.94, L - 0.4), white, 0, 1.9, 0);
  add(new THREE.BoxGeometry(W - 0.14, 0.34, L - 0.6), white, 0, 3.02, 0);

  // ablakok oldalt
  const winGeo = new THREE.BoxGeometry(0.05, 1.38, L - 1.5);
  add(winGeo, glass, W / 2 + 0.005, 2.2, 0.1);
  add(winGeo, glass, -W / 2 - 0.005, 2.2, 0.1);

  // szélvédő / hátsó ablak
  add(new THREE.BoxGeometry(2.24, 1.5, 0.06), glass, 0, 2.22, L / 2 - 0.17);
  add(new THREE.BoxGeometry(2.14, 1.2, 0.06), glass, 0, 2.28, -L / 2 + 0.17);

  // tetőelemek
  add(new THREE.BoxGeometry(1.95, 0.3, 4.4), trim, 0, 3.3, -0.4);
  add(new THREE.BoxGeometry(1.7, 0.24, 2.4), white, 0, 3.28, 3.1);

  // lökhárítók
  add(new THREE.BoxGeometry(W - 0.06, 0.5, 0.3), trim, 0, 0.78, L / 2 - 0.02);
  add(new THREE.BoxGeometry(W - 0.06, 0.5, 0.3), trim, 0, 0.78, -L / 2 + 0.02);

  // lámpák
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff4d0,
    emissive: 0xfff0c0,
    emissiveIntensity: 1.8,
    roughness: 0.3,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x8a1010,
    emissive: 0xff2222,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  const hg = new THREE.BoxGeometry(0.52, 0.24, 0.1);
  add(hg, headMat, 0.82, 1.02, L / 2 - 0.02);
  add(hg, headMat, -0.82, 1.02, L / 2 - 0.02);
  const tg = new THREE.BoxGeometry(0.34, 0.42, 0.1);
  add(tg, tailMat, 0.94, 1.35, -L / 2 + 0.02);
  add(tg, tailMat, -0.94, 1.35, -L / 2 + 0.02);

  // irányjelzők
  const blinkerMat = new THREE.MeshStandardMaterial({
    color: 0xff9a1e,
    emissive: 0xff8a00,
    emissiveIntensity: 0.5,
  });
  const bg = new THREE.BoxGeometry(0.2, 0.14, 0.1);
  for (const sx of [1, -1]) {
    add(bg, blinkerMat, sx * 1.16, 1.02, L / 2 - 0.02);
    add(bg, blinkerMat, sx * 1.16, 1.48, -L / 2 + 0.02);
  }

  // oldalsó csík (arculat)
  const stripe = new THREE.BoxGeometry(0.02, 0.42, L - 0.5);
  add(stripe, teal, W / 2 + 0.02, 1.28, 0);
  add(stripe, teal, -W / 2 - 0.02, 1.28, 0);
  const stripe2 = new THREE.BoxGeometry(0.02, 0.12, L - 0.5);
  add(stripe2, teal, W / 2 + 0.02, 1.55, 0);
  add(stripe2, teal, -W / 2 - 0.02, 1.55, 0);

  // oldalsó felirat
  const sideTex = sideTexture("ZALAEGERSZEG");
  const sideMat = new THREE.MeshBasicMaterial({
    map: sideTex,
    transparent: true,
    depthWrite: false,
  });
  const sg = new THREE.PlaneGeometry(3.2, 0.6);
  const s1 = add(sg, sideMat, W / 2 + 0.04, 1.28, -2.6);
  s1.rotation.y = Math.PI / 2;
  const s2 = add(sg, sideMat, -W / 2 - 0.04, 1.28, -2.6);
  s2.rotation.y = -Math.PI / 2;

  // ajtók (jobb oldal)
  const doorGlass = new THREE.MeshStandardMaterial({
    color: 0x1e2c32,
    metalness: 0.4,
    roughness: 0.2,
    transparent: true,
    opacity: 0.9,
  });
  const doorGeo = new THREE.BoxGeometry(0.06, 1.85, 1.24);
  const doorFrame = new THREE.BoxGeometry(0.1, 0.1, 1.3);
  const doors = [];
  for (const dz of [3.35, -1.15]) {
    const d = new THREE.Group();
    const panel = new THREE.Mesh(doorGeo, doorGlass);
    panel.position.set(0, 0, 0);
    d.add(panel);
    const top = new THREE.Mesh(doorFrame, trim);
    top.position.set(0, 0.94, 0);
    d.add(top);
    const bot = new THREE.Mesh(doorFrame, trim);
    bot.position.set(0, -0.94, 0);
    d.add(bot);
    d.position.set(W / 2 + 0.03, 1.93, dz);
    bus.add(d);
    doors.push(d);
  }

  // tükrök
  for (const sx of [1, -1]) {
    const arm = add(new THREE.BoxGeometry(0.05, 0.05, 0.55), dark, sx * (W / 2 + 0.1), 2.6, L / 2 - 0.5);
    arm.rotation.x = 0.25;
    const mir = add(new THREE.BoxGeometry(0.07, 0.42, 0.24), dark, sx * (W / 2 + 0.32), 2.45, L / 2 - 0.28);
    mir.rotation.y = sx * 0.15;
  }

  // kerekek
  const wheels = [];
  const tyreGeo = new THREE.CylinderGeometry(0.54, 0.54, 0.36, 18);
  tyreGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.38, 12);
  hubGeo.rotateZ(Math.PI / 2);
  for (const az of [3.75, -3.35]) {
    for (const sx of [1, -1]) {
      const tyre = add(tyreGeo, rubber, sx * (W / 2 - 0.16), 0.54, az);
      const hb = new THREE.Mesh(hubGeo, hub);
      hb.position.set(0, 0, 0);
      tyre.add(hb);
      wheels.push(tyre);
    }
  }

  // elektromos jelvény
  const bolt = new THREE.Shape();
  bolt.moveTo(0.1, 0.3);
  bolt.lineTo(-0.1, 0.02);
  bolt.lineTo(0.02, 0.02);
  bolt.lineTo(-0.08, -0.3);
  bolt.lineTo(0.14, 0.0);
  bolt.lineTo(0.0, 0.0);
  bolt.closePath();
  const boltGeo = new THREE.ExtrudeGeometry(bolt, { depth: 0.03, bevelEnabled: false });
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x8de3c8,
    emissive: 0x1f8f74,
    emissiveIntensity: 0.7,
  });
  const b1 = new THREE.Mesh(boltGeo, boltMat);
  b1.position.set(0.55, 1.75, -L / 2 + 0.02);
  b1.rotation.y = Math.PI;
  bus.add(b1);

  // célkijelző
  const destTex = labelTexture("20  Belvárosi körjárat");
  const destMat = new THREE.MeshBasicMaterial({ map: destTex });
  const destGeo = new THREE.PlaneGeometry(1.85, 0.3);
  const dest = new THREE.Mesh(destGeo, destMat);
  dest.position.set(0, 2.84, L / 2 - 0.13);
  bus.add(dest);

  // célkijelző hátul is
  const destBackMat = new THREE.MeshBasicMaterial({ map: destTex });
  const destBack = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.24), destBackMat);
  destBack.position.set(0, 2.72, -L / 2 + 0.1);
  destBack.rotation.y = Math.PI;
  bus.add(destBack);

  // lámpa köd?
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 1.2, L + 1.2),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.07;
  bus.add(shadow);

  bus.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material && o.material.transparent) return;
    if (o === shadow) return;
    o.castShadow = true;
    o.receiveShadow = false;
  });

  bus.userData = {
    wheels,
    doors,
    setDestination(text) {
      const tex = labelTexture(text);
      destMat.map.dispose();
      destMat.map = tex;
      destMat.needsUpdate = true;
      destBackMat.map = tex;
      destBackMat.needsUpdate = true;
    },
    setDoors(open) {
      for (const d of doors) d.scale.z = open ? 0.15 : 1;
    },
  };
  return bus;
}

export function createCockpit() {
  const g = new THREE.Group();
  const dashMat = new THREE.MeshLambertMaterial({ color: 0x2c343b });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x171c20 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x424c54 });
  const softMat = new THREE.MeshLambertMaterial({ color: 0x353d44 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x22343d,
    metalness: 0.3,
    roughness: 0.15,
    transparent: true,
    opacity: 0.55,
  });
  const displayMat = new THREE.MeshStandardMaterial({
    color: 0x03151a,
    emissive: 0x0a3540,
    emissiveIntensity: 0.55,
  });

  // A kamerát a bal oldali vezetőülésre tesszük, ezért a műszerfal
  // a kamera-local +x (bus jobb oldala) felé hosszabb.
  const DASH_X = 0.62;

  // padló / lábtér
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 1.5), softMat);
  floor.position.set(DASH_X, -1.14, -0.95);
  g.add(floor);

  // mennyezet és oldalfalak, hogy ne "lebegjen" a műszerfal
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.06, 2.0), softMat);
  ceiling.position.set(DASH_X, 1.04, -1.05);
  g.add(ceiling);
  for (const sx of [-0.66, 1.92]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 1.7), dashMat);
    wall.position.set(sx, -0.62, -1.05);
    g.add(wall);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 1.7), trimMat);
    rail.position.set(sx, -0.16, -1.05);
    g.add(rail);
  }

  // szellőzők a műszerfal tetején
  for (const sx of [0.36, 0.72]) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.09), darkMat);
    vent.position.set(sx, -0.69, -1.44);
    vent.rotation.x = 0.2;
    g.add(vent);
  }

  // műszerfal: a kormány előtt/alatt, hogy ne lógjon bele
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.5, 0.5), dashMat);
  dash.position.set(DASH_X, -0.98, -1.72);
  dash.rotation.x = 0.1;
  g.add(dash);

  const dashTop = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.08, 0.6), trimMat);
  dashTop.position.set(DASH_X, -0.72, -1.72);
  dashTop.rotation.x = 0.28;
  g.add(dashTop);

  // oldalsó műszerfal-panelek
  for (const sx of [-0.64, 1.9]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.8, 1.2), dashMat);
    side.position.set(sx, -0.88, -1.35);
    g.add(side);
  }

  // műszeregység a kormány mögött
  const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.07), darkMat);
  cluster.position.set(0, -0.64, -1.42);
  cluster.rotation.x = -0.12;
  g.add(cluster);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.06, 0.18), dashMat);
  hood.position.set(0, -0.78, -1.5);
  hood.rotation.x = 0.18;
  g.add(hood);

  // két kerek műszer (sebesség / energia)
  for (const sx of [-0.13, 0.13]) {
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.062, 20), displayMat);
    dial.position.set(sx, -0.64, -1.375);
    dial.rotation.x = -0.12;
    g.add(dial);
  }

  // központi kijelző
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.21, 0.03), displayMat);
  screen.position.set(0.78, -0.68, -1.4);
  screen.rotation.x = -0.18;
  screen.rotation.y = -0.1;
  g.add(screen);

  // kapcsolók / gombok
  for (let i = 0; i < 4; i++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.035, 8), trimMat);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(-0.42 + i * 0.1, -0.72, -1.4);
    g.add(btn);
  }

  // kormány: a műszerfal előtt, hogy ne metssze azt
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.032, 10, 28), darkMat);
  wheel.add(rim);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.028, 0.028), trimMat);
    spoke.position.set(
      Math.cos((i * 2 * Math.PI) / 3 + Math.PI / 2) * 0.12,
      Math.sin((i * 2 * Math.PI) / 3 + Math.PI / 2) * 0.12,
      0
    );
    spoke.rotation.z = (i * 2 * Math.PI) / 3 + Math.PI / 2;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.055, 14), trimMat);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  wheel.position.set(0, -0.5, -1.3);
  wheel.rotation.x = -0.3;
  g.add(wheel);

  // kormányoszlop
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.3, 10), darkMat);
  column.position.set(0, -0.64, -1.48);
  column.rotation.x = Math.PI / 2 - 0.3;
  g.add(column);

  // szélvédő keret / A-oszlopok
  for (const sx of [-0.66, 1.92]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.4, 0.1), dashMat);
    pillar.position.set(sx, 0.22, -2.15);
    pillar.rotation.z = sx > 0 ? 0.035 : -0.035;
    g.add(pillar);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.08, 0.1), dashMat);
  header.position.set(DASH_X, 0.96, -2.15);
  g.add(header);

  // oldalsó ajtókeretek
  for (const sx of [-0.64, 1.9]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.45, 0.08), darkMat);
    rail.position.set(sx, -0.1, -0.75);
    g.add(rail);
  }

  // jobb oldali utaskapcsoló / jegykezelő konzol
  const consoleBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.28), dashMat);
  consoleBody.position.set(1.2, -0.66, -1.05);
  g.add(consoleBody);
  const consoleScreen = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.02), displayMat);
  consoleScreen.position.set(1.2, -0.52, -0.9);
  g.add(consoleScreen);

  // visszapillantó
  const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.2, 0.045), darkMat);
  mirrorArm.position.set(DASH_X, 0.84, -2.2);
  g.add(mirrorArm);
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.11, 0.04), glassMat);
  mirror.position.set(DASH_X, 0.73, -2.21);
  g.add(mirror);

  g.userData.wheel = wheel;
  g.userData.screen = screen;
  return g;
}


