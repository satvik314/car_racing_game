import * as THREE from 'three';
import { CFG } from './config.js';
import { THEMES } from './themes.js';

// World: themed sky dome (sun, stars, aurora), lights, scrolling road,
// ground, ocean/lava, sky objects (planets/moon), recycled procedural
// scenery pools per theme, ambient weather particles, roadside posts,
// speed lines and skid marks. setTheme() swaps everything at runtime.

const R = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ---------------------------------------------------------------- sky
const SKY_VSH = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;
}`;

const SKY_FSH = `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uStars;
uniform float uAurora;
uniform float uSunDisc;
uniform float uTime;
varying vec3 vDir;
float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uZenith, smoothstep(0.18, 0.75, h));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 220.0) * 1.4 + pow(s, 18.0) * 0.35 + pow(s, 3.0) * 0.12);
  if (uSunDisc > 0.0) {
    // big retro sun with scanline bands
    float disc = smoothstep(0.9965, 0.9975, s);
    float bands = step(0.5, fract((d.y + 0.02) * 60.0 + uTime * 0.2));
    float bandMask = mix(1.0, bands, step(d.y, 0.06));
    col = mix(col, uSunColor * 1.6, disc * bandMask * uSunDisc);
  }
  if (uStars > 0.0 && d.y > 0.0) {
    vec3 sc = d * 90.0;
    vec3 cell = floor(sc);
    vec3 f = fract(sc);
    float hh = hash(cell);
    vec3 off = vec3(hash(cell + 1.7), hash(cell + 3.1), hash(cell + 5.3));
    float dd = length(f - off);
    float tw = 0.65 + 0.35 * sin(uTime * 2.0 + hh * 60.0);
    float star = smoothstep(0.16, 0.0, dd) * step(0.955, hh) * tw;
    col += vec3(star) * uStars * smoothstep(0.0, 0.15, d.y);
  }
  if (uAurora > 0.0) {
    float band = sin(d.x * 5.0 + uTime * 0.35) * 0.5 + 0.5;
    float band2 = sin(d.x * 11.0 - uTime * 0.5 + d.z * 3.0) * 0.5 + 0.5;
    float y = smoothstep(0.08, 0.3, h) * smoothstep(0.75, 0.35, h);
    vec3 ac = mix(vec3(0.15, 0.95, 0.55), vec3(0.5, 0.3, 0.9), band2);
    col += ac * band * y * uAurora * 0.55 * (0.6 + 0.4 * band2);
  }
  if (d.y < 0.0) col = mix(col, uHorizon * 0.92, clamp(-d.y * 6.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- textures
function makeRoadTexture(road) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = road.asphalt; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.10)' : road.noise;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const px = (wx) => ((wx + CFG.roadWidth / 2) / CFG.roadWidth) * 256;
  x.fillStyle = road.edge;
  x.fillRect(px(-7.4), 0, 3, 256);
  x.fillRect(px(7.4), 0, 3, 256);
  x.fillStyle = road.dash;
  for (const bx of [-3.5, 0, 3.5]) {
    for (let yPos = 0; yPos < 256; yPos += 42) x.fillRect(px(bx) - 1.5, yPos, 3, 24);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 20);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeGroundTexture(ground) {
  if (!ground.grid && !ground.checker && !ground.lavaCracks) return null;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  const base = '#' + ground.color.toString(16).padStart(6, '0');
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  if (ground.grid) {
    x.strokeStyle = ground.grid; x.lineWidth = 3;
    for (let i = 0; i <= 256; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  } else if (ground.checker) {
    x.fillStyle = ground.checker;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64);
  } else if (ground.lavaCracks) {
    x.strokeStyle = '#ff6a10'; x.lineWidth = 3; x.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      let px = Math.random() * 256, py = Math.random() * 256;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += R(-40, 40); py += R(-40, 40); x.lineTo(px, py); }
      x.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ground.grid ? 40 : 16, ground.grid ? 50 : 20);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeTextTexture(text, bg, fg, w = 256, h = 128, font = 'bold 30px monospace') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
  x.fillStyle = fg; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  const words = text.split(' ');
  if (words.length > 1) { x.fillText(words[0], w / 2, h * 0.36); x.fillText(words.slice(1).join(' '), w / 2, h * 0.66); }
  else x.fillText(text, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeWindowTexture(bg, lit, dark, prob = 0.55) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 128, 256);
  for (let yy = 14; yy < 240; yy += 26) {
    for (let xx = 12; xx < 112; xx += 24) {
      x.fillStyle = Math.random() < prob ? pick(lit) : dark;
      x.fillRect(xx, yy, 14, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makePlanetTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  if (kind === 'earth') {
    x.fillStyle = '#2d6fc4'; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 12; i++) {
      x.fillStyle = pick(['#3f9a4a', '#5aa85a', '#8a9a4a']);
      x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 128, R(14, 40), R(8, 26), R(0, 3), 0, Math.PI * 2); x.fill();
    }
    for (let i = 0; i < 18; i++) {
      x.fillStyle = 'rgba(255,255,255,0.7)';
      x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 128, R(10, 30), R(3, 7), R(0, 3), 0, Math.PI * 2); x.fill();
    }
  } else if (kind === 'moon') {
    x.fillStyle = '#e8d8f0'; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 30; i++) {
      x.fillStyle = 'rgba(120,90,140,0.35)';
      x.beginPath(); x.arc(Math.random() * 256, Math.random() * 128, R(3, 14), 0, Math.PI * 2); x.fill();
    }
  } else {
    x.fillStyle = '#d8b070'; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 10; i++) { x.fillStyle = pick(['#c89a58', '#e8c890', '#b88a50']); x.fillRect(0, i * 13, 256, R(3, 9)); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- scenery factories
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o });
const GLOW = (color, i = 1.2) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.5 });
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }

const F = {};

// ---- sunset
F.cactus = () => {
  const g = new THREE.Group();
  const mat = M(0x5f7a4e);
  const h = R(1.6, 3.2);
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.28, h, 7), mat, 0, h / 2, 0));
  const arms = 1 + ((Math.random() * 2) | 0);
  for (let i = 0; i < arms; i++) {
    const side = i === 0 ? 1 : -1;
    const ay = h * R(0.4, 0.65);
    const horiz = mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.7, 6), mat, side * 0.42, ay, 0);
    horiz.rotation.z = Math.PI / 2; g.add(horiz);
    g.add(mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.8, 6), mat, side * 0.72, ay + 0.38, 0));
  }
  return g;
};
F.palm = () => {
  const g = new THREE.Group();
  const trunkMat = M(0x8a6a4c, { roughness: 0.95 });
  const leafMat = M(0x6f8148, { roughness: 0.85, side: THREE.DoubleSide });
  const h = R(3.2, 4.6), segs = 4, lean = R(-0.25, 0.25);
  let px = 0;
  for (let i = 0; i < segs; i++) {
    const sh = h / segs;
    const s = mesh(new THREE.CylinderGeometry(0.14 * (1 - i * 0.14), 0.16 * (1 - i * 0.14), sh, 6), trunkMat, px, sh * (i + 0.5), 0);
    s.rotation.z = lean * (i / segs);
    px -= Math.sin(lean * (i / segs)) * sh;
    g.add(s);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const f = mesh(new THREE.ConeGeometry(0.28, 2.2, 3), leafMat, px + Math.cos(a) * 0.8, h + 0.1, Math.sin(a) * 0.8);
    f.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25);
    g.add(f);
  }
  return g;
};
F.rock = (colors = [0x8a6f5c, 0x7a6152, 0x95765e]) => {
  const m = mesh(new THREE.DodecahedronGeometry(R(0.5, 1.4), 0), M(pick(colors), { roughness: 1, flatShading: true }));
  m.scale.y = R(0.5, 0.8); m.position.y = m.scale.y * 0.5; m.rotation.y = R(0, Math.PI);
  return m;
};
F.dune = (color = 0xc98d63) => {
  const m = mesh(new THREE.SphereGeometry(R(14, 30), 10, 7), M(color, { roughness: 1 }));
  m.scale.y = R(0.14, 0.24); m.position.y = -1;
  return m;
};
F.mountain = (colors = [0x7a5648, 0x6e4c42, 0x855f4c], cap = null) => {
  const g = new THREE.Group();
  const h = R(26, 52), r = R(22, 40);
  const m = mesh(new THREE.ConeGeometry(r, h, 5), M(pick(colors), { roughness: 1, flatShading: true }), 0, h * 0.32, 0);
  m.rotation.y = R(0, Math.PI); g.add(m);
  if (cap) {
    const c = mesh(new THREE.ConeGeometry(r * 0.32, h * 0.32, 5), M(cap, { roughness: 1, flatShading: true }), 0, h * 0.32 + h * 0.34 + 0.05, 0);
    c.rotation.y = m.rotation.y; g.add(c);
  }
  return g;
};
const BILLBOARD_ADS = [
  ['SUNSET OVERDRIVE', '#3a2530', '#f4a261'], ['NITRO COLA', '#703626', '#ffe0b0'], ['ROUTE 77', '#2f2a28', '#e9c46a'],
  ['DRIFT KING', '#54383e', '#f7d6c4'], ['MOTEL VACANCY', '#4a3b2f', '#ffd9a0'], ['BUILD FAST', '#2a2a3a', '#ffd166'],
];
F.billboard = (ads = BILLBOARD_ADS, emissive = false) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.4, 6), M(0x4a4038), 0, 3.2, 0));
  const [text, bg, fg] = pick(ads);
  const tex = makeTextTexture(text, bg, fg);
  const face = emissive ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshBasicMaterial({ map: tex });
  const side = M(0x3a302a);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.2, 0.2), [side, side, side, side, face, face]);
  panel.position.y = 7.6; g.add(panel);
  return g;
};
F.building = () => {
  const w = R(6, 11), h = R(8, 22), d = R(6, 10);
  const m = mesh(new THREE.BoxGeometry(w, h, d), M(0x5c4a44, { map: makeWindowTexture('#5c4a44', ['#f7c873'], '#3a2f2c'), roughness: 0.95 }), 0, h / 2, 0);
  return m;
};

// ---- neon
const NEON = [0x25f0ff, 0xff3fc0, 0xb04fff, 0x4fff9f, 0xffe04f];
F.neonTower = () => {
  const g = new THREE.Group();
  const w = R(5, 10), h = R(14, 48), d = R(5, 10);
  const c = pick(NEON);
  const hex = '#' + c.toString(16).padStart(6, '0');
  const tex = makeWindowTexture('#0a0714', [hex, '#ffffff', hex], '#05030a', 0.35);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a1428, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.6 });
  g.add(mesh(new THREE.BoxGeometry(w, h, d), mat, 0, h / 2, 0));
  // neon edge strips
  const strip = GLOW(c, 2.0);
  g.add(mesh(new THREE.BoxGeometry(w + 0.2, 0.25, 0.25), strip, 0, h, d / 2));
  g.add(mesh(new THREE.BoxGeometry(0.25, h, 0.25), strip, w / 2, h / 2, d / 2));
  g.add(mesh(new THREE.BoxGeometry(0.25, h, 0.25), strip, -w / 2, h / 2, d / 2));
  if (Math.random() < 0.5) g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, R(3, 8), 5), GLOW(0xff3fc0, 2), 0, h + 3, 0));
  return g;
};
const NEON_ADS = [
  ['SYNTH WAVE', '#0a0418', '#ff3fc0'], ['NEON CITY', '#05030a', '#25f0ff'], ['RUN 2099', '#12041e', '#b04fff'],
  ['LIVE FAST', '#0a0418', '#4fff9f'], ['NO SLEEP', '#05030a', '#ffe04f'], ['BUILD FAST AI', '#0a0418', '#25f0ff'],
];
F.neonSign = () => {
  const g = F.billboard(NEON_ADS, true);
  const c = pick(NEON);
  g.add(mesh(new THREE.BoxGeometry(6.8, 0.2, 0.3), GLOW(c, 2.2), 0, 9.3, 0));
  g.add(mesh(new THREE.BoxGeometry(6.8, 0.2, 0.3), GLOW(c, 2.2), 0, 5.9, 0));
  return g;
};
F.hologram = () => {
  const g = new THREE.Group();
  const c = pick(NEON);
  const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const h = R(5, 9);
  g.add(mesh(new THREE.CylinderGeometry(R(1.2, 2.4), R(1.2, 2.4), h, 12, 1, true), mat, 0, h / 2 + 3, 0));
  g.add(mesh(new THREE.OctahedronGeometry(1.2, 0), mat, 0, h / 2 + 3, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.5, 3, 8), M(0x1a1428), 0, 1.5, 0));
  g.userData.spin = R(0.6, 1.6);
  return g;
};

// ---- arctic
F.pine = () => {
  const g = new THREE.Group();
  const h = R(3, 7);
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.25, h * 0.4, 6), M(0x4a3a2a), 0, h * 0.2, 0));
  const green = M(0x2f5a3f), snow = M(0xf0f6ff, { roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const r = (1.6 - i * 0.4) * (h / 5), ch = h * 0.32;
    const y = h * 0.3 + i * ch * 0.75;
    g.add(mesh(new THREE.ConeGeometry(r, ch, 7), green, 0, y, 0));
    g.add(mesh(new THREE.ConeGeometry(r * 0.85, ch * 0.35, 7), snow, 0, y + ch * 0.35, 0));
  }
  return g;
};
F.snowRock = () => F.rock([0xd8e2ea, 0xb8c8d4, 0x9fb0c0]);
F.iceCrystal = () => {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x2fb8e8, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85 });
  const n = 2 + ((Math.random() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const h = R(1.5, 4);
    const c = mesh(new THREE.OctahedronGeometry(R(0.3, 0.6), 0), mat, R(-0.8, 0.8), h * 0.5, R(-0.8, 0.8));
    c.scale.y = h * 1.6; c.rotation.set(R(-0.3, 0.3), R(0, 3), R(-0.3, 0.3));
    g.add(c);
  }
  return g;
};
F.snowMound = () => F.dune(0xeef4fa);
F.iceberg = () => F.mountain([0xbcd4e4, 0xa8c4d8, 0xcfe0ec], 0xffffff);
F.igloo = () => {
  const g = new THREE.Group();
  const white = M(0xf4f8ff, { roughness: 1, flatShading: true });
  g.add(mesh(new THREE.SphereGeometry(2.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, 0, 0, 0));
  const t = mesh(new THREE.CylinderGeometry(0.9, 0.9, 2, 10, 1, false, 0, Math.PI), white, 0, 0, 2.6);
  t.rotation.x = Math.PI / 2; t.rotation.z = Math.PI; g.add(t);
  return g;
};

// ---- inferno
F.obsidian = () => F.rock([0x1a1416, 0x241a1c, 0x2e2224]);
F.lavaPool = () => {
  const g = new THREE.Group();
  const r = R(2, 6);
  const pool = mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: 0xff6a10 }), 0, 0.02, 0);
  pool.rotation.x = -Math.PI / 2; g.add(pool);
  const ring = mesh(new THREE.RingGeometry(r, r + 0.8, 14), M(0x2a1410, { flatShading: true }), 0, 0.03, 0);
  ring.rotation.x = -Math.PI / 2; g.add(ring);
  g.userData.pulse = R(1, 3);
  return g;
};
F.volcano = () => {
  const g = F.mountain([0x2a1a18, 0x3a2220, 0x1e1412]);
  const h = g.children[0].geometry.parameters.height, r = g.children[0].geometry.parameters.radius;
  g.add(mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.22, 2, 8), GLOW(0xff6a10, 2.5), 0, h * 0.32 + h * 0.5, 0));
  const streak = mesh(new THREE.BoxGeometry(r * 0.12, h * 0.6, 0.6), GLOW(0xff8a20, 1.8), r * 0.25, h * 0.45, r * 0.62);
  streak.rotation.x = -0.65; g.add(streak);
  return g;
};
F.deadTree = () => {
  const g = new THREE.Group();
  const mat = M(0x140c0a);
  const h = R(3, 6);
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.3, h, 6), mat, 0, h / 2, 0));
  for (let i = 0; i < 3; i++) {
    const b = mesh(new THREE.CylinderGeometry(0.05, 0.1, h * 0.5, 5), mat, 0, h * R(0.5, 0.9), 0);
    b.rotation.set(R(-0.8, 0.8), R(0, 6), R(-0.8, 0.8));
    b.position.x += Math.sin(b.rotation.z) * 0.5;
    g.add(b);
  }
  return g;
};
F.skullPile = () => {
  const g = new THREE.Group();
  const bone = M(0xe8dcc0, { roughness: 1 });
  const n = 5 + ((Math.random() * 6) | 0);
  for (let i = 0; i < n; i++) {
    const s = mesh(new THREE.SphereGeometry(R(0.3, 0.5), 8, 6), bone, R(-1.2, 1.2), R(0.2, 1.1), R(-1.2, 1.2));
    s.scale.z = 1.15; g.add(s);
  }
  return g;
};
F.fireGeyser = () => {
  const g = new THREE.Group();
  const flame = new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const c = mesh(new THREE.ConeGeometry(0.9, R(4, 9), 7), flame, 0, 2.5, 0);
  g.add(c);
  g.add(mesh(new THREE.ConeGeometry(0.5, 3, 6), new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 1.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.4, 1.8, 0.6, 9), M(0x2a1a18, { flatShading: true }), 0, 0.3, 0));
  g.userData.pulse = R(4, 8);
  return g;
};

// ---- lunar
F.crater = () => {
  const r = R(2, 7);
  const m = mesh(new THREE.TorusGeometry(r, r * 0.25, 6, 16), M(0x6e6e78, { flatShading: true }), 0, -r * 0.12, 0);
  m.rotation.x = Math.PI / 2;
  return m;
};
F.moonRock = () => F.rock([0x8a8a94, 0x6e6e78, 0xa0a0aa]);
F.moonBase = () => {
  const g = new THREE.Group();
  const white = M(0xd8d8e0, { roughness: 0.6, metalness: 0.3 });
  const r = R(3, 6);
  g.add(mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(r * 1.4, 2.2, 3), white, r * 0.9, 1.1, 0));
  g.add(mesh(new THREE.BoxGeometry(r * 0.9, 0.6, 1.2), GLOW(0x8ff0ff, 1.6), r * 0.9, 1.4, 1.55));
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 6), M(0x9a9aa4), 0, r + 2, 0));
  g.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), GLOW(0xff3030, 2.5), 0, r + 4, 0));
  return g;
};
F.antenna = () => {
  const g = new THREE.Group();
  const h = R(6, 12);
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.25, h, 6), M(0x9a9aa4, { metalness: 0.5, roughness: 0.5 }), 0, h / 2, 0));
  const dish = mesh(new THREE.CylinderGeometry(2.0, 0.6, 0.6, 12, 1, true), M(0xe0e0e8, { side: THREE.DoubleSide, metalness: 0.4 }), 0.6, h, 0);
  dish.rotation.z = -0.9; g.add(dish);
  g.add(mesh(new THREE.SphereGeometry(0.18, 6, 5), GLOW(0xff3030, 2.5), 0, h + 0.4, 0));
  g.userData.blink = true;
  return g;
};
F.lander = () => {
  const g = new THREE.Group();
  const gold = M(0xd8b040, { metalness: 0.8, roughness: 0.3 });
  const grey = M(0xbbbbc4, { metalness: 0.5 });
  g.add(mesh(new THREE.BoxGeometry(2.6, 1.4, 2.6), gold, 0, 2.0, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.0, 1.2, 1.4, 8), grey, 0, 3.4, 0));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), grey, sx * 1.8, 1.0, sz * 1.8);
    leg.rotation.set(sz * 0.5, 0, -sx * 0.5); g.add(leg);
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8), grey, sx * 2.4, 0.05, sz * 2.4));
  }
  return g;
};
F.moonRidge = () => F.mountain([0x6e6e78, 0x808088, 0x5a5a64]);

// ---- candy
const PASTEL = [0xff5f8f, 0x7ad0ff, 0xffe066, 0x9dff8a, 0xc58bff, 0xffa64f, 0x66e6d4];
F.lollipop = () => {
  const g = new THREE.Group();
  const h = R(3, 6);
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, h, 6), M(0xffffff, { roughness: 0.5 }), 0, h / 2, 0));
  const c = pick(PASTEL);
  const disc = mesh(new THREE.CylinderGeometry(R(1, 1.8), R(1, 1.8), 0.3, 18), M(c, { roughness: 0.35, metalness: 0.1 }), 0, h + 1, 0);
  disc.rotation.x = Math.PI / 2; disc.rotation.z = R(0, 1); g.add(disc);
  const swirl = mesh(new THREE.TorusGeometry(disc.geometry.parameters.radiusTop * 0.6, 0.12, 6, 18), M(0xffffff), 0, h + 1, 0.16);
  g.add(swirl);
  return g;
};
F.gumdrop = () => {
  const m = mesh(new THREE.SphereGeometry(R(0.6, 1.6), 10, 8), M(pick(PASTEL), { roughness: 0.95 }));
  m.scale.y = 0.8; m.position.y = m.geometry.parameters.radius * 0.7;
  return m;
};
F.candyCane = () => {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#ff2040';
  for (let i = -64; i < 64; i += 24) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 12, 64); x.lineTo(i + 76, 0); x.lineTo(i + 64, 0); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 4); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
  const h = R(3, 6), r = R(0.25, 0.45);
  g.add(mesh(new THREE.CylinderGeometry(r, r, h, 10), mat, 0, h / 2, 0));
  const hook = mesh(new THREE.TorusGeometry(r * 3, r, 8, 12, Math.PI), mat, r * 3, h, 0);
  g.add(hook);
  return g;
};
F.donut = () => {
  const g = new THREE.Group();
  const r = R(1.2, 2.4);
  g.add(mesh(new THREE.TorusGeometry(r, r * 0.42, 10, 20), M(0xd8a060, { roughness: 0.8 }), 0, r * 1.45, 0));
  const icing = mesh(new THREE.TorusGeometry(r, r * 0.45, 10, 20, Math.PI), M(pick(PASTEL), { roughness: 0.4 }), 0, r * 1.45, 0.02);
  g.add(icing);
  g.userData.spin = R(0.3, 0.9);
  return g;
};
F.cupcake = () => {
  const g = new THREE.Group();
  const s = R(0.8, 1.6);
  g.add(mesh(new THREE.CylinderGeometry(s, s * 0.7, s * 1.2, 12), M(0xffe0f0, { roughness: 0.9 }), 0, s * 0.6, 0));
  g.add(mesh(new THREE.SphereGeometry(s * 0.95, 12, 8), M(pick(PASTEL), { roughness: 0.5 }), 0, s * 1.5, 0));
  g.add(mesh(new THREE.SphereGeometry(s * 0.6, 10, 6), M(pick(PASTEL), { roughness: 0.5 }), 0, s * 2.3, 0));
  g.add(mesh(new THREE.SphereGeometry(s * 0.2, 8, 6), M(0xe02040, { roughness: 0.3 }), 0, s * 2.95, 0));
  return g;
};
F.candyMountain = () => F.mountain([0xff9ecf, 0xffb8dc, 0xff7fb8], 0xffffff);
F.iceCreamTower = () => {
  const g = new THREE.Group();
  const h = R(10, 18);
  const cone = mesh(new THREE.ConeGeometry(3, h, 12), M(0xd8a060, { roughness: 0.9 }), 0, h / 2, 0);
  cone.rotation.x = Math.PI; g.add(cone);
  let y = h;
  for (let i = 0; i < 3; i++) { g.add(mesh(new THREE.SphereGeometry(3.2 - i * 0.5, 14, 10), M(pick(PASTEL), { roughness: 0.6 }), 0, y + 1.5, 0)); y += 3.6 - i * 0.6; }
  g.add(mesh(new THREE.SphereGeometry(0.6, 8, 6), M(0xe02040, { roughness: 0.3 }), 0, y + 1.2, 0));
  return g;
};

function makeOverpass(color) {
  const g = new THREE.Group();
  const mat = M(color, { roughness: 0.95 });
  g.add(mesh(new THREE.BoxGeometry(30, 1.1, 7), mat, 0, 6.2, 0));
  g.add(mesh(new THREE.BoxGeometry(30, 0.8, 0.3), mat, 0, 7.1, -3.3));
  g.add(mesh(new THREE.BoxGeometry(30, 0.8, 0.3), mat, 0, 7.1, 3.3));
  for (const px of [-10.5, 10.5]) g.add(mesh(new THREE.BoxGeometry(1.4, 6.2, 1.4), mat, px, 3.1, 0));
  return g;
}

function disposeObj(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { if (!m) continue; if (m.map) m.map.dispose(); if (m.emissiveMap) m.emissiveMap.dispose(); m.dispose(); }
    }
  });
}

// ---------------------------------------------------------------- ambient weather
class Ambient {
  constructor(scene) {
    this.scene = scene;
    this.obj = null;
    this.cfg = null;
  }
  set(cfg) {
    if (this.obj) { this.scene.remove(this.obj); this.obj.geometry.dispose(); this.obj.material.dispose(); this.obj = null; }
    this.cfg = cfg;
    if (!cfg) return;
    const n = cfg.count;
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n);
    for (let i = 0; i < n; i++) { this._spawn(i, true); }
    const geo = new THREE.BufferGeometry();
    if (cfg.stretch > 1) {
      // line segments for rain streaks
      this.lpos = new Float32Array(n * 6);
      geo.setAttribute('position', new THREE.BufferAttribute(this.lpos, 3).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.35, blending: cfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
      this.obj = new THREE.LineSegments(geo, mat);
    } else {
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const c = cfg.rainbow ? new THREE.Color().setHSL(Math.random(), 0.9, 0.65) : new THREE.Color(cfg.color);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (!Ambient.dot) {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const x = c.getContext('2d');
        const g = x.createRadialGradient(16, 16, 1, 16, 16, 16);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, 32, 32);
        Ambient.dot = new THREE.CanvasTexture(c);
      }
      const mat = new THREE.PointsMaterial({ size: cfg.size * 1.6, map: Ambient.dot, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true, blending: cfg.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false });
      this.obj = new THREE.Points(geo, mat);
    }
    this.obj.frustumCulled = false;
    this.scene.add(this.obj);
  }
  _spawn(i, anywhere) {
    const i3 = i * 3;
    this.pos[i3] = R(-45, 45);
    this.pos[i3 + 1] = anywhere ? R(0, 28) : (this.cfg.fall >= 0 ? R(20, 28) : R(-0.5, 1));
    this.pos[i3 + 2] = anywhere ? R(-130, 14) : R(-130, -10);
    this.vel[i] = R(0.7, 1.3);
  }
  update(dt, speed) {
    if (!this.obj) return;
    const c = this.cfg, n = this.n, p = this.pos;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      p[i3 + 1] -= c.fall * this.vel[i] * dt;
      p[i3] += (c.drift + Math.sin(p[i3 + 1] * 0.5 + i) * 0.6) * dt;
      p[i3 + 2] += speed * dt * (c.kind === 'stardust' ? 0.25 : 1);
      if (p[i3 + 1] < -1 || p[i3 + 1] > 30 || p[i3 + 2] > 16) this._spawn(i, false);
      if (this.lpos) {
        const l6 = i * 6;
        this.lpos[l6] = p[i3]; this.lpos[l6 + 1] = p[i3 + 1]; this.lpos[l6 + 2] = p[i3 + 2];
        this.lpos[l6 + 3] = p[i3] + c.drift * 0.02 * c.stretch; this.lpos[l6 + 4] = p[i3 + 1] + c.stretch * 0.25; this.lpos[l6 + 5] = p[i3 + 2] - speed * 0.02;
      }
    }
    this.obj.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- World
export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0;

    scene.fog = new THREE.Fog(0xe89a6a, 70, 430);

    this.hemi = new THREE.HemisphereLight(0xf7b98a, 0x8a5a44, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffb37a, 2.3);
    this.sun.position.set(-55, 42, -110);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -28; this.sun.shadow.camera.right = 28;
    this.sun.shadow.camera.top = 28; this.sun.shadow.camera.bottom = -28;
    this.sun.shadow.camera.near = 20; this.sun.shadow.camera.far = 260;
    this.sun.shadow.bias = -0.002;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VSH, fragmentShader: SKY_FSH,
      uniforms: {
        uZenith: { value: new THREE.Color(0x8d5a6b) },
        uMid: { value: new THREE.Color(0xd98273) },
        uHorizon: { value: new THREE.Color(0xf7a55e) },
        uSunDir: { value: new THREE.Vector3(-0.42, 0.24, -0.88) },
        uSunColor: { value: new THREE.Color(0xffd9a0) },
        uStars: { value: 0 }, uAurora: { value: 0 }, uSunDisc: { value: 0 }, uTime: { value: 0 },
      },
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 14), this.skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    // road
    this.roadMat = new THREE.MeshStandardMaterial({ roughness: 0.94 });
    const road = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, 460), this.roadMat);
    road.rotation.x = -Math.PI / 2; road.position.z = -190; road.receiveShadow = true;
    scene.add(road);
    this.shoulderMat = new THREE.MeshStandardMaterial({ color: 0xb98a62, roughness: 1 });
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(4, 460), this.shoulderMat);
      sh.rotation.x = -Math.PI / 2; sh.position.set(sx * (CFG.roadWidth / 2 + 2), -0.02, -190);
      scene.add(sh);
    }
    this.groundMat = new THREE.MeshStandardMaterial({ color: 0xc98a5f, roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 900), this.groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.set(-60, -0.35, -260);
    scene.add(ground);
    this.groundTex = null;

    this.oceanMat = new THREE.MeshBasicMaterial({ color: 0xd97a4e });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(560, 900), this.oceanMat);
    this.ocean.rotation.x = -Math.PI / 2; this.ocean.position.set(340, -2.2, -260);
    scene.add(this.ocean);
    this.glintMat = new THREE.MeshBasicMaterial({ color: 0xf7b06a, transparent: true, opacity: 0.6 });
    this.glint = new THREE.Mesh(new THREE.PlaneGeometry(70, 900), this.glintMat);
    this.glint.rotation.x = -Math.PI / 2; this.glint.position.set(120, -2.1, -260);
    scene.add(this.glint);

    this.items = [];
    this.overpasses = [];
    this.skyObjects = [];
    this.ambient = new Ambient(scene);

    // roadside posts (instanced)
    this.postCount = 56;
    this.postData = new Float32Array(this.postCount * 2);
    this.postMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.8 });
    this.stripeMat = new THREE.MeshStandardMaterial({ color: 0xc9402f, roughness: 0.8 });
    this.postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.9, 0.16), this.postMat, this.postCount);
    this.postStripeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), this.stripeMat, this.postCount);
    this.postMesh.frustumCulled = false; this.postStripeMesh.frustumCulled = false;
    for (let i = 0; i < this.postCount; i++) {
      this.postData[i * 2] = (i % 2 === 0 ? -1 : 1) * 8.6;
      this.postData[i * 2 + 1] = CFG.spawnZ + (i >> 1) * 17;
    }
    scene.add(this.postMesh, this.postStripeMesh);

    // speed lines
    this.lineCount = 44;
    this.lineData = new Float32Array(this.lineCount * 3);
    this.speedLineMat = new THREE.MeshBasicMaterial({ color: 0xfff2dd, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.lineMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.035, 2.4), this.speedLineMat, this.lineCount);
    this.lineMesh.frustumCulled = false;
    for (let i = 0; i < this.lineCount; i++) this._randLineIdx(i);
    scene.add(this.lineMesh);
    this._m4 = new THREE.Matrix4();

    // skid marks
    this.skids = []; this.skidHead = 0;
    const skidGeo = new THREE.PlaneGeometry(0.34, 1.4);
    const skidMat = new THREE.MeshBasicMaterial({ color: 0x241d1a, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 220; i++) {
      const m = new THREE.Mesh(skidGeo, skidMat);
      m.rotation.x = -Math.PI / 2; m.position.y = -999; m.visible = false; m.renderOrder = 1;
      scene.add(m); this.skids.push(m);
    }

    this.setTheme(THEMES[0]);
  }

  setTheme(theme) {
    this.theme = theme;
    const { sky, fog, hemi, sun } = theme;

    // sky + lights
    this.skyMat.uniforms.uZenith.value.set(sky.zenith);
    this.skyMat.uniforms.uMid.value.set(sky.mid);
    this.skyMat.uniforms.uHorizon.value.set(sky.horizon);
    this.skyMat.uniforms.uSunDir.value.set(...sky.sunDir);
    this.skyMat.uniforms.uSunColor.value.set(sky.sunColor);
    this.skyMat.uniforms.uStars.value = sky.stars || 0;
    this.skyMat.uniforms.uAurora.value = sky.aurora || 0;
    this.skyMat.uniforms.uSunDisc.value = sky.sunDisc || 0;
    this.scene.fog.color.set(fog.color); this.scene.fog.near = fog.near; this.scene.fog.far = fog.far;
    this.hemi.color.set(hemi.sky); this.hemi.groundColor.set(hemi.ground); this.hemi.intensity = hemi.intensity;
    this.sun.color.set(sun.color); this.sun.intensity = sun.intensity;
    this.sun.position.set(sky.sunDir[0] * 130, Math.max(30, sky.sunDir[1] * 180 + 30), sky.sunDir[2] * 130);
    if (this.renderer) this.renderer.toneMappingExposure = theme.exposure;

    // road / ground / ocean
    if (this.roadMat.map) this.roadMat.map.dispose();
    this.roadMat.map = makeRoadTexture(theme.road);
    this.roadMat.needsUpdate = true;
    this.shoulderMat.color.set(theme.shoulder);
    if (this.groundTex) { this.groundTex.dispose(); this.groundTex = null; }
    this.groundTex = makeGroundTexture(theme.ground);
    this.groundMat.color.set(this.groundTex ? 0xffffff : theme.ground.color);
    this.groundMat.map = this.groundTex;
    if (theme.ground.grid || theme.ground.lavaCracks) {
      this.groundMat.emissiveMap = this.groundTex;
      this.groundMat.emissive.set(theme.ground.lavaCracks ? 0xff5a10 : 0xff2fd0);
      this.groundMat.emissiveIntensity = theme.ground.lavaCracks ? 0.9 : 0.7;
    } else { this.groundMat.emissiveMap = null; this.groundMat.emissive.set(0x000000); }
    this.groundMat.needsUpdate = true;
    if (theme.ocean) {
      this.ocean.visible = true; this.glint.visible = true;
      this.oceanMat.color.set(theme.ocean.color); this.glintMat.color.set(theme.ocean.glint);
    } else { this.ocean.visible = false; this.glint.visible = false; }
    this.postMat.color.set(theme.posts.body); this.stripeMat.color.set(theme.posts.stripe);
    this.speedLineMat.color.set(theme.speedLine);

    // scenery
    for (const it of this.items) { this.scene.remove(it); disposeObj(it); }
    this.items = [];
    for (const [name, count, xRange, opts = {}] of theme.scenery) {
      const factory = F[name];
      if (!factory) continue;
      for (let i = 0; i < count; i++) {
        const m = factory();
        const side = Math.random() < 0.5 ? -1 : 1;
        m.position.x = side * R(xRange[0], xRange[1]);
        m.position.z = R(CFG.spawnZ, CFG.killZ);
        if (opts.rightOnly) m.position.x = Math.abs(m.position.x);
        if (opts.leftOnly) m.position.x = -Math.abs(m.position.x);
        if (opts.scale) m.scale.setScalar(R(opts.scale[0], opts.scale[1]));
        if (!theme.ocean && m.position.x > 0) m.position.x = Math.max(m.position.x, xRange[0]);
        m.userData.baseScale = m.scale.x;
        this.scene.add(m);
        this.items.push(m);
      }
    }
    for (const o of this.overpasses) { this.scene.remove(o); disposeObj(o); }
    this.overpasses = [];
    for (let i = 0; i < 2; i++) {
      const o = makeOverpass(theme.overpass);
      o.position.z = CFG.spawnZ - i * 240 - 100;
      this.scene.add(o); this.overpasses.push(o);
    }
    for (const s of this.skyObjects) { this.scene.remove(s); disposeObj(s); }
    this.skyObjects = [];
    for (const so of theme.skyObjects || []) {
      const g = new THREE.Group();
      const tex = makePlanetTexture(so.kind);
      const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false });
      g.add(new THREE.Mesh(new THREE.SphereGeometry(so.size, 24, 16), mat));
      if (so.kind === 'ringed') {
        const ring = new THREE.Mesh(new THREE.RingGeometry(so.size * 1.4, so.size * 2.2, 32), new THREE.MeshBasicMaterial({ color: 0xc8a870, side: THREE.DoubleSide, transparent: true, opacity: 0.8, fog: false }));
        ring.rotation.x = 1.2; g.add(ring);
      }
      g.position.set(...so.pos);
      g.userData.spin = 0.02;
      this.scene.add(g); this.skyObjects.push(g);
    }
    this.ambient.set(theme.ambient);
  }

  _randLineIdx(i) {
    const a = Math.random() * Math.PI * 2;
    const rad = R(7, 16);
    this.lineData[i * 3] = Math.cos(a) * rad;
    this.lineData[i * 3 + 1] = R(0.4, 5.2);
    this.lineData[i * 3 + 2] = R(-55, 5) + Math.sin(a) * 8;
  }

  addSkid(x, z) {
    const m = this.skids[this.skidHead];
    this.skidHead = (this.skidHead + 1) % this.skids.length;
    m.visible = true; m.position.set(x, 0.03, z);
  }

  update(dt, speed) {
    this.time += dt;
    this.skyMat.uniforms.uTime.value = this.time;
    this.roadMat.map.offset.y += (speed * dt) / 23;
    if (this.groundTex) this.groundTex.offset.y += (speed * dt) / (900 / this.groundTex.repeat.y);

    for (const it of this.items) {
      it.position.z += speed * dt;
      if (it.position.z > CFG.killZ + 20) {
        it.position.z -= CFG.worldLen + R(0, 30);
        it.rotation.y = R(0, Math.PI * 2);
      }
      const u = it.userData;
      if (u.spin) it.rotation.y += u.spin * dt;
      if (u.pulse) { const s = u.baseScale * (1 + Math.sin(this.time * u.pulse) * 0.12); it.scale.set(s, u.baseScale * (1 + Math.sin(this.time * u.pulse * 1.3) * 0.25), s); }
      if (u.blink) it.children[2].visible = Math.sin(this.time * 4) > 0;
    }
    for (const o of this.overpasses) {
      o.position.z += speed * dt;
      if (o.position.z > CFG.killZ + 30) o.position.z -= CFG.worldLen + R(180, 420);
    }
    for (const s of this.skyObjects) s.rotation.y += s.userData.spin * dt;

    for (let i = 0; i < this.postCount; i++) {
      let z = this.postData[i * 2 + 1] + speed * dt;
      if (z > CFG.killZ) z -= CFG.worldLen;
      this.postData[i * 2 + 1] = z;
      const x = this.postData[i * 2];
      this._m4.makeTranslation(x, 0.45, z); this.postMesh.setMatrixAt(i, this._m4);
      this._m4.makeTranslation(x, 0.82, z); this.postStripeMesh.setMatrixAt(i, this._m4);
    }
    this.postMesh.instanceMatrix.needsUpdate = true;
    this.postStripeMesh.instanceMatrix.needsUpdate = true;

    const lineSpeed = speed * 1.7;
    for (let i = 0; i < this.lineCount; i++) {
      let z = this.lineData[i * 3 + 2] + lineSpeed * dt;
      if (z > 12) { this._randLineIdx(i); z = this.lineData[i * 3 + 2]; }
      this.lineData[i * 3 + 2] = z;
      this._m4.makeTranslation(this.lineData[i * 3], this.lineData[i * 3 + 1], z);
      this.lineMesh.setMatrixAt(i, this._m4);
    }
    this.lineMesh.instanceMatrix.needsUpdate = true;
    this.speedLineMat.opacity = THREE.MathUtils.clamp((speed - 46) / 70, 0, 0.32);

    for (const s of this.skids) {
      if (!s.visible) continue;
      s.position.z += speed * dt;
      if (s.position.z > CFG.killZ) { s.visible = false; s.position.y = -999; }
    }
    this.ambient.update(dt, speed);
  }

  reset() {
    for (const s of this.skids) { s.visible = false; s.position.y = -999; }
  }
}
