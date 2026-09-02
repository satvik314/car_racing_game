import * as THREE from 'three';

// Pooled GPU point particles. Two blend modes: normal (smoke/dust) and
// additive (flames/sparks). Buffers updated in place; zero per-frame allocation.

const VSH = `
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
varying vec3 vColor;
void main(){
  vAlpha = aAlpha;
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (270.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FSH = `
varying float vAlpha;
varying vec3 vColor;
void main(){
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  float a = smoothstep(0.5, 0.06, d) * vAlpha;
  if (a < 0.012) discard;
  gl_FragColor = vec4(vColor, a);
}`;

class Pool {
  constructor(scene, max, blending) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grow = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.head = 0;
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.ShaderMaterial({
      vertexShader: VSH, fragmentShader: FSH,
      transparent: true, depthWrite: false, blending, vertexColors: true,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.geo = g;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 0, drag = 0, grow = 0) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size; this.baseSize[i] = size;
    this.grav[i] = grav; this.drag[i] = drag; this.grow[i] = grow;
    this.alpha[i] = 1;
  }

  update(dt, worldSpeed) {
    const { pos, vel, life } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const i3 = i * 3;
      if (life[i] <= 0) { this.alpha[i] = 0; pos[i3 + 1] = -999; continue; }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      vel[i3] *= dr;
      vel[i3 + 1] = vel[i3 + 1] * dr - this.grav[i] * dt;
      vel[i3 + 2] *= dr;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += (vel[i3 + 2] + worldSpeed) * dt; // world scroll
      const t = life[i] / this.maxLife[i];
      this.alpha[i] = t < 0.55 ? t / 0.55 : 1;
      this.size[i] += this.grow[i] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

const R = (a, b) => a + Math.random() * (b - a);

export class Particles {
  constructor(scene) {
    this.soft = new Pool(scene, 500, THREE.NormalBlending); // smoke / dust
    this.glow = new Pool(scene, 320, THREE.AdditiveBlending); // flames / sparks
  }

  update(dt, worldSpeed) {
    this.soft.update(dt, worldSpeed);
    this.glow.update(dt, worldSpeed);
  }

  exhaust(x, y, z) {
    this.soft.emit(x + R(-0.1, 0.1), y, z, R(-0.4, 0.4), R(0.6, 1.4), R(2, 5),
      R(0.5, 0.9), R(0.35, 0.6), 0.45, 0.42, 0.40, -0.5, 1.2, 1.4);
  }

  nitroFlame(x, y, z) {
    this.glow.emit(x + R(-0.08, 0.08), y + R(-0.05, 0.05), z, R(-0.5, 0.5), R(-0.2, 0.5), R(6, 12),
      R(0.18, 0.34), R(0.5, 0.9), 1.0, R(0.45, 0.7), 0.12, 0, 0.5, -1.5);
    if (Math.random() < 0.4) {
      this.glow.emit(x, y, z, 0, 0.2, 8, 0.22, 0.5, 1.0, 0.85, 0.4, 0, 0.5, -1.2);
    }
  }

  tireSmoke(x, y, z, strength = 1) {
    this.soft.emit(x + R(-0.15, 0.15), y, z, R(-1.2, 1.2), R(0.8, 2.0), R(1, 4),
      R(0.6, 1.1), R(0.4, 0.7) * strength, 0.82, 0.78, 0.74, -0.8, 1.6, 2.2);
  }

  dustBurst(x, y, z, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = R(2, 6);
      this.soft.emit(x + Math.cos(a) * 0.8, y + 0.15, z + Math.sin(a) * 0.8,
        Math.cos(a) * sp, R(1, 4), Math.sin(a) * sp,
        R(0.5, 1.0), R(0.6, 1.1), 0.78, 0.66, 0.52, 3.5, 1.8, 2.6);
    }
  }

  sparks(x, y, z, n = 22) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = R(3, 12);
      this.glow.emit(x, y + R(0.2, 1), z, Math.cos(a) * sp, R(2, 8), Math.sin(a) * sp,
        R(0.3, 0.8), R(0.14, 0.3), 1.0, R(0.6, 0.85), 0.15, 16, 0.6, 0);
    }
  }

  coinSparkle(x, y, z) {
    for (let i = 0; i < 6; i++) {
      this.glow.emit(x + R(-0.4, 0.4), y + R(-0.2, 0.6), z, R(-1, 1), R(1, 3), R(-1, 1),
        R(0.25, 0.45), R(0.25, 0.45), 1.0, 0.85, 0.3, 2, 1, 0);
    }
  }
}
