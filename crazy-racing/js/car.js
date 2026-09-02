import * as THREE from 'three';
import { CARS } from './cars.js';

// Player car: builds any garage car definition on demand (setCar), and
// animates it: wheel spin/steer, body roll/pitch, suspension bounce, brake
// glow, plus power-up visuals (shield bubble, ghost fade, giant scale, hover).

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.isMesh || o.isSprite) {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.dispose) m.dispose();
    }
  });
}

export class PlayerCar {
  constructor(scene, def = CARS[0]) {
    this.scene = scene;
    this.group = new THREE.Group();   // world position / yaw / scale
    this.rig = new THREE.Group();     // everything car-specific lives here (rebuilt on setCar)
    this.group.add(this.rig);
    scene.add(this.group);

    this.glowTex = makeGlowTexture();
    this._v = new THREE.Vector3();
    this.wheelSpin = 0;
    this.susp = 0; this.suspV = 0;
    this.hoverT = 0;
    this.scaleTarget = 1; this.scaleCur = 1;
    this.ghostAlpha = 1; this.ghostTarget = 1;

    // shield bubble (shared across cars, outside the rig)
    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0x7fd8ff, emissive: 0x3aa0ff, emissiveIntensity: 0.8, transparent: true, opacity: 0.0, roughness: 0.2, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide })
    );
    this.shield.scale.set(2.4, 1.6, 3.4);
    this.shield.position.y = 0.9;
    this.shield.visible = false;
    this.group.add(this.shield);
    this.shieldTarget = 0;

    this.setCar(def);
  }

  setCar(def) {
    if (this.rig.children.length) {
      disposeTree(this.rig);
      this.rig.clear();
    }
    this.def = def;
    const body = new THREE.Group();
    this.body = body;
    this.rig.add(body);

    const hints = def.build(body);
    this.hints = hints;
    this.halfW = hints.halfW; this.halfL = hints.halfL;
    this.hover = !!hints.hover;
    this.bodyLift = hints.bodyLift || 0;

    // exhausts
    const pipeGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.3, 8);
    pipeGeo.rotateX(Math.PI / 2);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5a544e, metalness: 0.8, roughness: 0.35 });
    this.exhausts = hints.exhaust.map(([x, y, z]) => {
      const m = new THREE.Mesh(pipeGeo, pipeMat);
      m.position.set(x, y, z);
      if (hints.exhaustUp) m.rotation.x = -Math.PI / 2;
      body.add(m);
      return m;
    });

    // brake strip + glow
    this.brakeMat = new THREE.MeshStandardMaterial({ color: 0x4a0d08, emissive: 0xff2a18, emissiveIntensity: 0.25 });
    const brake = new THREE.Mesh(new THREE.BoxGeometry(hints.brakeW, 0.14, 0.06), this.brakeMat);
    brake.position.set(0, hints.brakeY, hints.rearZ);
    body.add(brake);
    this.brakeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xff3520, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.brakeGlow.scale.set(hints.brakeW + 0.5, 0.9, 1);
    this.brakeGlow.position.set(0, hints.brakeY, hints.rearZ + 0.18);
    body.add(this.brakeGlow);

    // headlights + glow sprites
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffe9b0, emissiveIntensity: 1.4 });
    const hx = Math.max(0.3, hints.halfW * 0.62);
    const glowMat = new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffe9b8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const sx of [-hx, hx]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), headMat);
      h.position.set(sx, hints.lightY, hints.frontZ);
      body.add(h);
      const s = new THREE.Sprite(glowMat);
      s.scale.set(0.9, 0.9, 1); s.position.set(sx, hints.lightY, hints.frontZ - 0.06);
      body.add(s);
    }

    // wheels (pivot for steer, spin child)
    this.wheels = [];
    if (hints.wheels.length) {
      const wr = hints.wheelR, ww = hints.wheelW;
      const wheelGeo = new THREE.CylinderGeometry(wr, wr, ww, 14);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
      const hubMat = new THREE.MeshStandardMaterial({ color: 0xc9b18a, metalness: 0.7, roughness: 0.3 });
      const hubGeo = new THREE.CylinderGeometry(wr * 0.48, wr * 0.48, ww + 0.02, 8);
      hubGeo.rotateZ(Math.PI / 2);
      const frontZ = Math.min(...hints.wheels.map((w) => w.z));
      for (const w of hints.wheels) {
        const pivot = new THREE.Group(); pivot.position.set(w.x, wr, w.z);
        const spin = new THREE.Group();
        spin.add(new THREE.Mesh(wheelGeo, wheelMat));
        spin.add(new THREE.Mesh(hubGeo, hubMat));
        pivot.add(spin);
        this.rig.add(pivot);
        this.wheels.push({ pivot, spin, front: Math.abs(w.z - frontZ) < 0.01, r: wr });
      }
      this.wheelR = wr;
    } else {
      this.wheelR = 0.42;
    }

    // rear anchors for skid marks / smoke
    const rz = hints.wheels.length ? Math.max(...hints.wheels.map((w) => w.z)) : hints.rearZ - 0.4;
    const rx = hints.wheels.length ? Math.max(...hints.wheels.map((w) => Math.abs(w.x))) : hints.halfW * 0.8;
    this.rearL = new THREE.Object3D(); this.rearL.position.set(-rx, 0.1, rz); this.rig.add(this.rearL);
    this.rearR = new THREE.Object3D(); this.rearR.position.set(rx, 0.1, rz); this.rig.add(this.rearR);

    // collect materials for ghost fade
    this.fadeMats = [];
    this.rig.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m.userData.baseOpacity) m.userData.baseOpacity = m.opacity;
          this.fadeMats.push(m);
        }
      }
    });
    this.shield.scale.set(hints.halfW * 2.0, 1.4 + (hints.bodyLift || 0), hints.halfL * 1.45);
    this.shield.position.y = 0.9 + (hints.bodyLift || 0) * 0.6;
    this._applyGhost(this.ghostAlpha, true);
  }

  landBounce(strength = 1) { this.suspV -= 5.5 * strength; }

  setShield(on) { this.shieldTarget = on ? 0.16 : 0; }
  shieldPop() { this.shieldFlash = 1; }
  setGhost(on) { this.ghostTarget = on ? 0.32 : 1; }
  setScale(s) { this.scaleTarget = s; }

  exhaustPos(out, left) {
    out.setFromMatrixPosition(this.exhausts[left ? 0 : (this.exhausts.length - 1)].matrixWorld);
    return out;
  }
  rearWheelPos(out, left) {
    out.setFromMatrixPosition((left ? this.rearL : this.rearR).matrixWorld);
    return out;
  }

  _applyGhost(a, force) {
    for (const m of this.fadeMats) {
      const base = m.userData.baseOpacity ?? 1;
      const wantT = a < 0.999 || base < 0.999;
      if (m.transparent !== wantT || force) { m.transparent = wantT; m.needsUpdate = true; }
      m.opacity = base * a;
    }
  }

  update(dt, s) {
    // s: {x, y, steer, vx, speed, drifting, braking, gas, grounded, crashed, crashSpin}
    const g = this.group;
    this.hoverT += dt;
    const hoverY = this.hover ? 0.35 + Math.sin(this.hoverT * 4.2) * 0.08 + Math.sin(this.hoverT * 7.1) * 0.03 : 0;
    g.position.set(s.x, s.y + hoverY, 0);

    // giant / shrink scale
    this.scaleCur += (this.scaleTarget - this.scaleCur) * Math.min(1, 6 * dt);
    g.scale.setScalar(this.scaleCur);

    // ghost fade
    if (Math.abs(this.ghostTarget - this.ghostAlpha) > 0.002) {
      this.ghostAlpha += (this.ghostTarget - this.ghostAlpha) * Math.min(1, 8 * dt);
      this._applyGhost(this.ghostAlpha, false);
    } else if (this.ghostAlpha < 0.999) {
      // flicker while ghosted
      this._applyGhost(this.ghostAlpha + Math.sin(this.hoverT * 30) * 0.08, false);
    }

    // shield bubble
    const sm = this.shield.material;
    let want = this.shieldTarget;
    if (this.shieldFlash > 0) { want = 0.9 * this.shieldFlash; this.shieldFlash = Math.max(0, this.shieldFlash - 3 * dt); }
    sm.opacity += (want - sm.opacity) * Math.min(1, 8 * dt);
    this.shield.visible = sm.opacity > 0.01;
    this.shield.rotation.y += dt * 0.8;
    this.shield.rotation.x += dt * 0.35;
    sm.emissiveIntensity = 0.8 + Math.sin(this.hoverT * 6) * 0.3;

    if (s.crashed) {
      g.rotation.y += s.crashSpin * dt;
      this.body.rotation.z += 2.2 * dt;
      this.brakeMat.emissiveIntensity = 2.4;
      this.brakeGlow.material.opacity = 0.7;
      return;
    }

    const yaw = -(s.steer * 0.10 + s.vx * 0.024);
    g.rotation.y += (yaw - g.rotation.y) * Math.min(1, 10 * dt);

    this.suspV += (-this.susp * 60 - this.suspV * 9) * dt;
    this.susp += this.suspV * dt;

    const rollAmt = this.hover ? 2.2 : 1;
    const targetRoll = (s.steer * 0.055 + s.vx * 0.012) * rollAmt;
    const targetPitch = (s.braking ? -0.045 : 0) + (s.gas ? 0.028 : 0) - Math.min(0.06, this.susp * 0.03);
    this.body.rotation.z += (targetRoll - this.body.rotation.z) * Math.min(1, 8 * dt);
    this.body.rotation.x += (targetPitch - this.body.rotation.x) * Math.min(1, 8 * dt);
    this.body.position.y = Math.max(-0.12, this.susp * 0.045);

    if (this.wheels.length) {
      this.wheelSpin += (s.speed / this.wheelR) * dt;
      const steerAngle = -s.steer * 0.42;
      for (const w of this.wheels) {
        w.spin.rotation.x = this.wheelSpin;
        if (w.front) w.pivot.rotation.y += (steerAngle - w.pivot.rotation.y) * Math.min(1, 12 * dt);
      }
    }

    const braking = s.braking && s.speed > 2;
    this.brakeMat.emissiveIntensity += ((braking ? 2.6 : 0.25) - this.brakeMat.emissiveIntensity) * Math.min(1, 14 * dt);
    this.brakeGlow.material.opacity += ((braking ? 0.75 : 0) - this.brakeGlow.material.opacity) * Math.min(1, 14 * dt);
  }
}
