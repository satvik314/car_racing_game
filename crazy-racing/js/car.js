import * as THREE from 'three';

// Stylized low-poly sports car built from primitives.
// Exposes update(dt, state) for animation: wheel spin/steer, body roll/pitch,
// brake light glow, suspension bounce on landing.

function box(w, h, d, mat, x, y, z, rx = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (rx) m.rotation.x = rx;
  return m;
}

export class PlayerCar {
  constructor(scene) {
    const group = new THREE.Group();          // world position / yaw
    const body = new THREE.Group();           // roll/pitch/suspension
    group.add(body);

    const paint = new THREE.MeshStandardMaterial({ color: 0xc9402f, metalness: 0.35, roughness: 0.42 });
    const paintDark = new THREE.MeshStandardMaterial({ color: 0x8e2b21, metalness: 0.3, roughness: 0.5 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x241f1c, roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x513a3a, metalness: 0.7, roughness: 0.18 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xf2e3c9, roughness: 0.6 });

    // main body
    const lower = box(2.0, 0.5, 4.2, paint, 0, 0.55, 0); body.add(lower);
    body.add(box(1.86, 0.34, 1.15, paint, 0, 0.5, -2.28, 0.14));      // sloped nose
    body.add(box(1.86, 0.36, 0.9, paintDark, 0, 0.62, 2.05, -0.1));   // rear deck
    body.add(box(2.04, 0.14, 0.7, trim, 0, 0.34, -2.2));              // front splitter
    // cabin
    const cabin = box(1.55, 0.5, 1.9, glass, 0, 1.02, 0.2); body.add(cabin);
    body.add(box(1.58, 0.1, 1.0, paint, 0, 1.3, 0.32));               // roof panel
    // racing stripe
    body.add(box(0.5, 0.03, 4.25, cream, 0, 0.815, -0.02));
    // spoiler
    body.add(box(0.12, 0.3, 0.12, trim, -0.7, 0.98, 2.05));
    body.add(box(0.12, 0.3, 0.12, trim, 0.7, 0.98, 2.05));
    body.add(box(1.9, 0.08, 0.42, paintDark, 0, 1.14, 2.1));
    // exhaust pipes
    const pipeGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.3, 8);
    pipeGeo.rotateX(Math.PI / 2);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5a544e, metalness: 0.8, roughness: 0.35 });
    this.exhaustL = new THREE.Mesh(pipeGeo, pipeMat); this.exhaustL.position.set(-0.5, 0.42, 2.32); body.add(this.exhaustL);
    this.exhaustR = new THREE.Mesh(pipeGeo, pipeMat); this.exhaustR.position.set(0.5, 0.42, 2.32); body.add(this.exhaustR);

    // brake light strip (emissive toggled on brake)
    this.brakeMat = new THREE.MeshStandardMaterial({ color: 0x4a0d08, emissive: 0xff2a18, emissiveIntensity: 0.25 });
    body.add(box(1.7, 0.14, 0.06, this.brakeMat, 0, 0.72, 2.32));
    // headlights + glow planes
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff3d0, emissive: 0xffe9b0, emissiveIntensity: 1.4 });
    body.add(box(0.42, 0.14, 0.06, headMat, -0.62, 0.62, -2.56));
    body.add(box(0.42, 0.14, 0.06, headMat, 0.62, 0.62, -2.56));
    const glowTex = makeGlowTexture();
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9b8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    this.headGlows = [];
    for (const sx of [-0.62, 0.62]) {
      const s = new THREE.Sprite(glowMat);
      s.scale.set(0.9, 0.9, 1); s.position.set(sx, 0.62, -2.62);
      body.add(s); this.headGlows.push(s);
    }
    // brake glow sprite
    this.brakeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff3520, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.brakeGlow.scale.set(2.2, 0.9, 1); this.brakeGlow.position.set(0, 0.72, 2.5);
    body.add(this.brakeGlow);

    // wheels
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 14);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xc9b18a, metalness: 0.7, roughness: 0.3 });
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.38, 8);
    hubGeo.rotateZ(Math.PI / 2);
    const mkWheel = (x, z) => {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.42, z);
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      const spin = new THREE.Group(); spin.add(w); spin.add(hub);
      pivot.add(spin); group.add(pivot);
      return { pivot, spin };
    };
    this.wheels = {
      fl: mkWheel(-0.95, -1.45), fr: mkWheel(0.95, -1.45),
      rl: mkWheel(-0.95, 1.5), rr: mkWheel(0.95, 1.5),
    };
    // rear wheel world anchors for skid marks / smoke
    this.rearL = new THREE.Object3D(); this.rearL.position.set(-0.95, 0.1, 1.5); group.add(this.rearL);
    this.rearR = new THREE.Object3D(); this.rearR.position.set(0.95, 0.1, 1.5); group.add(this.rearR);

    group.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

    this.group = group;
    this.body = body;
    this.wheelSpin = 0;
    this.susp = 0; this.suspV = 0;   // suspension spring
    scene.add(group);

    this._v = new THREE.Vector3();
  }

  landBounce(strength = 1) { this.suspV -= 5.5 * strength; }

  // Anchor world positions for exhaust flames
  exhaustPos(out, left) {
    out.setFromMatrixPosition((left ? this.exhaustL : this.exhaustR).matrixWorld);
    return out;
  }
  rearWheelPos(out, left) {
    out.setFromMatrixPosition((left ? this.rearL : this.rearR).matrixWorld);
    return out;
  }

  update(dt, s) {
    // s: {x, y, steer, vx, speed, drifting, braking, grounded, crashed, crashSpin}
    const g = this.group;
    g.position.set(s.x, s.y, 0);

    if (s.crashed) {
      g.rotation.y += s.crashSpin * dt;
      this.body.rotation.z += 2.2 * dt;
      this.brakeMat.emissiveIntensity = 2.4;
      this.brakeGlow.material.opacity = 0.7;
      return;
    }

    const yaw = -(s.steer * 0.10 + s.vx * 0.024);
    g.rotation.y += (yaw - g.rotation.y) * Math.min(1, 10 * dt);

    // suspension spring
    this.suspV += (-this.susp * 60 - this.suspV * 9) * dt;
    this.susp += this.suspV * dt;

    const targetRoll = s.steer * 0.055 + s.vx * 0.012;
    const targetPitch = (s.braking ? -0.045 : 0) + (s.gas ? 0.028 : 0) - Math.min(0.06, this.susp * 0.03);
    this.body.rotation.z += (targetRoll - this.body.rotation.z) * Math.min(1, 8 * dt);
    this.body.rotation.x += (targetPitch - this.body.rotation.x) * Math.min(1, 8 * dt);
    this.body.position.y = Math.max(-0.12, this.susp * 0.045);

    // wheels
    this.wheelSpin += (s.speed / 0.42) * dt;
    for (const k of ['fl', 'fr', 'rl', 'rr']) this.wheels[k].spin.rotation.x = this.wheelSpin;
    const steerAngle = -s.steer * 0.42;
    this.wheels.fl.pivot.rotation.y += (steerAngle - this.wheels.fl.pivot.rotation.y) * Math.min(1, 12 * dt);
    this.wheels.fr.pivot.rotation.y = this.wheels.fl.pivot.rotation.y;

    // brake lights
    const braking = s.braking && s.speed > 2;
    this.brakeMat.emissiveIntensity += ((braking ? 2.6 : 0.25) - this.brakeMat.emissiveIntensity) * Math.min(1, 14 * dt);
    this.brakeGlow.material.opacity += ((braking ? 0.75 : 0) - this.brakeGlow.material.opacity) * Math.min(1, 14 * dt);
  }
}

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
  const t = new THREE.CanvasTexture(c);
  return t;
}
