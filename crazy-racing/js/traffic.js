import * as THREE from 'three';
import { CFG, TRAFFIC_COLORS } from './config.js';

// Pooled AI traffic: sedans, vans, trucks. Drive slower than the player in the
// same direction (world-scroll = playerSpeed - ownSpeed). Some change lanes.

const R = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function makeVehicle(kind) {
  const g = new THREE.Group();
  const color = pick(TRAFFIC_COLORS);
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x26211e, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x4a3a38, metalness: 0.6, roughness: 0.25 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550f0a, emissive: 0xff2c18, emissiveIntensity: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffdf9a, emissiveIntensity: 0.7 });

  let halfW = 1.0, halfL = 2.1, topY = 1.4;

  if (kind === 'sedan') {
    g.add(box(1.9, 0.55, 4.2, paint, 0, 0.55, 0));
    g.add(box(1.6, 0.5, 2.0, glass, 0, 1.05, 0.1));
    g.add(box(1.92, 0.2, 4.22, dark, 0, 0.3, 0));
    topY = 1.35;
  } else if (kind === 'van') {
    g.add(box(2.0, 1.5, 4.4, paint, 0, 1.05, 0.2));
    g.add(box(1.9, 0.6, 1.0, glass, 0, 0.9, -1.9));
    g.add(box(2.02, 0.25, 4.42, dark, 0, 0.35, 0));
    halfW = 1.05; halfL = 2.25; topY = 2.0;
  } else { // truck
    g.add(box(2.1, 1.6, 2.0, paint, 0, 1.15, -2.6));       // cab
    g.add(box(2.0, 0.7, 0.9, glass, 0, 1.5, -3.05));
    const trailerMat = new THREE.MeshStandardMaterial({ color: 0xb5a48e, roughness: 0.8 });
    g.add(box(2.2, 2.1, 5.4, trailerMat, 0, 1.5, 1.4));
    g.add(box(2.12, 0.3, 8.6, dark, 0, 0.4, -0.3));
    halfW = 1.15; halfL = 4.4; topY = 2.8;
  }

  // taillights (face +z, toward the approaching player) & headlights
  g.add(box(0.4, 0.16, 0.06, tailMat, -halfW * 0.62, 0.75, halfL - 0.02));
  g.add(box(0.4, 0.16, 0.06, tailMat, halfW * 0.62, 0.75, halfL - 0.02));
  g.add(box(0.4, 0.16, 0.06, headMat, -halfW * 0.62, 0.7, -halfL + 0.02));
  g.add(box(0.4, 0.16, 0.06, headMat, halfW * 0.62, 0.7, -halfL + 0.02));

  // wheels
  const wg = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10);
  wg.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const w = new THREE.Mesh(wg, dark);
    w.position.set(wx * halfW * 0.88, 0.4, wz * halfL * 0.62);
    g.add(w);
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, halfW, halfL, topY };
}

const KINDS = ['sedan', 'sedan', 'sedan', 'van', 'van', 'truck'];
const POOL = 16;

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    for (let i = 0; i < POOL; i++) {
      const kind = KINDS[i % KINDS.length];
      const v = makeVehicle(kind);
      v.group.visible = false;
      scene.add(v.group);
      this.pool.push({
        mesh: v.group, halfW: v.halfW, halfL: v.halfL, topY: v.topY,
        active: false, x: 0, z: 0, speed: 0, lane: 0, targetX: 0,
        prevZ: 0, passed: false, laneTimer: R(2, 8), kind,
      });
    }
    this.spawnTimer = 1;
  }

  reset() {
    for (const v of this.pool) { v.active = false; v.mesh.visible = false; }
    this.spawnTimer = 1.2;
  }

  _trySpawn(difficulty, playerSpeed) {
    const v = this.pool.find((p) => !p.active);
    if (!v) return;
    const lane = (Math.random() * CFG.laneXs.length) | 0;
    const z = CFG.spawnZ - R(0, 60);
    // don't spawn on top of an existing car in the same lane, and always
    // leave at least one lane open so the field is never an impassable wall
    const occupied = new Set();
    for (const o of this.pool) {
      if (!o.active) continue;
      if (Math.abs(o.z - z) < 90) occupied.add(o.lane);
      if (o.lane === lane && Math.abs(o.z - z) < 26) return;
    }
    if (occupied.size >= CFG.laneXs.length - 1) return;
    v.active = true;
    v.mesh.visible = true;
    v.lane = lane;
    v.x = CFG.laneXs[lane];
    v.targetX = v.x;
    v.z = z; v.prevZ = z;
    v.passed = false;
    // traffic always drives slower than the player so it gets overtaken
    v.speed = THREE.MathUtils.clamp(playerSpeed * R(0.32, 0.55), 13, 30) + difficulty * 3;
    v.laneTimer = R(3, 9);
  }

  _laneClear(lane, z) {
    for (const o of this.pool) {
      if (o.active && o.lane === lane && Math.abs(o.z - z) < 24) return false;
    }
    return true;
  }

  // events: {crash: vehicle|null, nearMiss: bool}
  update(dt, playerSpeed, playerX, playerY, playerCrashed, difficulty, events) {
    this.spawnTimer -= dt * (0.4 + playerSpeed / 60) * (0.7 + difficulty * 0.5);
    if (this.spawnTimer <= 0) {
      this._trySpawn(difficulty, playerSpeed);
      if (difficulty > 0.4 && Math.random() < 0.4) this._trySpawn(difficulty, playerSpeed);
      this.spawnTimer = R(0.5, 1.4);
    }

    for (const v of this.pool) {
      if (!v.active) continue;
      v.prevZ = v.z;
      v.z += (playerSpeed - v.speed) * dt;

      // occasional lane change, far ahead of the player, into a clear lane
      v.laneTimer -= dt;
      if (v.laneTimer <= 0 && v.z < -150 && Math.random() < 0.5) {
        const nl = v.lane + (Math.random() < 0.5 ? -1 : 1);
        if (nl >= 0 && nl < CFG.laneXs.length && this._laneClear(nl, v.z)) {
          v.lane = nl;
          v.targetX = CFG.laneXs[nl];
        }
        v.laneTimer = R(3, 9);
      } else if (v.laneTimer <= 0) {
        v.laneTimer = R(3, 9);
      }
      const dx = v.targetX - v.x;
      if (Math.abs(dx) > 0.02) v.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.2 * dt);

      if (v.z > CFG.killZ || v.z < CFG.spawnZ - 140) {
        v.active = false; v.mesh.visible = false;
        continue;
      }

      v.mesh.position.set(v.x, 0, v.z);

      if (playerCrashed) continue;

      const dz = v.z - 0; // player z = 0
      // near miss: crossing the player's plane, close laterally, fast
      if (!v.passed && v.prevZ < 0 && v.z >= 0) {
        v.passed = true;
        const lat = Math.abs(v.x - playerX);
        const rel = playerSpeed - v.speed;
        if (lat < CFG.playerHalfW + v.halfW + 1.6 && rel > CFG.nearMissMinSpeed && playerY < 1.2) {
          events.nearMiss = true;
          events.nearMissX = v.x; events.nearMissZ = v.z;
        }
      }

      // collision (can jump over low vehicles)
      if (Math.abs(dz) < CFG.playerHalfL + v.halfL &&
          Math.abs(v.x - playerX) < CFG.playerHalfW + v.halfW &&
          playerY < v.topY - 0.35) {
        events.crash = v;
      }
    }
  }

  // any active vehicle near a point? (for landing bonus)
  hasNear(x, z, radius) {
    for (const v of this.pool) {
      if (!v.active) continue;
      if (Math.abs(v.z - z) < radius && Math.abs(v.x - x) < radius) return true;
    }
    return false;
  }
}