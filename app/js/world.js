import * as THREE from 'three';
import { CFG } from './config.js';

// World: sunset sky dome, sun + lights, scrolling road, ground, ocean,
// recycled procedural scenery (cacti, palms, rocks, dunes, mountains,
// billboards, buildings, overpasses), roadside posts, speed lines, skid marks.

const R = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// ---------------------------------------------------------------- sky
const SKY_VSH = `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // pin to far plane
}`;

const SKY_FSH = `
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uZenith, smoothstep(0.18, 0.75, h));
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 220.0) * 1.4 + pow(s, 18.0) * 0.35 + pow(s, 3.0) * 0.12);
  if (d.y < 0.0) col = mix(col, uHorizon * 0.92, clamp(-d.y * 6.0, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- textures
function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#43383a'; x.fillRect(0, 0, 256, 256);
  // asphalt noise
  for (let i = 0; i < 900; i++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,220,190,0.05)';
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  const px = (wx) => ((wx + CFG.roadWidth / 2) / CFG.roadWidth) * 256;
  // edge lines (solid, warm cream)
  x.fillStyle = '#e8d9b0';
  x.fillRect(px(-7.4), 0, 3, 256);
  x.fillRect(px(7.4), 0, 3, 256);
  // lane dashes at lane boundaries -3.5, 0, 3.5
  x.fillStyle = '#d9c9a2';
  for (const bx of [-3.5, 0, 3.5]) {
    for (let yPos = 0; yPos < 256; yPos += 42) {
      x.fillRect(px(bx) - 1.5, yPos, 3, 24);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 20);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBillboardTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116);
  x.fillStyle = fg;
  x.font = 'bold 30px monospace';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const words = text.split(' ');
  if (words.length > 1) {
    x.fillText(words[0], 128, 46);
    x.fillText(words.slice(1).join(' '), 128, 84);
  } else {
    x.fillText(text, 128, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBuildingTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#5c4a44'; x.fillRect(0, 0, 128, 256);
  for (let yy = 14; yy < 240; yy += 26) {
    for (let xx = 12; xx < 112; xx += 24) {
      x.fillStyle = Math.random() < 0.55 ? '#f7c873' : '#3a2f2c';
      x.fillRect(xx, yy, 14, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- scenery factories
function makeCactus() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5f7a4e, roughness: 0.9 });
  const h = R(1.6, 3.2);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, h, 7), mat);
  trunk.position.y = h / 2; g.add(trunk);
  const arms = 1 + ((Math.random() * 2) | 0);
  for (let i = 0; i < arms; i++) {
    const side = i === 0 ? 1 : -1;
    const ay = h * R(0.4, 0.65);
    const horiz = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.7, 6), mat);
    horiz.rotation.z = Math.PI / 2; horiz.position.set(side * 0.42, ay, 0); g.add(horiz);
    const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.8, 6), mat);
    vert.position.set(side * 0.72, ay + 0.38, 0); g.add(vert);
  }
  return g;
}

function makePalm() {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4c, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x6f8148, roughness: 0.85, side: THREE.DoubleSide });
  const h = R(3.2, 4.6);
  const segs = 4;
  let px = 0;
  const lean = R(-0.25, 0.25);
  for (let i = 0; i < segs; i++) {
    const sh = h / segs;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * (1 - i * 0.14), 0.16 * (1 - i * 0.14), sh, 6), trunkMat);
    s.position.set(px, sh * (i + 0.5), 0);
    s.rotation.z = lean * (i / segs);
    px -= Math.sin(lean * (i / segs)) * sh;
    g.add(s);
  }
  const topX = px;
  const fronds = 6;
  for (let i = 0; i < fronds; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 3), leafMat);
    const a = (i / fronds) * Math.PI * 2;
    f.position.set(topX + Math.cos(a) * 0.8, h + 0.1, Math.sin(a) * 0.8);
    f.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25 + Math.PI * 0.0);
    f.rotation.z += Math.PI / 2 * 0; // keep droop from x/z rotation
    g.add(f);
  }
  return g;
}

function makeRock() {
  const mat = new THREE.MeshStandardMaterial({ color: pick([0x8a6f5c, 0x7a6152, 0x95765e]), roughness: 1, flatShading: true });
  const m = new THREE.Mesh(new THREE.DodecahedronGeometry(R(0.5, 1.4), 0), mat);
  m.scale.y = R(0.5, 0.8);
  m.position.y = m.scale.y * 0.5;
  m.rotation.y = R(0, Math.PI);
  return m;
}

function makeDune() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc98d63, roughness: 1 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(R(14, 30), 10, 7), mat);
  m.scale.y = R(0.14, 0.24);
  m.position.y = -1;
  return m;
}

function makeMountain() {
  const mat = new THREE.MeshStandardMaterial({ color: pick([0x7a5648, 0x6e4c42, 0x855f4c]), roughness: 1, flatShading: true });
  const m = new THREE.Mesh(new THREE.ConeGeometry(R(22, 40), R(26, 52), 5), mat);
  m.position.y = m.geometry.parameters.height * 0.32;
  m.rotation.y = R(0, Math.PI);
  return m;
}

const BILLBOARD_ADS = [
  ['SUNSET OVERDRIVE', '#3a2530', '#f4a261'],
  ['NITRO COLA', '#703626', '#ffe0b0'],
  ['ROUTE 77', '#2f2a28', '#e9c46a'],
  ['DRIFT KING', '#54383e', '#f7d6c4'],
  ['MOTEL VACANCY', '#4a3b2f', '#ffd9a0'],
];

function makeBillboard() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.4, 6), poleMat);
  pole.position.y = 3.2; g.add(pole);
  const [text, bg, fg] = pick(BILLBOARD_ADS);
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 3.2, 0.2),
    [null, null, null, null,
      new THREE.MeshBasicMaterial({ map: makeBillboardTexture(text, bg, fg) }),
      new THREE.MeshBasicMaterial({ map: makeBillboardTexture(text, bg, fg) })]
      .map((m, i) => m || new THREE.MeshStandardMaterial({ color: 0x3a302a, roughness: 0.9 }))
  );
  panel.position.y = 7.6;
  g.add(panel);
  return g;
}

function makeBuilding() {
  const tex = makeBuildingTexture();
  const w = R(6, 11), h = R(8, 22), d = R(6, 10);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = h / 2;
  return m;
}

function makeOverpass() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x9a7c62, roughness: 0.95 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 1.1, 7), mat);
  deck.position.y = 6.2; g.add(deck);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 0.3), mat);
  rail.position.set(0, 7.1, -3.3); g.add(rail);
  const rail2 = rail.clone(); rail2.position.z = 3.3; g.add(rail2);
  for (const px of [-10.5, 10.5]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6.2, 1.4), mat);
    p.position.set(px, 3.1, 0); g.add(p);
  }
  return g;
}

// ---------------------------------------------------------------- World
export class World {
  constructor(scene) {
    this.scene = scene;

    scene.fog = new THREE.Fog(0xe89a6a, 70, 430);

    // lights
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

    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VSH, fragmentShader: SKY_FSH,
      uniforms: {
        uZenith: { value: new THREE.Color(0x8d5a6b) },
        uMid: { value: new THREE.Color(0xd98273) },
        uHorizon: { value: new THREE.Color(0xf7a55e) },
        uSunDir: { value: new THREE.Vector3(-0.42, 0.24, -0.88) },
        uSunColor: { value: new THREE.Color(0xffd9a0) },
      },
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 14), this.skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    // road
    this.roadTex = makeRoadTexture();
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.roadWidth, 460),
      new THREE.MeshStandardMaterial({ map: this.roadTex, roughness: 0.94 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -190;
    road.receiveShadow = true;
    scene.add(road);
    // shoulders
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0xb98a62, roughness: 1 });
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(4, 460), shoulderMat);
      sh.rotation.x = -Math.PI / 2;
      sh.position.set(sx * (CFG.roadWidth / 2 + 2), -0.02, -190);
      scene.add(sh);
    }

    // sand ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 900),
      new THREE.MeshStandardMaterial({ color: 0xc98a5f, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-60, -0.35, -260);
    scene.add(ground);
    // ocean on the right
    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 900),
      new THREE.MeshBasicMaterial({ color: 0xd97a4e })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(340, -2.2, -260);
    scene.add(ocean);
    // ocean sun glint strip
    const glint = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 900),
      new THREE.MeshBasicMaterial({ color: 0xf7b06a, transparent: true, opacity: 0.6 })
    );
    glint.rotation.x = -Math.PI / 2;
    glint.position.set(120, -2.1, -260);
    scene.add(glint);

    // ---------------- scenery pools ----------------
    this.items = [];
    const addItems = (factory, count, xRange, opts = {}) => {
      for (let i = 0; i < count; i++) {
        const mesh = factory();
        const side = Math.random() < 0.5 ? -1 : 1;
        mesh.position.x = side * R(xRange[0], xRange[1]);
        mesh.position.z = R(CFG.spawnZ, CFG.killZ);
        if (opts.rightOnly) mesh.position.x = Math.abs(mesh.position.x);
        if (opts.leftOnly) mesh.position.x = -Math.abs(mesh.position.x);
        if (opts.scale) mesh.scale.setScalar(R(opts.scale[0], opts.scale[1]));
        this.scene.add(mesh);
        this.items.push(mesh);
      }
    };
    addItems(makeCactus, 26, [11, 42]);
    addItems(makePalm, 18, [11, 34]);
    addItems(makeRock, 18, [10, 50]);
    addItems(makeDune, 10, [60, 150], { leftOnly: true });
    addItems(makeMountain, 7, [120, 240], { leftOnly: true });
    addItems(makeBillboard, 5, [12, 15]);
    addItems(makeBuilding, 5, [26, 46]);

    // overpasses (separate small pool, spawn rarely, span the road)
    this.overpasses = [];
    for (let i = 0; i < 2; i++) {
      const o = makeOverpass();
      o.position.z = CFG.spawnZ - i * 240 - 100;
      this.scene.add(o);
      this.overpasses.push(o);
    }

    // roadside posts for speed feel (instanced: 2 draw calls total)
    this.postCount = 56;
    this.postData = new Float32Array(this.postCount * 3); // x, z pairs (y fixed)
    const postGeo = new THREE.BoxGeometry(0.16, 0.9, 0.16);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.8 });
    const stripeGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xc9402f, roughness: 0.8 });
    this.postMesh = new THREE.InstancedMesh(postGeo, postMat, this.postCount);
    this.postStripeMesh = new THREE.InstancedMesh(stripeGeo, stripeMat, this.postCount);
    this.postMesh.frustumCulled = false;
    this.postStripeMesh.frustumCulled = false;
    for (let i = 0; i < this.postCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.postData[i * 2] = side * 8.6;
      this.postData[i * 2 + 1] = CFG.spawnZ + (i >> 1) * 17;
    }
    this.scene.add(this.postMesh, this.postStripeMesh);

    // speed lines (instanced)
    this.lineCount = 44;
    this.lineData = new Float32Array(this.lineCount * 3);
    this.speedLineMat = new THREE.MeshBasicMaterial({ color: 0xfff2dd, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const lineGeo = new THREE.BoxGeometry(0.035, 0.035, 2.4);
    this.lineMesh = new THREE.InstancedMesh(lineGeo, this.speedLineMat, this.lineCount);
    this.lineMesh.frustumCulled = false;
    for (let i = 0; i < this.lineCount; i++) this._randLineIdx(i);
    this.scene.add(this.lineMesh);

    this._m4 = new THREE.Matrix4();

    // skid marks
    this.skids = [];
    this.skidHead = 0;
    const skidGeo = new THREE.PlaneGeometry(0.34, 1.4);
    const skidMat = new THREE.MeshBasicMaterial({ color: 0x241d1a, transparent: true, opacity: 0.5, depthWrite: false });
    for (let i = 0; i < 220; i++) {
      const m = new THREE.Mesh(skidGeo, skidMat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = -999;
      m.visible = false;
      m.renderOrder = 1;
      this.scene.add(m);
      this.skids.push(m);
    }
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
    m.visible = true;
    m.position.set(x, 0.03, z);
  }

  update(dt, speed) {
    // road scroll: plane is 460 long, texture repeats 20x -> one tile = 23 units
    this.roadTex.offset.y += (speed * dt) / 23;

    for (const it of this.items) {
      it.position.z += speed * dt;
      if (it.position.z > CFG.killZ + 20) {
        it.position.z -= CFG.worldLen + R(0, 30);
        it.rotation.y = R(0, Math.PI * 2);
      }
    }
    for (const o of this.overpasses) {
      o.position.z += speed * dt;
      if (o.position.z > CFG.killZ + 30) o.position.z -= CFG.worldLen + R(180, 420);
    }
    for (let i = 0; i < this.postCount; i++) {
      let z = this.postData[i * 2 + 1] + speed * dt;
      if (z > CFG.killZ) z -= CFG.worldLen;
      this.postData[i * 2 + 1] = z;
      const x = this.postData[i * 2];
      this._m4.makeTranslation(x, 0.45, z);
      this.postMesh.setMatrixAt(i, this._m4);
      this._m4.makeTranslation(x, 0.82, z);
      this.postStripeMesh.setMatrixAt(i, this._m4);
    }
    this.postMesh.instanceMatrix.needsUpdate = true;
    this.postStripeMesh.instanceMatrix.needsUpdate = true;
    // speed lines whip past faster than world
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
    // skid marks scroll with world
    for (const s of this.skids) {
      if (!s.visible) continue;
      s.position.z += speed * dt;
      if (s.position.z > CFG.killZ) { s.visible = false; s.position.y = -999; }
    }
  }

  reset() {
    for (const s of this.skids) { s.visible = false; s.position.y = -999; }
  }
}
