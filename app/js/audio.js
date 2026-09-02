// Fully synthesized audio: engine, wind, screech, nitro, one-shot SFX.
// No external audio files. AudioContext created/resumed on first user gesture.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._s01 = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this._build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  _noiseBuffer() {
    const c = this.ctx;
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(c.destination);
    const noise = this._noiseBuffer();
    this._noise = noise;

    // --- engine: saw + sub square through lowpass ---
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engFilter = c.createBiquadFilter();
    this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 420; this.engFilter.Q.value = 1.4;
    this.engOsc1 = c.createOscillator(); this.engOsc1.type = 'sawtooth'; this.engOsc1.frequency.value = 58;
    this.engOsc2 = c.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 29;
    const sub = c.createGain(); sub.gain.value = 0.6;
    this.engOsc1.connect(this.engFilter);
    this.engOsc2.connect(sub); sub.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.engOsc1.start(); this.engOsc2.start();

    // --- wind ---
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 720; wf.Q.value = 0.5;
    const ws = c.createBufferSource(); ws.buffer = noise; ws.loop = true;
    ws.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master); ws.start();

    // --- drift screech ---
    this.scrGain = c.createGain(); this.scrGain.gain.value = 0;
    const sf = c.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1850; sf.Q.value = 7;
    const ss = c.createBufferSource(); ss.buffer = noise; ss.loop = true; ss.playbackRate.value = 0.72;
    ss.connect(sf); sf.connect(this.scrGain); this.scrGain.connect(this.master); ss.start();

    // --- nitro whoosh (continuous while held) ---
    this.nitGain = c.createGain(); this.nitGain.gain.value = 0;
    this.nitFilter = c.createBiquadFilter(); this.nitFilter.type = 'bandpass'; this.nitFilter.frequency.value = 480; this.nitFilter.Q.value = 1.1;
    const ns = c.createBufferSource(); ns.buffer = noise; ns.loop = true; ns.playbackRate.value = 1.25;
    ns.connect(this.nitFilter); this.nitFilter.connect(this.nitGain); this.nitGain.connect(this.master); ns.start();
  }

  _t(param, v, tc = 0.06) {
    if (!this.ctx) return;
    param.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  // Continuous state -------------------------------------------------
  setEngine(on, s01, nitro) {
    if (!this.ctx) return;
    this._s01 = s01;
    const f = 52 + s01 * 150 + (nitro ? 26 : 0);
    this.engOsc1.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.05);
    this._t(this.engFilter.frequency, 320 + s01 * 1900 + (nitro ? 700 : 0));
    this._t(this.engGain.gain, on ? 0.085 + s01 * 0.075 : 0);
    this._t(this.windGain.gain, on ? s01 * s01 * 0.17 : 0, 0.15);
  }

  setDrift(on) {
    if (!this.ctx) return;
    this._t(this.scrGain.gain, on ? 0.10 + this._s01 * 0.05 : 0, on ? 0.05 : 0.12);
  }

  setNitro(on) {
    if (!this.ctx) return;
    this._t(this.nitGain.gain, on ? 0.20 : 0, on ? 0.04 : 0.2);
    this._t(this.nitFilter.frequency, on ? 2300 : 480, on ? 0.15 : 0.3);
  }

  // One-shots ---------------------------------------------------------
  _blip(fA, fB, dur, type = 'square', vol = 0.14) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(fA, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, fB), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  _noiseBurst(dur, fA, fB, vol, type = 'bandpass', q = 1) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this._noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(fA, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, fB), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  }

  coin()      { this._blip(940, 1580, 0.13, 'square', 0.10); }
  nitroPickup() { this._blip(320, 980, 0.28, 'sawtooth', 0.12); }
  ui()        { this._blip(520, 840, 0.07, 'triangle', 0.10); }
  jump()      { this._noiseBurst(0.25, 300, 1400, 0.16, 'bandpass', 1.2); }
  land()      { this._blip(110, 46, 0.16, 'sine', 0.30); this._noiseBurst(0.12, 500, 150, 0.12, 'lowpass'); }
  nearMiss()  { this._noiseBurst(0.30, 2600, 420, 0.22, 'bandpass', 2.0); }
  driftTick() { this._blip(660, 990, 0.09, 'triangle', 0.09); }
  crash() {
    this._noiseBurst(0.55, 3000, 120, 0.5, 'lowpass');
    this._blip(130, 34, 0.5, 'sine', 0.5);
    this._blip(90, 28, 0.65, 'triangle', 0.35);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this._t(this.master.gain, this.muted ? 0 : 0.85, 0.02);
    return this.muted;
  }
}
