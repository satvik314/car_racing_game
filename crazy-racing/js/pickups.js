import * as THREE from 'three';
import { CFG, POWERUPS } from './config.js';

// Pooled pickups & hazards: coins (magnet collect), nitro canisters, ramps,
// power-up crates, traffic cones (knockable), oil slicks (spin-out) and
// explosive barrels.

const R = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function makeCoin() {
  const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf7c948, metalness: 0.75, roughness: 0.25, emissive: 0xa8720e, emissiveIntensity: 0.5 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 8, 18), new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 0.8, roughness: 0.2, emissive: 0xc9920e, emissiveIntensity: 0.6 }));
  const g = new THREE.Group(); g.add(m); g.add(rim);
  return g;
}

function makeCanister() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 4, 10), new THREE.MeshStandardMaterial({ color: 0xe2602c, metalness: 0.5, roughness: 0.3, emissive: 0x8a2f08, emissiveIntensity: 0.5 }));
  body.position.y = 0.7;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0xf2e3c9, metalness: 0.6, roughness: 0.3 }));
  cap.position.y = 1.35;
  g.add(body); g.add(cap);
  return g;
}

function makeRamp() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(5.2, 0); shape.lineTo(5.2, 1.5); shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);
  geo.translate(-1.7, 0, 2.6);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a6a50, roughness: 0.85 })));
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#e9c46a'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#3a2f2a';
  for (let i = -64; i < 64; i += 20) { x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 20, 64); x.lineTo(i + 84, 0); x.lineTo(i + 64, 0); x.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.35), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  panel.rotation.x = -Math.PI / 2 + Math.atan2(1.5, 5.2);
  panel.position.set(0, 0.78, 0);
  g.add(panel);
  return g;
}

function makeLabelTexture(text, hex) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#120a14'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = hex; x.lineWidth = 10; x.strokeRect(8, 8, 112, 112);
  x.fillStyle = hex; x.font = 'bold 34px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeCrate() {
  // spinning crate whose faces are swapped per power-up type
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.2 });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), mat);
  cube.position.y = 1.3;
  g.add(cube);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  halo.position.y = 1.3; halo.rotation.x = Math.PI / 2;
  g.add(halo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.4, 12, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 6;
  g.add(beam);
  return { group: g, cube, mat, halo, beam };
}

function makeCone() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7 });
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.1, 8), orange); c.position.y = 0.55; g.add(c);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })); band.position.y = 0.55; g.add(band);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.8), new THREE.MeshStandardMaterial({ color: 0x222222 })); base.position.y = 0.04; g.add(base);
  return g;
}

function makeOil() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), new THREE.MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.85 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.035; m.scale.set(1, 1.6, 1); m.renderOrder = 2;
  return m;
}

function makeBarrel() {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xc02020, metalness: 0.4, roughness: 0.5 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12), red); b.position.y = 0.7; g.add(b);
  for (const y of [0.35, 1.05]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 14), new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8 })); ring.position.y = y; ring.rotation.x = Math.PI / 2; g.add(ring); }
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffe066, emissiveIntensity: 0.6 })); skull.position.set(0, 0.7, 0.56); g.add(skull);
  return g;
}

const POWER_IDS = Object.keys(POWERUPS);
const COIN_POOL = 80, CAN_POOL = 6, RAMP_POOL = 4, CRATE_POOL = 4, CONE_POOL = 12, OIL_POOL = 3, BARREL_POOL = 4;

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.magnetRange = 3.2;
    this.coins = [];
    for (let i = 0; i < COIN_POOL; i++) {
      const m = makeCoin(); m.visible = false; scene.add(m);
      this.coins.push({ mesh: m, active: false, x: 0, y: 0.9, z: 0, spin: R(2.5, 4.5) });
    }
    this.cans = [];
    for (let i = 0; i < CAN_POOL; i++) {
      const m = makeCanister(); m.visible = false; scene.add(m);
      this.cans.push({ mesh: m, active: false, x: 0, z: 0 });
    }
    this.ramps = [];
    for (let i = 0; i < RAMP_POOL; i++) {
      const m = makeRamp(); m.visible = false; scene.add(m);
      this.ramps.push({ mesh: m, active: false, x: 0, z: 0, used: false });
    }
    this.labelTex = {};
    for (const id of POWER_IDS) this.labelTex[id] = makeLabelTexture(POWERUPS[id].short, POWERUPS[id].hex);
    this.crates = [];
    for (let i = 0; i < CRATE_POOL; i++) {
      const c = makeCrate(); c.group.visible = false; scene.add(c.group);
      this.crates.push({ ...c, mesh: c.group, active: false, x: 0, z: 0, type: 'shield' });
    }
    this.cones = [];
    for (let i = 0; i < CONE_POOL; i++) {
      const m = makeCone(); m.visible = false; scene.add(m);
      this.cones.push({ mesh: m, active: false, x: 0, z: 0, hit: 0, vx: 0, vy: 0, spin: 0 });
    }
    this.oils = [];
    for (let i = 0; i < OIL_POOL; i++) {
      const m = makeOil(); m.visible = false; scene.add(m);
      this.oils.push({ mesh: m, active: false, x: 0, z: 0, used: false });
    }
    this.barrels = [];
    for (let i = 0; i < BARREL_POOL; i++) {
      const m = makeBarrel(); m.visible = false; scene.add(m);
      this.barrels.push({ mesh: m, active: false, x: 0, z: 0 });
    }
    this.nextPatternIn = 30;
    this.nextHazardIn = 120;
    this.time = 0;
  }

  reset() {
    for (const arr of [this.coins, this.cans, this.ramps, this.crates, this.cones, this.oils, this.barrels]) {
      for (const c of arr) { c.active = false; c.mesh.visible = false; }
    }
    this.nextPatternIn = 24;
    this.nextHazardIn = 140;
    this.magnetRange = 3.2;
  }

  _freeCoin() { return this.coins.find((c) => !c.active); }

  _spawnCoinRow(laneX, z0, n = 5, gap = 4, y = 0.9) {
    for (let i = 0; i < n; i++) {
      const c = this._freeCoin();
      if (!c) return;
      c.active = true; c.mesh.visible = true;
      c.x = laneX; c.y = y; c.z = z0 - i * gap;
      c.mesh.position.set(c.x, c.y, c.z);
    }
  }

  coinRain() {
    for (let i = 0; i < 36; i++) {
      const c = this._freeCoin();
      if (!c) return;
      c.active = true; c.mesh.visible = true;
      c.x = pick(CFG.laneXs) + R(-0.6, 0.6); c.y = R(0.9, 4.5); c.z = CFG.spawnZ + 200 - i * 6;
      c.mesh.position.set(c.x, c.y, c.z);
    }
  }

  spawnCrate(type, lane = pick(CFG.laneXs)) {
    const cr = this.crates.find((p) => !p.active);
    if (!cr) return;
    cr.active = true; cr.mesh.visible = true;
    cr.type = type || pick(POWER_IDS);
    const info = POWERUPS[cr.type];
    cr.mat.map = this.labelTex[cr.type]; cr.mat.emissiveMap = this.labelTex[cr.type];
    cr.mat.color.set(0xffffff); cr.mat.emissive.set(0xffffff); cr.mat.needsUpdate = true;
    cr.halo.material.color.set(info.color); cr.beam.material.color.set(info.color);
    cr.x = lane; cr.z = CFG.spawnZ;
    cr.mesh.position.set(cr.x, 0, cr.z);
  }

  _spawnPattern(difficulty) {
    const roll = Math.random();
    const lane = pick(CFG.laneXs);
    if (roll < 0.34) {
      this._spawnCoinRow(lane, CFG.spawnZ);
      if (Math.random() < 0.4) {
        const li = CFG.laneXs.indexOf(lane);
        const lane2 = CFG.laneXs[Math.min(CFG.laneXs.length - 1, Math.max(0, li + (Math.random() < 0.5 ? 1 : -1)))];
        this._spawnCoinRow(lane2, CFG.spawnZ - 24, 4);
      }
    } else if (roll < 0.52) {
      const r = this.ramps.find((p) => !p.active);
      if (r) {
        r.active = true; r.used = false; r.mesh.visible = true;
        r.x = lane; r.z = CFG.spawnZ;
        r.mesh.position.set(r.x, 0, r.z);
        for (let i = 0; i < 4; i++) {
          const c = this._freeCoin();
          if (!c) break;
          c.active = true; c.mesh.visible = true;
          c.x = lane; c.z = CFG.spawnZ - 10 - i * 5; c.y = 2.2 + Math.sin((i / 3) * Math.PI) * 1.3;
          c.mesh.position.set(c.x, c.y, c.z);
        }
      }
    } else if (roll < 0.66) {
      const can = this.cans.find((p) => !p.active);
      if (can) {
        can.active = true; can.mesh.visible = true;
        can.x = lane; can.z = CFG.spawnZ;
        can.mesh.position.set(can.x, 0, can.z);
      }
    } else if (roll < 0.88) {
      this.spawnCrate(null, lane);
    } else {
      this._spawnCoinRow(lane, CFG.spawnZ, 6, 3.4, 0.9);
    }
  }

  _spawnHazard(difficulty) {
    const roll = Math.random();
    const lane = pick(CFG.laneXs);
    if (roll < 0.45) {
      // cone cluster across 1-2 lanes
      const n = 3 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        const c = this.cones.find((p) => !p.active);
        if (!c) break;
        c.active = true; c.hit = 0; c.mesh.visible = true;
        c.x = lane + R(-1.2, 1.2); c.z = CFG.spawnZ - i * 2.2;
        c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.set(0, 0, 0);
      }
    } else if (roll < 0.75) {
      const o = this.oils.find((p) => !p.active);
      if (o) {
        o.active = true; o.used = false; o.mesh.visible = true;
        o.x = lane; o.z = CFG.spawnZ;
        o.mesh.position.set(o.x, 0.035, o.z);
      }
    } else {
      const b = this.barrels.find((p) => !p.active);
      if (b) {
        b.active = true; b.mesh.visible = true;
        b.x = lane + R(-0.8, 0.8); b.z = CFG.spawnZ;
        b.mesh.position.set(b.x, 0, b.z);
      }
    }
  }

  // events: {coins, nitro, ramp, power, cones, oil, barrel}
  update(dt, speed, player, events, difficulty = 0) {
    this.time += dt;
    this.nextPatternIn -= speed * dt;
    if (this.nextPatternIn <= 0) {
      this._spawnPattern(difficulty);
      this.nextPatternIn = R(30, 58);
    }
    this.nextHazardIn -= speed * dt;
    if (this.nextHazardIn <= 0) {
      this._spawnHazard(difficulty);
      this.nextHazardIn = R(90, 220) * (1.2 - difficulty * 0.5);
    }
    const pScale = player.scale || 1;
    const pw = 1.3 * pScale;

    for (const c of this.coins) {
      if (!c.active) continue;
      c.z += speed * dt;
      c.mesh.rotation.y += c.spin * dt;
      const dz = c.z;
      const ddx = player.x - c.x;
      const mr = this.magnetRange;
      if (Math.abs(dz) < mr * 2.2 && Math.abs(ddx) < mr && Math.abs(player.y + 0.9 - c.y) < mr) {
        const pull = Math.min(1, (mr > 4 ? 14 : 8) * dt);
        c.x += ddx * pull;
        c.y += (player.y + 0.9 - c.y) * pull;
        if (mr > 4) c.z += (0 - c.z) * pull * 0.5;
      }
      if (Math.abs(dz) < 2.2 * pScale && Math.abs(player.x - c.x) < pw && Math.abs(player.y + 0.9 - c.y) < 1.6 * pScale) {
        c.active = false; c.mesh.visible = false;
        events.coins++;
        events.coinX = c.x; events.coinY = c.y; events.coinZ = c.z;
        continue;
      }
      if (c.z > CFG.killZ) { c.active = false; c.mesh.visible = false; continue; }
      c.mesh.position.set(c.x, c.y + Math.sin(c.z * 0.3) * 0.1, c.z);
    }

    for (const can of this.cans) {
      if (!can.active) continue;
      can.z += speed * dt;
      can.mesh.rotation.y += 2.2 * dt;
      can.mesh.position.y = Math.sin(can.z * 0.2) * 0.15;
      if (Math.abs(can.z) < 2.4 && Math.abs(player.x - can.x) < 1.5 * pScale && player.y < 2.2) {
        can.active = false; can.mesh.visible = false;
        events.nitro++;
        continue;
      }
      if (can.z > CFG.killZ) { can.active = false; can.mesh.visible = false; continue; }
      can.mesh.position.x = can.x; can.mesh.position.z = can.z;
    }

    for (const cr of this.crates) {
      if (!cr.active) continue;
      cr.z += speed * dt;
      cr.cube.rotation.y += 2.0 * dt; cr.cube.rotation.x += 1.1 * dt;
      cr.cube.position.y = 1.3 + Math.sin(this.time * 3 + cr.x) * 0.2;
      cr.halo.rotation.z += 1.5 * dt;
      cr.halo.scale.setScalar(1 + Math.sin(this.time * 5) * 0.08);
      if (Math.abs(cr.z) < 2.4 && Math.abs(player.x - cr.x) < 1.7 * pScale && player.y < 3.5) {
        cr.active = false; cr.mesh.visible = false;
        events.power = cr.type;
        events.powerX = cr.x; events.powerZ = cr.z;
        continue;
      }
      if (cr.z > CFG.killZ) { cr.active = false; cr.mesh.visible = false; continue; }
      cr.mesh.position.set(cr.x, 0, cr.z);
    }

    for (const r of this.ramps) {
      if (!r.active) continue;
      r.z += speed * dt;
      r.mesh.position.z = r.z;
      if (!r.used && player.grounded && player.y < 0.4 && r.z > 0.8 && r.z < 4.6 && Math.abs(player.x - r.x) < 1.9 * pScale) {
        r.used = true;
        events.ramp = true;
      }
      if (r.z > CFG.killZ) { r.active = false; r.mesh.visible = false; }
    }

    for (const c of this.cones) {
      if (!c.active) continue;
      c.z += speed * dt;
      if (c.hit) {
        c.hit -= dt;
        c.x += c.vx * dt; c.vy -= 28 * dt;
        c.mesh.position.set(c.x, Math.max(0, c.mesh.position.y + c.vy * dt), c.z);
        c.mesh.rotation.x += c.spin * dt; c.mesh.rotation.z += c.spin * 0.7 * dt;
        if (c.hit <= 0 || c.z > CFG.killZ) { c.active = false; c.mesh.visible = false; }
        continue;
      }
      if (Math.abs(c.z) < 2.2 * pScale && Math.abs(player.x - c.x) < 1.2 * pScale && player.y < 1.0) {
        c.hit = 1.2; c.vx = Math.sign(c.x - player.x || 1) * R(4, 9) + player.vx * 0.5; c.vy = R(6, 11); c.spin = R(-12, 12);
        events.cones++;
        events.coneX = c.x; events.coneZ = c.z;
        continue;
      }
      if (c.z > CFG.killZ) { c.active = false; c.mesh.visible = false; continue; }
      c.mesh.position.set(c.x, 0, c.z);
    }

    for (const o of this.oils) {
      if (!o.active) continue;
      o.z += speed * dt;
      o.mesh.position.z = o.z;
      if (!o.used && Math.abs(o.z) < 2.4 && Math.abs(player.x - o.x) < 1.7 && player.y < 0.4) {
        o.used = true;
        events.oil = true;
      }
      if (o.z > CFG.killZ) { o.active = false; o.mesh.visible = false; }
    }

    for (const b of this.barrels) {
      if (!b.active) continue;
      b.z += speed * dt;
      b.mesh.position.z = b.z;
      if (Math.abs(b.z) < 2.6 * pScale && Math.abs(player.x - b.x) < 1.5 * pScale && player.y < 1.4) {
        b.active = false; b.mesh.visible = false;
        events.barrel = { x: b.x, z: b.z };
        continue;
      }
      if (b.z > CFG.killZ) { b.active = false; b.mesh.visible = false; }
    }
  }

  // for rockets: detonate a barrel near a point
  barrelAt(x, z, r) {
    return this.barrels.find((b) => b.active && Math.abs(b.x - x) < r && Math.abs(b.z - z) < r + 1);
  }
  popBarrel(b) { b.active = false; b.mesh.visible = false; }
}
