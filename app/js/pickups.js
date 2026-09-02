import * as THREE from 'three';
import { CFG } from './config.js';

// Pooled pickups: spinning coins (magnet collect), nitro canisters, ramps.

const R = (a, b) => a + Math.random() * (b - a);

function makeCoin() {
  const geo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 18);
  geo.rotateX(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf7c948, metalness: 0.75, roughness: 0.25, emissive: 0xa8720e, emissiveIntensity: 0.5 });
  const m = new THREE.Mesh(geo, mat);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.07, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xffe08a, metalness: 0.8, roughness: 0.2, emissive: 0xc9920e, emissiveIntensity: 0.6 })
  );
  const g = new THREE.Group();
  g.add(m); g.add(rim);
  return g;
}

function makeCanister() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.34, 0.7, 4, 10),
    new THREE.MeshStandardMaterial({ color: 0xe2602c, metalness: 0.5, roughness: 0.3, emissive: 0x8a2f08, emissiveIntensity: 0.5 })
  );
  body.position.y = 0.7;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.24, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2e3c9, metalness: 0.6, roughness: 0.3 })
  );
  cap.position.y = 1.35;
  g.add(body); g.add(cap);
  return g;
}

function makeRamp() {
  // wedge prism: drive-up ramp with chevron panel
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(5.2, 0);
  shape.lineTo(5.2, 1.5);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);          // length along z (tall edge at -z), width along x
  geo.translate(-1.7, 0, 2.6);       // center: x in [-1.7,1.7], z in [-2.6,2.6]
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a6a50, roughness: 0.85 });
  const g = new THREE.Group();
  const ramp = new THREE.Mesh(geo, mat);
  g.add(ramp);
  // striped top panel
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#e9c46a'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#3a2f2a';
  for (let i = -64; i < 64; i += 20) {
    x.beginPath(); x.moveTo(i, 64); x.lineTo(i + 20, 64); x.lineTo(i + 84, 0); x.lineTo(i + 64, 0); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.35), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  panel.rotation.x = -Math.PI / 2 + Math.atan2(1.5, 5.2);
  panel.position.set(0, 0.78, 0);
  g.add(panel);
  return g;
}

const COIN_POOL = 44;
const CAN_POOL = 6;
const RAMP_POOL = 4;

export class Pickups {
  constructor(scene) {
    this.scene = scene;
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
    this.nextPatternIn = 30; // meters
  }

  reset() {
    for (const c of this.coins) { c.active = false; c.mesh.visible = false; }
    for (const c of this.cans) { c.active = false; c.mesh.visible = false; }
    for (const r of this.ramps) { r.active = false; r.mesh.visible = false; }
    this.nextPatternIn = 24;
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

  _spawnPattern() {
    const roll = Math.random();
    const lane = CFG.laneXs[(Math.random() * CFG.laneXs.length) | 0];
    if (roll < 0.42) {
      // coin row, sometimes snaking between lanes
      this._spawnCoinRow(lane, CFG.spawnZ);
      if (Math.random() < 0.4) {
        const lane2 = CFG.laneXs[Math.min(CFG.laneXs.length - 1, Math.max(0, CFG.laneXs.indexOf(lane) + (Math.random() < 0.5 ? 1 : -1)))];
        this._spawnCoinRow(lane2, CFG.spawnZ - 24, 4);
      }
    } else if (roll < 0.62) {
      // ramp with an arc of coins over it
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
    } else if (roll < 0.8) {
      const can = this.cans.find((p) => !p.active);
      if (can) {
        can.active = true; can.mesh.visible = true;
        can.x = lane; can.z = CFG.spawnZ;
        can.mesh.position.set(can.x, 0, can.z);
      }
    } else {
      this._spawnCoinRow(lane, CFG.spawnZ, 6, 3.4, 0.9);
    }
  }

  // events: {coins, nitro, ramp, rampX, rampZ}
  update(dt, speed, player, events) {
    this.nextPatternIn -= speed * dt;
    if (this.nextPatternIn <= 0) {
      this._spawnPattern();
      this.nextPatternIn = R(34, 62);
    }

    for (const c of this.coins) {
      if (!c.active) continue;
      c.z += speed * dt;
      c.mesh.rotation.y += c.spin * dt;
      // magnet: drift toward the car when close
      const dz = c.z;
      const ddx = player.x - c.x;
      if (Math.abs(dz) < 7 && Math.abs(ddx) < 3.2 && Math.abs(player.y + 0.9 - c.y) < 2.4) {
        c.x += ddx * Math.min(1, 8 * dt);
        c.y += (player.y + 0.9 - c.y) * Math.min(1, 8 * dt);
      }
      if (Math.abs(dz) < 2.2 && Math.abs(player.x - c.x) < 1.3 && Math.abs(player.y + 0.9 - c.y) < 1.6) {
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
      if (Math.abs(can.z) < 2.4 && Math.abs(player.x - can.x) < 1.5 && player.y < 2.2) {
        can.active = false; can.mesh.visible = false;
        events.nitro++;
        continue;
      }
      if (can.z > CFG.killZ) { can.active = false; can.mesh.visible = false; continue; }
      can.mesh.position.x = can.x; can.mesh.position.z = can.z;
    }

    for (const r of this.ramps) {
      if (!r.active) continue;
      r.z += speed * dt;
      r.mesh.position.z = r.z;
      // launch as the car reaches the top (tall) edge of the ramp
      if (!r.used && player.grounded && player.y < 0.4 &&
          r.z > 0.8 && r.z < 4.6 && Math.abs(player.x - r.x) < 1.9) {
        r.used = true;
        events.ramp = true;
      }
      if (r.z > CFG.killZ) { r.active = false; r.mesh.visible = false; }
    }
  }
}
