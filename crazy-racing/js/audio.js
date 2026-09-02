// Fully synthesized audio: engine (per-car profile), wind, screech, nitro,
// one-shot SFX, and a tiny step-sequenced synth soundtrack per theme.
// No external audio files. AudioContext created/resumed on first gesture.

const MUSIC = {
  sunset:  { bpm: 112, bassType: 'triangle', arpType: 'sawtooth', cutoff: 1400, bass: [45, 45, 52, 50, 45, 45, 48, 50], arp: [69, 71, 76, 81, 76, 71, 69, 74], arpVol: 0.045, bassVol: 0.07 },
  neon:    { bpm: 124, bassType: 'sawtooth', arpType: 'square',   cutoff: 900,  bass: [40, 40, 40, 43, 38, 38, 38, 41], arp: [64, 67, 71, 76, 71, 67, 64, 62], arpVol: 0.04, bassVol: 0.08 },
  arctic:  { bpm: 92,  bassType: 'sine',     arpType: 'triangle', cutoff: 2400, bass: [43, 43, 50, 43, 41, 41, 48, 41], arp: [74, 79, 81, 86, 81, 79, 74, 77], arpVol: 0.05, bassVol: 0.06 },
  inferno: { bpm: 144, bassType: 'sawtooth', arpType: 'sawtooth', cutoff: 700,  bass: [36, 36, 39, 36, 41, 36, 39, 42], arp: [60, 63, 67, 63, 60, 66, 63, 60], arpVol: 0.04, bassVol: 0.09 },
  lunar:   { bpm: 76,  bassType: 'sine',     arpType: 'sine',     cutoff: 3000, bass: [43, 0, 0, 0, 38, 0, 0, 0], arp: [67, 74, 79, 86, 0, 79, 74, 0], arpVol: 0.06, bassVol: 0.07 },
  candy:   { bpm: 150, bassType: 'square',   arpType: 'square',   cutoff: 1800, bass: [48, 55, 52, 55, 53, 55, 50, 55], arp: [72, 76, 79, 84, 79, 76, 72, 74], arpVol: 0.035, bassVol: 0.06 },
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._s01 = 0;
    this.engineProfile = { base: 58, type: 'sawtooth' };
    this.musicProfile = null;
    this.musicOn = false;
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

    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engFilter = c.createBiquadFilter();
    this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 420; this.engFilter.Q.value = 1.4;
    this.engOsc1 = c.createOscillator(); this.engOsc1.type = this.engineProfile.type; this.engOsc1.frequency.value = 58;
    this.engOsc2 = c.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 29;
    const sub = c.createGain(); sub.gain.value = 0.6;
    this.engOsc1.connect(this.engFilter);
    this.engOsc2.connect(sub); sub.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.engOsc1.start(); this.engOsc2.start();

    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 720; wf.Q.value = 0.5;
    const ws = c.createBufferSource(); ws.buffer = noise; ws.loop = true;
    ws.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master); ws.start();

    this.scrGain = c.createGain(); this.scrGain.gain.value = 0;
    const sf = c.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 1850; sf.Q.value = 7;
    const ss = c.createBufferSource(); ss.buffer = noise; ss.loop = true; ss.playbackRate.value = 0.72;
    ss.connect(sf); sf.connect(this.scrGain); this.scrGain.connect(this.master); ss.start();

    this.nitGain = c.createGain(); this.nitGain.gain.value = 0;
    this.nitFilter = c.createBiquadFilter(); this.nitFilter.type = 'bandpass'; this.nitFilter.frequency.value = 480; this.nitFilter.Q.value = 1.1;
    const ns = c.createBufferSource(); ns.buffer = noise; ns.loop = true; ns.playbackRate.value = 1.25;
    ns.connect(this.nitFilter); this.nitFilter.connect(this.nitGain); this.nitGain.connect(this.master); ns.start();

    // slow-mo: a resonant lowpass on the music bus + pitch drop handled by playbackRate
    this.musicGain = c.createGain(); this.musicGain.gain.value = 0;
    this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 1400; this.musicFilter.Q.value = 0.8;
    this.musicFilter.connect(this.musicGain); this.musicGain.connect(this.master);
    this._musicStep = 0;
    this._musicNext = 0;
    this._musicTimer = setInterval(() => this._musicTick(), 40);
  }

  _t(param, v, tc = 0.06) {
    if (!this.ctx) return;
    param.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  // Engine ------------------------------------------------------------
  setEngineProfile(p) {
    this.engineProfile = p;
    if (this.ctx) this.engOsc1.type = p.type;
  }

  setEngine(on, s01, nitro) {
    if (!this.ctx) return;
    this._s01 = s01;
    const base = this.engineProfile.base;
    const f = base * 0.9 + s01 * base * 2.6 + (nitro ? 26 : 0);
    this.engOsc1.frequency.setTargetAtTime(f * this.pitchMult, this.ctx.currentTime, 0.05);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5 * this.pitchMult, this.ctx.currentTime, 0.05);
    this._t(this.engFilter.frequency, 320 + s01 * 1900 + (nitro ? 700 : 0));
    this._t(this.engGain.gain, on ? 0.085 + s01 * 0.075 : 0);
    this._t(this.windGain.gain, on ? s01 * s01 * 0.17 : 0, 0.15);
  }
  get pitchMult() { return this._pitch || 1; }
  setSlowMo(on) {
    this._pitch = on ? 0.55 : 1;
    if (this.ctx) this._t(this.musicFilter.frequency, on ? 320 : (this.musicProfile ? this.musicProfile.cutoff : 1400), 0.15);
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

  // Music -------------------------------------------------------------
  setMusic(profileName) {
    this.musicProfile = MUSIC[profileName] || null;
    if (this.ctx && this.musicProfile) this._t(this.musicFilter.frequency, this.musicProfile.cutoff, 0.3);
  }
  startMusic() { this.musicOn = true; if (this.ctx) { this._musicNext = this.ctx.currentTime + 0.05; this._t(this.musicGain.gain, 1, 0.4); } }
  stopMusic() { this.musicOn = false; if (this.ctx) this._t(this.musicGain.gain, 0, 0.5); }

  _musicTick() {
    if (!this.ctx || !this.musicOn || !this.musicProfile) return;
    const c = this.ctx, p = this.musicProfile;
    const stepDur = 60 / p.bpm / 2; // 8th notes
    while (this._musicNext < c.currentTime + 0.12) {
      const t = this._musicNext, i = this._musicStep % 8;
      const bassN = p.bass[i], arpN = p.arp[(this._musicStep + (this._musicStep >> 4)) % 8];
      if (bassN) this._note(midi(bassN), t, stepDur * 0.9, p.bassType, p.bassVol);
      if (arpN) this._note(midi(arpN) * (this._musicStep % 32 >= 16 ? 1.5 : 1), t, stepDur * 0.5, p.arpType, p.arpVol);
      if (i % 2 === 0) this._kick(t, i % 4 === 0 ? 0.16 : 0.08);
      if (i % 4 === 2) this._hat(t);
      this._musicNext += stepDur;
      this._musicStep++;
    }
  }
  _note(freq, t, dur, type, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq * this.pitchMult;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicFilter);
    o.start(t); o.stop(t + dur + 0.02);
  }
  _kick(t, vol) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.2);
  }
  _hat(t) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this._noise;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = c.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(t); s.stop(t + 0.06);
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

  _arp(notes, dur, type, vol) {
    if (!this.ctx) return;
    const c = this.ctx;
    notes.forEach((n, i) => {
      const t = c.currentTime + i * dur;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = midi(n);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.6);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + dur * 1.7);
    });
  }

  coin()        { this._blip(940, 1580, 0.13, 'square', 0.10); }
  nitroPickup() { this._blip(320, 980, 0.28, 'sawtooth', 0.12); }
  ui()          { this._blip(520, 840, 0.07, 'triangle', 0.10); }
  nav()         { this._blip(380, 520, 0.05, 'square', 0.06); }
  jump()        { this._noiseBurst(0.25, 300, 1400, 0.16, 'bandpass', 1.2); }
  land()        { this._blip(110, 46, 0.16, 'sine', 0.30); this._noiseBurst(0.12, 500, 150, 0.12, 'lowpass'); }
  nearMiss()    { this._noiseBurst(0.30, 2600, 420, 0.22, 'bandpass', 2.0); }
  driftTick()   { this._blip(660, 990, 0.09, 'triangle', 0.09); }
  cone()        { this._blip(240, 120, 0.09, 'square', 0.12); this._noiseBurst(0.08, 1200, 400, 0.1, 'bandpass', 2); }
  oil()         { this._noiseBurst(0.5, 2200, 900, 0.18, 'bandpass', 4); }
  powerup()     { this._arp([72, 76, 79, 84], 0.07, 'square', 0.12); }
  shieldHit()   { this._blip(1200, 300, 0.25, 'sine', 0.3); this._noiseBurst(0.2, 3000, 800, 0.15, 'bandpass', 3); }
  shieldUp()    { this._arp([60, 67, 72, 79], 0.06, 'sine', 0.14); }
  rocket()      { this._noiseBurst(0.6, 400, 3000, 0.22, 'bandpass', 1.5); this._blip(200, 900, 0.5, 'sawtooth', 0.08); }
  giantUp()     { this._arp([48, 52, 55, 60, 64, 67, 72], 0.06, 'sawtooth', 0.12); }
  stomp()       { this._blip(90, 30, 0.3, 'sine', 0.45); this._noiseBurst(0.25, 400, 80, 0.3, 'lowpass'); }
  slowIn()      { this._blip(900, 120, 0.6, 'sine', 0.2); }
  slowOut()     { this._blip(120, 900, 0.4, 'sine', 0.2); }
  ghost()       { this._arp([79, 76, 72, 67], 0.09, 'triangle', 0.1); }
  themeShift()  { this._arp([60, 64, 67, 72, 76, 79, 84, 88], 0.045, 'square', 0.1); this._noiseBurst(0.7, 200, 5000, 0.2, 'bandpass', 0.8); }
  coinRain()    { this._arp([84, 88, 91, 96, 91, 88, 84, 79], 0.05, 'square', 0.09); }
  crush()       { this._noiseBurst(0.3, 900, 120, 0.35, 'lowpass'); this._blip(160, 50, 0.3, 'square', 0.25); }
  explosion() {
    this._noiseBurst(0.7, 2500, 60, 0.6, 'lowpass');
    this._blip(120, 24, 0.7, 'sine', 0.5);
    this._noiseBurst(0.35, 4000, 1000, 0.25, 'bandpass', 0.7);
  }
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
