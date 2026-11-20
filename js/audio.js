// Electric bus soundscape (WebAudio, procedural).
//
// Layering follows how a real battery-electric bus sounds:
//  - tyre/road noise and wind dominate as speed rises,
//  - a tonal motor whine rises with motor RPM (pitch tracks speed),
//  - a faint inverter switching tone sits above the motor whine,
//  - AVAS (pedestrian warning) is only active while rolling slowly,
//    never at standstill, and is a soft low whir instead of a siren.
export class BusAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.hornNodes = null;
    this.creakIn = 1;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(ctx.destination);

    // One shared noise buffer, reused by every filtered noise layer.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const noise = () => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };

    // --- tyre / road ---------------------------------------------------
    // Low rumble: the body of the rolling noise.
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = "lowpass";
    rumbleLp.frequency.value = 320;
    rumbleLp.Q.value = 0.6;
    noise().connect(rumbleLp);
    rumbleLp.connect(this.rumbleGain).connect(this.master);

    // Tread hiss: narrow band around 700 Hz, much quieter than the rumble.
    this.treadGain = ctx.createGain();
    this.treadGain.gain.value = 0;
    const treadBp = ctx.createBiquadFilter();
    treadBp.type = "bandpass";
    treadBp.frequency.value = 720;
    treadBp.Q.value = 0.55;
    const treadLp = ctx.createBiquadFilter();
    treadLp.type = "lowpass";
    treadLp.frequency.value = 1900;
    noise().connect(treadBp);
    treadBp.connect(treadLp);
    treadLp.connect(this.treadGain).connect(this.master);

    // --- wind ----------------------------------------------------------
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    const windHp = ctx.createBiquadFilter();
    windHp.type = "highpass";
    windHp.frequency.value = 1200;
    noise().connect(windHp);
    windHp.connect(this.windGain).connect(this.master);

    // --- motor whine ---------------------------------------------------
    // Electromagnetic force ripple: a clean tone whose pitch follows RPM,
    // plus two harmonics. A lowpass keeps it from sounding like a vacuum.
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    const motorLp = ctx.createBiquadFilter();
    motorLp.type = "lowpass";
    motorLp.frequency.value = 1600;
    motorLp.Q.value = 0.4;
    motorLp.connect(this.motorGain).connect(this.master);

    this.motor1 = ctx.createOscillator();
    this.motor1.type = "triangle";
    this.motor1.frequency.value = 40;
    const m1g = ctx.createGain();
    m1g.gain.value = 0.55;
    this.motor1.connect(m1g);
    m1g.connect(motorLp);
    this.motor1.start();

    this.motor2 = ctx.createOscillator();
    this.motor2.type = "sine";
    this.motor2.frequency.value = 80;
    const m2g = ctx.createGain();
    m2g.gain.value = 0.22;
    this.motor2.connect(m2g);
    m2g.connect(motorLp);
    this.motor2.start();

    this.motor3 = ctx.createOscillator();
    this.motor3.type = "sine";
    this.motor3.frequency.value = 120;
    const m3g = ctx.createGain();
    m3g.gain.value = 0.07;
    this.motor3.connect(m3g);
    m3g.connect(motorLp);
    this.motor3.start();

    // Inverter switching tone: high, very quiet, mostly masked at speed.
    this.inverterGain = ctx.createGain();
    this.inverterGain.gain.value = 0;
    const invBp = ctx.createBiquadFilter();
    invBp.type = "bandpass";
    invBp.frequency.value = 950;
    invBp.Q.value = 2.2;
    this.inverter = ctx.createOscillator();
    this.inverter.type = "sine";
    this.inverter.frequency.value = 950;
    this.inverter.connect(invBp);
    invBp.connect(this.inverterGain).connect(this.master);
    this.inverter.start();

    // --- AVAS (pedestrian warning) -------------------------------------
    // Only while rolling below ~29 km/h. Soft low-frequency whir with a
    // gentle amplitude tremolo so it reads as "vehicle", not "siren".
    this.avasGain = ctx.createGain();
    this.avasGain.gain.value = 0;
    this.avasTrem = ctx.createGain();
    this.avasTrem.gain.value = 1;
    this.avasGain.connect(this.avasTrem).connect(this.master);

    const avasLfo = ctx.createOscillator();
    avasLfo.type = "sine";
    avasLfo.frequency.value = 6.5;
    const avasLfoGain = ctx.createGain();
    avasLfoGain.gain.value = 0.12;
    avasLfo.connect(avasLfoGain);
    avasLfoGain.connect(this.avasTrem.gain);
    avasLfo.start();

    this.avas1 = ctx.createOscillator();
    this.avas1.type = "triangle";
    this.avas1.frequency.value = 155;
    const a1g = ctx.createGain();
    a1g.gain.value = 0.6;
    this.avas1.connect(a1g);
    a1g.connect(this.avasGain);
    this.avas1.start();

    this.avas2 = ctx.createOscillator();
    this.avas2.type = "sine";
    this.avas2.frequency.value = 310;
    const a2g = ctx.createGain();
    a2g.gain.value = 0.28;
    this.avas2.connect(a2g);
    a2g.connect(this.avasGain);
    this.avas2.start();

    this.avas3 = ctx.createOscillator();
    this.avas3.type = "sine";
    this.avas3.frequency.value = 465;
    const a3g = ctx.createGain();
    a3g.gain.value = 0.08;
    this.avas3.connect(a3g);
    a3g.connect(this.avasGain);
    this.avas3.start();

    const avasNoise = noise();
    const avasBp = ctx.createBiquadFilter();
    avasBp.type = "bandpass";
    avasBp.frequency.value = 600;
    avasBp.Q.value = 0.8;
    const avasNg = ctx.createGain();
    avasNg.gain.value = 0.1;
    avasNoise.connect(avasBp);
    avasBp.connect(avasNg);
    avasNg.connect(this.avasGain);

    // --- bus body rattle above ~30 km/h -------------------------------
    // Nem magas sistergés: a karosszéria mély, zötykölődő zaja.
    this.rattleGain = ctx.createGain();
    this.rattleGain.gain.value = 0;
    const rattleBp = ctx.createBiquadFilter();
    rattleBp.type = "bandpass";
    rattleBp.frequency.value = 150;
    rattleBp.Q.value = 0.8;
    noise().connect(rattleBp);
    rattleBp.connect(this.rattleGain).connect(this.master);
    this.shakeIn = 0.8;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  }

  update(speed, throttle, active, dt = 0.016) {
    if (!this.ctx) return;
    const v = Math.max(0, Math.abs(speed));
    const t = this.ctx.currentTime;
    const road = Math.min(1, v / 14);

    this.rumbleGain.gain.setTargetAtTime(active ? Math.min(0.12, v * 0.009) : 0, t, 0.22);
    this.treadGain.gain.setTargetAtTime(active ? Math.min(0.045, v * 0.004) : 0, t, 0.22);
    this.windGain.gain.setTargetAtTime(active ? Math.min(0.032, v * v * 0.00018) : 0, t, 0.3);

    // Motor pitch tracks RPM. At standstill there is only a faint idle hum.
    const fMotor = 32 + v * 24;
    this.motor1.frequency.setTargetAtTime(fMotor, t, 0.12);
    this.motor2.frequency.setTargetAtTime(fMotor * 2, t, 0.12);
    this.motor3.frequency.setTargetAtTime(fMotor * 3, t, 0.12);
    const motorLevel = active
      ? 0.004 + road * 0.016 + Math.abs(throttle) * 0.01
      : 0;
    this.motorGain.gain.setTargetAtTime(motorLevel, t, 0.18);

    const fInv = 600 + v * 110;
    this.inverter.frequency.setTargetAtTime(fInv, t, 0.15);
    this.inverterGain.gain.setTargetAtTime(
      active ? 0.0015 + road * 0.0022 + Math.abs(throttle) * 0.0012 : 0,
      t,
      0.2
    );

    // AVAS: off at standstill, fades in above walking pace and out by ~29 km/h.
    const avasLevel = active && v > 0.35 && v < 8 ? Math.min(1, (v - 0.35) / 1.2) * (1 - v / 8) : 0;
    this.avasGain.gain.setTargetAtTime(avasLevel * 0.03, t, 0.15);
    this.avas1.frequency.setTargetAtTime(150 + v * 9, t, 0.2);
    this.avas2.frequency.setTargetAtTime(300 + v * 18, t, 0.2);
    this.avas3.frequency.setTargetAtTime(450 + v * 27, t, 0.2);

    // Karosszéria-zötykölődés 30 km/h felett: mély zörej + ritka ütések.
    const rattle = active ? Math.max(0, Math.min(1, (v - 8) / 12)) : 0;
    const jitter = rattle * (0.004 + Math.random() * 0.008);
    this.rattleGain.gain.setTargetAtTime(jitter, t, 0.08);
    if (rattle > 0.15) {
      this.shakeIn -= dt;
      if (this.shakeIn <= 0) {
        this.shakeIn = 0.5 + Math.random() * 1.7;
        this.thud(0.012 + rattle * 0.03);
      }
      this.creakIn -= dt;
      if (this.creakIn <= 0) {
        this.creakIn = 0.35 + Math.random() * 1.5;
        this.creak(0.01 + rattle * 0.035);
      }
    }
  }

  creak(vol) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 380 + Math.random() * 520;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18 + Math.random() * 0.2);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t0, Math.random());
    src.stop(t0 + 0.5);
  }

  thud(vol = 0.09) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.3);
  }

  bell() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    for (const [f, d] of [[988, 0], [1319, 0.18]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.1, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.55);
      o.connect(g);
      g.connect(this.master);
      o.start(t0 + d);
      o.stop(t0 + d + 0.6);
    }
  }

  door(open) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = open ? 2400 : 1500;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + 0.55);
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 1046;
    og.gain.setValueAtTime(0.0001, t0 + 0.08);
    og.gain.exponentialRampToValueAtTime(0.04, t0 + 0.1);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    o.connect(og);
    og.connect(this.master);
    o.start(t0 + 0.08);
    o.stop(t0 + 0.34);
  }

  horn(on) {
    if (!this.ctx) return;
    if (on) {
      if (this.hornNodes) return;
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.03);
      g.connect(this.master);
      const o1 = ctx.createOscillator();
      o1.type = "square";
      o1.frequency.value = 311;
      const o2 = ctx.createOscillator();
      o2.type = "square";
      o2.frequency.value = 370;
      o1.connect(g);
      o2.connect(g);
      o1.start();
      o2.start();
      this.hornNodes = { o1, o2, g };
    } else if (this.hornNodes) {
      const { o1, o2, g } = this.hornNodes;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o1.stop(t + 0.15);
      o2.stop(t + 0.15);
      this.hornNodes = null;
    }
  }
}
