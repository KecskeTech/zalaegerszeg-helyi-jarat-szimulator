// Elektromos busz hangok (WebAudio, procedurális).
// Jelleg: halk gumi/útzaj, magas inverter-sípolás, AVAS alacsony sebességnél,
// 40 km/h felett utastér-zörgés / nyikorgás. Nincs dízelmoraj.
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

    // gördülési zaj (domináns)
    this.roadGain = ctx.createGain();
    this.roadGain.gain.value = 0;
    const rl = ctx.createBiquadFilter();
    rl.type = "lowpass";
    rl.frequency.value = 1100;
    noise().connect(rl);
    rl.connect(this.roadGain).connect(this.master);

    // szél
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    const wh = ctx.createBiquadFilter();
    wh.type = "highpass";
    wh.frequency.value = 2200;
    noise().connect(wh);
    wh.connect(this.windGain).connect(this.master);

    // inverter-sípolás (magas, halk, nem porszívó)
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    const bpw = ctx.createBiquadFilter();
    bpw.type = "bandpass";
    bpw.frequency.value = 2400;
    bpw.Q.value = 1.6;
    this.whine = ctx.createOscillator();
    this.whine.type = "sine";
    this.whine.frequency.value = 1800;
    this.whine.connect(bpw);
    bpw.connect(this.whineGain).connect(this.master);
    this.whine.start();
    this.whine2 = ctx.createOscillator();
    this.whine2.type = "sine";
    this.whine2.frequency.value = 2700;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    this.whine2.connect(g2);
    g2.connect(this.whineGain);
    this.whine2.start();

    // AVAS (gyalogosfigyelmeztető) alacsony sebességnél
    this.avasGain = ctx.createGain();
    this.avasGain.gain.value = 0;
    this.avas = ctx.createOscillator();
    this.avas.type = "sine";
    this.avas.frequency.value = 1150;
    this.avas.connect(this.avasGain).connect(this.master);
    this.avas.start();
    this.vib = ctx.createOscillator();
    this.vib.frequency.value = 3.1;
    const vg = ctx.createGain();
    vg.gain.value = 18;
    this.vib.connect(vg);
    vg.connect(this.avas.frequency);
    this.vib.start();

    // utastér-zörgés 40 km/h felett
    this.rattleGain = ctx.createGain();
    this.rattleGain.gain.value = 0;
    const rb = ctx.createBiquadFilter();
    rb.type = "bandpass";
    rb.frequency.value = 2600;
    rb.Q.value = 0.7;
    noise().connect(rb);
    rb.connect(this.rattleGain).connect(this.master);
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.9 : 0;
  }

  update(speed, throttle, active, dt = 0.016) {
    if (!this.ctx) return;
    const v = Math.max(0, Math.abs(speed));
    const t = this.ctx.currentTime;
    this.roadGain.gain.setTargetAtTime(Math.min(0.17, v * 0.013), t, 0.2);
    this.windGain.gain.setTargetAtTime(Math.min(0.045, v * v * 0.00024), t, 0.25);
    const f = 1500 + v * 95;
    this.whine.frequency.setTargetAtTime(f, t, 0.15);
    this.whine2.frequency.setTargetAtTime(f * 1.5, t, 0.15);
    this.whineGain.gain.setTargetAtTime(active ? 0.0045 + Math.min(0.006, v * 0.0005) + Math.abs(throttle) * 0.004 : 0, t, 0.2);
    this.avasGain.gain.setTargetAtTime(active && v < 7.5 ? 0.022 * (1 - v / 7.5) : 0, t, 0.25);
    this.avas.frequency.setTargetAtTime(1080 + v * 22, t, 0.2);

    // zörgés / nyikorgás 11 m/s (≈40 km/h) felett
    const rattle = active ? Math.max(0, Math.min(1, (v - 11) / 7)) : 0;
    const jitter = rattle * (0.012 + Math.random() * 0.022);
    this.rattleGain.gain.setTargetAtTime(jitter, t, 0.05);
    if (rattle > 0.25) {
      this.creakIn -= dt;
      if (this.creakIn <= 0) {
        this.creakIn = 0.5 + Math.random() * 2.2;
        this.creak(0.02 + rattle * 0.05);
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

  thud() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(90, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
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
