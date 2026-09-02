import * as THREE from 'three';
import { CFG, TRAFFIC_COLORS } from './config.js';

// Pooled AI traffic: sedans, vans, trucks, buses, bikes, rival sports cars
// and police cruisers. Drive slower than the player in the same direction
// (world-scroll = playerSpeed - ownSpeed). Some change lanes; rivals block.
// Vehicles can be destroyed (rockets, giant mode, monster-truck crush) and
// fly off the road in a spin before recycling.

const R = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function makeVehicle(kind) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: pick(TRAFFIC_COLORS), metalness: 0.25, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x26211e, roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x4a3a38, metalness: 0.6, roughness: 0.25 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550f0a, emissive: 0xff2c18, emissiveIntensity: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffdf9a, emissiveIntensity: 0.7 });

  let halfW = 1.0, halfL = 2.1, topY = 1.4, crushable = false, lights = null;
  let wheelXs = [-1, 1], wheelZs = [-0.62, 0.62];

  if (kind === 'sedan') {
    g.add(box(1.9, 0.55, 4.2, paint, 0, 0.55, 0));
    g.add(box(1.6, 0.5, 2.0, glass, 0, 1.05, 0.1));
    g.add(box(1.92, 0.2, 4.22, dark, 0, 0.3, 0));
    topY = 1.35; crushable = true;
  } else if (kind === 'van') {
    g.add(box(2.0, 1.5, 4.4, paint, 0, 1.05, 0.2));
    g.add(box(1.9, 0.6, 1.0, glass, 0, 0.9, -1.9));
    g.add(box(2.02, 0.25, 4.42, dark, 0, 0.35, 0));
    halfW = 1.05; halfL = 2.25; topY = 2.0;
  } else if (kind === 'truck') {
    g.add(box(2.1, 1.6, 2.0, paint, 0, 1.15, -2.6));
    g.add(box(2.0, 0.7, 0.9, glass, 0, 1.5, -3.05));
    const trailerMat = new THREE.MeshStandardMaterial({ color: 0xb5a48e, roughness: 0.8 });
    g.add(box(2.2, 2.1, 5.4, trailerMat, 0, 1.5, 1.4));
    g.add(box(2.12, 0.3, 8.6, dark, 0, 0.4, -0.3));
    halfW = 1.15; halfL = 4.4; topY = 2.8;
    wheelZs = [-0.75, -0.3, 0.45, 0.7];
  } else if (kind === 'bus') {
    g.add(box(2.3, 2.2, 9.0, paint, 0, 1.45, 0));
    const win = new THREE.MeshStandardMaterial({ color: 0x3a4a58, metalness: 0.6, roughness: 0.2 });
    g.add(box(2.34, 0.7, 8.4, win, 0, 1.9, 0));
    g.add(box(2.32, 0.3, 9.02, dark, 0, 0.4, 0));
    halfW = 1.2; halfL = 4.6; topY = 2.7;
    wheelZs = [-0.7, 0.6];
  } else if (kind === 'bike') {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.9, roughness: 0.2 });
    g.add(box(0.5, 0.5, 1.8, paint, 0, 0.7, 0));
    g.add(box(0.3, 0.7, 0.4, dark, 0, 1.3, 0.2));       // rider
    g.add(box(0.36, 0.34, 0.36, paint, 0, 1.75, 0.15));  // helmet
    g.add(box(0.8, 0.08, 0.08, chrome, 0, 1.15, -0.7));  // bars
    g.add(box(0.2, 0.35, 0.6, chrome, 0, 0.45, 0.2));
    halfW = 0.45; halfL = 1.1; topY = 1.9; crushable = true;
    wheelXs = [0]; wheelZs = [-0.85, 0.85];
  } else if (kind === 'sport') {
    g.add(box(1.9, 0.42, 4.0, paint, 0, 0.48, 0));
    g.add(box(1.5, 0.4, 1.7, glass, 0, 0.9, 0.1));
    g.add(box(1.92, 0.18, 4.05, dark, 0, 0.28, 0));
    g.add(box(1.8, 0.07, 0.4, dark, 0, 0.95, 1.9));
    topY = 1.2; crushable = true;
  } else { // police
    paint.color.set(0xf0f0f0);
    g.add(box(1.95, 0.55, 4.4, paint, 0, 0.55, 0));
    g.add(box(1.6, 0.5, 2.0, glass, 0, 1.05, 0.1));
    g.add(box(1.97, 0.3, 4.42, dark, 0, 0.3, 0));
    g.add(box(1.96, 0.2, 2.0, dark, 0, 0.55, 0));       // black doors
    const red = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2060ff, emissive: 0x2060ff, emissiveIntensity: 2 });
    const l1 = box(0.6, 0.22, 0.4, red, -0.4, 1.4, 0.1);
    const l2 = box(0.6, 0.22, 0.4, blue, 0.4, 1.4, 0.1);
    g.add(l1, l2); lights = [l1, l2];
    topY = 1.5;
  }

  g.add(box(0.4, 0.16, 0.06, tailMat, -halfW * 0.62, 0.75, halfL - 0.02));
  g.add(box(0.4, 0.16, 0.06, tailMat, halfW * 0.62, 0.75, halfL - 0.02));
  g.add(box(0.4, 0.16, 0.06, headMat, -halfW * 0.62, 0.7, -halfL + 0.02));
  g.add(box(0.4, 0.16, 0.06, headMat, halfW * 0.62, 0.7, -halfL + 0.02));

  const wg = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10);
  wg.rotateZ(Math.PI / 2);
  for (const wx of wheelXs) for (const wz of wheelZs) {
    const w = new THREE.Mesh(wg, dark);
    w.position.set(wx * halfW * 0.88, 0.4, wz * halfL * (kind === 'bike' ? 1 : 1));
    g.add(w);
  }

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, halfW, halfL, topY, paint, crushable, lights };
}

const KINDS = ['sedan', 'sedan', 'sedan', 'van', 'van', 'truck', 'bus', 'bike', 'bike', 'sport', 'police', 'sedan'];
const POOL = 20;

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.colors = TRAFFIC_COLORS;
    for (let i = 0; i < POOL; i++) {
      const kind = KINDS[i % KINDS.length];
      const v = makeVehicle(kind);
      v.group.visible = false;
      scene.add(v.group);
      this.pool.push({
        mesh: v.group, halfW: v.halfW, halfL: v.halfL, topY: v.topY, paint: v.paint, crushable: v.crushable, lights: v.lights,
        active: false, x: 0, z: 0, speed: 0, lane: 0, targetX: 0,
        prevZ: 0, passed: false, laneTimer: R(2, 8), kind,
        dying: 0, dyVy: 0, dyVx: 0, dySpin: 0,
      });
    }
    this.spawnTimer = 1;
    this.time = 0;
  }

  setColors(colors) {
    this.colors = colors;
    for (const v of this.pool) if (v.kind !== 'police') v.paint.color.set(pick(colors));
  }

  reset() {
    for (const v of this.pool) { v.active = false; v.dying = 0; v.mesh.visible = false; }
    this.spawnTimer = 1.2;
  }

  _trySpawn(difficulty, playerSpeed) {
    const cands = this.pool.filter((p) => !p.active);
    if (!cands.length) return;
    let v = pick(cands);
    // rivals & cops only after some distance
    if ((v.kind === 'sport' || v.kind === 'police') && difficulty < 0.15) v = cands.find((c) => c.kind !== 'sport' && c.kind !== 'police') || v;
    const lane = (Math.random() * CFG.laneXs.length) | 0;
    const z = CFG.spawnZ - R(0, 60);
    const occupied = new Set();
    for (const o of this.pool) {
      if (!o.active) continue;
      if (Math.abs(o.z - z) < 90) occupied.add(o.lane);
      if (o.lane === lane && Math.abs(o.z - z) < 26) return;
    }
    if (occupied.size >= CFG.laneXs.length - 1) return;
    v.active = true; v.dying = 0;
    v.mesh.visible = true;
    v.mesh.rotation.set(0, 0, 0);
    if (v.kind !== 'police') v.paint.color.set(pick(this.colors));
    v.lane = lane;
    v.x = CFG.laneXs[lane];
    v.targetX = v.x;
    v.z = z; v.prevZ = z;
    v.passed = false;
    const ratio = v.kind === 'sport' ? R(0.62, 0.8) : v.kind === 'police' ? R(0.55, 0.72) : v.kind === 'bike' ? R(0.4, 0.62) : R(0.32, 0.55);
    v.speed = THREE.MathUtils.clamp(playerSpeed * ratio, 13, v.kind === 'sport' || v.kind === 'police' ? 60 : 30) + difficulty * 3;
    v.laneTimer = R(3, 9);
  }

  _laneClear(lane, z) {
    for (const o of this.pool) {
      if (o.active && !o.dying && o.lane === lane && Math.abs(o.z - z) < 24) return false;
    }
    return true;
  }

  // Blow a vehicle off the road. Returns kind.
  destroy(v, dirX = 0) {
    if (!v.active || v.dying) return null;
    v.dying = 1.4;
    v.dyVy = R(9, 15);
    v.dyVx = (dirX || (Math.random() < 0.5 ? -1 : 1)) * R(6, 12);
    v.dySpin = R(-8, 8);
    return v.kind;
  }

  // Find the first live vehicle overlapping a point (for rockets)
  hitAt(x, z, radius) {
    let best = null, bestZ = -Infinity;
    for (const v of this.pool) {
      if (!v.active || v.dying) continue;
      if (Math.abs(v.x - x) < v.halfW + radius && Math.abs(v.z - z) < v.halfL + radius) {
        if (v.z > bestZ) { best = v; bestZ = v.z; }
      }
    }
    return best;
  }

  // Nearest live vehicle ahead in a lateral window (for rocket auto-aim)
  nearestAhead(x, window) {
    let best = null, bestZ = -Infinity;
    for (const v of this.pool) {
      if (!v.active || v.dying || v.z > -2) continue;
      if (Math.abs(v.x - x) < window && v.z > bestZ) { best = v; bestZ = v.z; }
    }
    return best;
  }

  // events: {crash, nearMiss, crushed}; opts: {ghost, giant, crush, halfW, halfL, scale}
  update(dt, playerSpeed, playerX, playerY, playerCrashed, difficulty, events, opts) {
    this.time += dt;
    this.spawnTimer -= dt * (0.4 + playerSpeed / 60) * (0.7 + difficulty * 0.5);
    if (this.spawnTimer <= 0) {
      this._trySpawn(difficulty, playerSpeed);
      if (difficulty > 0.4 && Math.random() < 0.4) this._trySpawn(difficulty, playerSpeed);
      this.spawnTimer = R(0.5, 1.4);
    }
    const pHalfW = (opts.halfW || CFG.playerHalfW) * (opts.scale || 1);
    const pHalfL = (opts.halfL || CFG.playerHalfL) * (opts.scale || 1);
    const flash = Math.sin(this.time * 18) > 0;

    for (const v of this.pool) {
      if (!v.active) continue;
      v.prevZ = v.z;

      if (v.dying > 0) {
        v.dying -= dt;
        v.z += (playerSpeed - v.speed * 0.3) * dt;
        v.x += v.dyVx * dt;
        v.dyVy -= 30 * dt;
        v.mesh.position.set(v.x, Math.max(-3, v.mesh.position.y + v.dyVy * dt), v.z);
        v.mesh.rotation.y += v.dySpin * dt;
        v.mesh.rotation.z += v.dySpin * 0.6 * dt;
        if (v.dying <= 0 || v.z > CFG.killZ) { v.active = false; v.dying = 0; v.mesh.visible = false; v.mesh.position.y = 0; }
        continue;
      }

      v.z += (playerSpeed - v.speed) * dt;
      if (v.lights) { v.lights[0].material.emissiveIntensity = flash ? 3 : 0.2; v.lights[1].material.emissiveIntensity = flash ? 0.2 : 3; }

      v.laneTimer -= dt;
      if (v.kind === 'sport' && v.z < -40 && v.z > -140) {
        // rival: drift toward the player's lane to block
        let nearest = 0, nd = Infinity;
        for (let i = 0; i < CFG.laneXs.length; i++) { const d = Math.abs(CFG.laneXs[i] - playerX); if (d < nd) { nd = d; nearest = i; } }
        if (nearest !== v.lane && Math.abs(nearest - v.lane) === 1 && this._laneClear(nearest, v.z) && v.laneTimer <= 0) {
          v.lane = nearest; v.targetX = CFG.laneXs[nearest]; v.laneTimer = R(1.5, 3);
        }
      } else if (v.laneTimer <= 0 && v.z < -150 && Math.random() < 0.5) {
        const nl = v.lane + (Math.random() < 0.5 ? -1 : 1);
        if (nl >= 0 && nl < CFG.laneXs.length && this._laneClear(nl, v.z)) {
          v.lane = nl; v.targetX = CFG.laneXs[nl];
        }
        v.laneTimer = R(3, 9);
      } else if (v.laneTimer <= 0) {
        v.laneTimer = R(3, 9);
      }
      const dx = v.targetX - v.x;
      if (Math.abs(dx) > 0.02) v.x += Math.sign(dx) * Math.min(Math.abs(dx), (v.kind === 'sport' ? 4 : 2.2) * dt);

      if (v.z > CFG.killZ || v.z < CFG.spawnZ - 140) {
        v.active = false; v.mesh.visible = false;
        continue;
      }

      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = -dx * 0.08;

      if (playerCrashed) continue;

      if (!v.passed && v.prevZ < 0 && v.z >= 0) {
        v.passed = true;
        const lat = Math.abs(v.x - playerX);
        const rel = playerSpeed - v.speed;
        if (lat < pHalfW + v.halfW + 1.6 && rel > CFG.nearMissMinSpeed && playerY < 1.2) {
          events.nearMiss = true;
          events.nearMissX = v.x; events.nearMissZ = v.z;
        }
      }

      const overlap = Math.abs(v.z) < pHalfL + v.halfL && Math.abs(v.x - playerX) < pHalfW + v.halfW;
      if (!overlap) continue;
      if (opts.ghost) continue;
      if (opts.giant) { this.destroy(v, Math.sign(v.x - playerX) || 1); events.crushed++; events.crushKind = v.kind; continue; }
      if (playerY >= v.topY - 0.35) continue; // jumped over
      if (opts.crush && v.crushable) { this.destroy(v, Math.sign(v.x - playerX) || 1); events.crushed++; events.crushKind = v.kind; continue; }
      events.crash = v;
    }
  }

  hasNear(x, z, radius) {
    for (const v of this.pool) {
      if (!v.active || v.dying) continue;
      if (Math.abs(v.z - z) < radius && Math.abs(v.x - x) < radius) return true;
    }
    return false;
  }
}
