import * as THREE from 'three';

// The garage. Each car has arcade stats (multipliers on CFG), a special
// perk, and a build() that assembles a low-poly body from primitives and
// returns anchor hints (wheels, exhausts, lights, collision extents).

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.45, ...o });

function B(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
function CYL(rt, rb, h, mat, x, y, z, seg = 10, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
function SPH(r, mat, x, y, z, ws = 12, hs = 8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
  m.position.set(x, y, z);
  return m;
}
function CONE(r, h, mat, x, y, z, seg = 10, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

const TRIM = () => std(0x241f1c, { metalness: 0.1, roughness: 0.85 });
const GLASS = () => std(0x513a3a, { metalness: 0.7, roughness: 0.18 });
const CHROME = () => std(0xd8d0c0, { metalness: 0.9, roughness: 0.2 });

const W4 = (hw, fz, rz, r = 0.42, w = 0.36) => ({
  wheels: [{ x: -hw, z: fz }, { x: hw, z: fz }, { x: -hw, z: rz }, { x: hw, z: rz }],
  wheelR: r, wheelW: w,
});

export const CARS = [
  {
    id: 'vortex', name: 'VORTEX GT', cls: 'SPORTS COUPE', color: '#c9402f',
    blurb: 'The all-rounder. Drift combos charge 40% faster.',
    stats: { top: 1.0, accel: 1.0, steer: 1.0, grip: 1.0, drift: 1.0 },
    perk: { driftGain: 1.4 },
    bars: { speed: 6, accel: 6, handling: 7, drift: 9 },
    engine: { base: 58, type: 'sawtooth' },
    build(body) {
      const paint = std(0xc9402f), dark = std(0x8e2b21), trim = TRIM(), glass = GLASS(), cream = std(0xf2e3c9, { metalness: 0, roughness: 0.6 });
      body.add(B(2.0, 0.5, 4.2, paint, 0, 0.55, 0));
      body.add(B(1.86, 0.34, 1.15, paint, 0, 0.5, -2.28, 0.14));
      body.add(B(1.86, 0.36, 0.9, dark, 0, 0.62, 2.05, -0.1));
      body.add(B(2.04, 0.14, 0.7, trim, 0, 0.34, -2.2));
      body.add(B(1.55, 0.5, 1.9, glass, 0, 1.02, 0.2));
      body.add(B(1.58, 0.1, 1.0, paint, 0, 1.3, 0.32));
      body.add(B(0.5, 0.03, 4.25, cream, 0, 0.815, -0.02));
      body.add(B(0.12, 0.3, 0.12, trim, -0.7, 0.98, 2.05));
      body.add(B(0.12, 0.3, 0.12, trim, 0.7, 0.98, 2.05));
      body.add(B(1.9, 0.08, 0.42, dark, 0, 1.14, 2.1));
      return { halfW: 1.0, halfL: 2.1, frontZ: -2.56, rearZ: 2.32, lightY: 0.62, brakeY: 0.72, brakeW: 1.7,
        exhaust: [[-0.5, 0.42, 2.32], [0.5, 0.42, 2.32]], ...W4(0.95, -1.45, 1.5) };
    },
  },
  {
    id: 'hellcat', name: 'HELLCAT 440', cls: 'MUSCLE', color: '#2b2b2b',
    blurb: 'Straight-line monster. Near misses refill DOUBLE nitro.',
    stats: { top: 1.12, accel: 1.12, steer: 0.8, grip: 0.9, drift: 1.1 },
    perk: { nearMissNitro: 2 },
    bars: { speed: 8, accel: 8, handling: 4, drift: 7 },
    engine: { base: 44, type: 'square' },
    build(body) {
      const paint = std(0x2b2b2b, { metalness: 0.5, roughness: 0.35 }), stripe = std(0xffb000, { metalness: 0.2, roughness: 0.5 }), trim = TRIM(), glass = GLASS(), chrome = CHROME();
      body.add(B(2.2, 0.62, 4.8, paint, 0, 0.6, 0));
      body.add(B(2.1, 0.3, 1.4, paint, 0, 0.62, -2.5, 0.08));
      body.add(B(1.7, 0.55, 2.2, glass, 0, 1.15, 0.3));
      body.add(B(1.75, 0.12, 1.4, paint, 0, 1.45, 0.4));
      body.add(B(0.9, 0.04, 4.9, stripe, 0, 0.92, 0));
      body.add(B(0.9, 0.25, 0.9, trim, 0, 1.0, -1.6)); // hood scoop
      body.add(B(2.3, 0.2, 0.3, chrome, 0, 0.42, -2.6)); // front bumper
      body.add(B(2.3, 0.2, 0.3, chrome, 0, 0.42, 2.4));
      body.add(B(2.0, 0.1, 0.5, trim, 0, 1.05, 2.3)); // ducktail
      return { halfW: 1.1, halfL: 2.4, frontZ: -2.72, rearZ: 2.56, lightY: 0.68, brakeY: 0.78, brakeW: 1.9,
        exhaust: [[-0.7, 0.35, 2.5], [0.7, 0.35, 2.5]], ...W4(1.05, -1.6, 1.7, 0.45, 0.42) };
    },
  },
  {
    id: 'stomper', name: 'STOMPER', cls: 'MONSTER TRUCK', color: '#3f8f3a',
    blurb: 'CRUSHES sedans, bikes and cones flat instead of crashing.',
    stats: { top: 0.86, accel: 0.82, steer: 0.9, grip: 1.25, drift: 0.7 },
    perk: { crush: true },
    bars: { speed: 4, accel: 4, handling: 6, drift: 3 },
    engine: { base: 36, type: 'square' },
    build(body) {
      const paint = std(0x3f8f3a), flame = std(0xffa030, { metalness: 0.1, roughness: 0.6 }), trim = TRIM(), glass = GLASS(), chrome = CHROME();
      body.add(B(2.2, 0.9, 4.4, paint, 0, 1.55, 0));
      body.add(B(2.0, 0.4, 1.3, paint, 0, 1.4, -2.3, 0.12));
      body.add(B(1.8, 0.7, 1.6, glass, 0, 2.3, -0.3));
      body.add(B(1.85, 0.12, 1.7, paint, 0, 2.7, -0.3));
      body.add(B(2.0, 0.35, 2.0, trim, 0, 1.25, 1.2)); // bed
      body.add(B(2.4, 0.25, 0.5, chrome, 0, 1.2, -2.5)); // bull bar
      body.add(B(0.16, 0.5, 0.16, chrome, -1.0, 1.55, -2.55));
      body.add(B(0.16, 0.5, 0.16, chrome, 1.0, 1.55, -2.55));
      body.add(B(2.24, 0.06, 1.2, flame, 0, 1.55, -1.2));
      body.add(B(0.9, 0.3, 0.3, chrome, 0, 2.9, -0.5)); // roof lights bar
      body.add(B(2.3, 0.3, 4.5, trim, 0, 1.05, 0)); // chassis
      body.add(B(0.3, 0.7, 0.3, trim, -0.9, 0.7, -1.7)); body.add(B(0.3, 0.7, 0.3, trim, 0.9, 0.7, -1.7));
      body.add(B(0.3, 0.7, 0.3, trim, -0.9, 0.7, 1.7)); body.add(B(0.3, 0.7, 0.3, trim, 0.9, 0.7, 1.7));
      body.add(CYL(0.12, 0.12, 1.2, chrome, -0.9, 2.4, 2.2)); body.add(CYL(0.12, 0.12, 1.2, chrome, 0.9, 2.4, 2.2)); // stacks
      return { halfW: 1.25, halfL: 2.35, frontZ: -2.62, rearZ: 2.28, lightY: 1.6, brakeY: 1.6, brakeW: 1.9,
        exhaust: [[-0.9, 3.0, 2.2], [0.9, 3.0, 2.2]], exhaustUp: true, ...W4(1.25, -1.6, 1.7, 0.85, 0.7), bodyLift: 0 };
    },
  },
  {
    id: 'viper', name: 'VIPER X1', cls: 'FORMULA', color: '#f0f0f0',
    blurb: 'Fastest thing on wheels. Near misses give SLIPSTREAM speed.',
    stats: { top: 1.26, accel: 1.2, steer: 1.18, grip: 1.25, drift: 0.5 },
    perk: { slipstream: 14 },
    bars: { speed: 10, accel: 9, handling: 9, drift: 2 },
    engine: { base: 88, type: 'sawtooth' },
    build(body) {
      const paint = std(0xf0f0f0, { metalness: 0.4, roughness: 0.3 }), red = std(0xd42020), trim = TRIM(), chrome = CHROME();
      body.add(B(0.9, 0.38, 3.2, paint, 0, 0.42, 0.2));          // tub
      body.add(B(0.7, 0.3, 1.6, paint, 0, 0.38, -2.2, 0.06));    // nose
      body.add(B(0.6, 0.25, 0.7, red, 0, 0.36, -2.9, 0.1));
      body.add(B(2.4, 0.06, 0.6, red, 0, 0.28, -2.7));           // front wing
      body.add(B(2.2, 0.06, 0.5, red, 0, 0.95, 2.0));            // rear wing
      body.add(B(0.08, 0.5, 0.4, trim, -0.9, 0.7, 2.0)); body.add(B(0.08, 0.5, 0.4, trim, 0.9, 0.7, 2.0));
      body.add(B(0.5, 0.42, 0.9, trim, 0, 0.72, 0.0));            // cockpit / driver
      body.add(SPH(0.22, red, 0, 0.9, 0.05, 8, 6));               // helmet
      body.add(B(0.9, 0.45, 0.5, paint, 0, 0.7, 0.6, -0.4));      // airbox
      body.add(B(1.2, 0.3, 1.8, paint, -0.7, 0.42, 0.6)); body.add(B(1.2, 0.3, 1.8, paint, 0.7, 0.42, 0.6)); // sidepods
      body.add(B(0.2, 0.1, 3.0, chrome, 0, 0.62, 0.2));
      return { halfW: 1.05, halfL: 2.0, frontZ: -3.25, rearZ: 2.25, lightY: 0.4, brakeY: 0.9, brakeW: 0.6,
        exhaust: [[-0.3, 0.55, 1.6], [0.3, 0.55, 1.6]], ...W4(1.0, -1.7, 1.45, 0.38, 0.42), lowProfile: true };
    },
  },
  {
    id: 'dunebug', name: 'DUNE BUG', cls: 'BUGGY', color: '#ffb000',
    blurb: 'Tiny, twitchy, and nitro regenerates 3x faster.',
    stats: { top: 0.9, accel: 1.15, steer: 1.32, grip: 1.1, drift: 1.2 },
    perk: { nitroRegen: 3 },
    bars: { speed: 5, accel: 7, handling: 10, drift: 8 },
    engine: { base: 70, type: 'triangle' },
    build(body) {
      const paint = std(0xffb000), trim = TRIM(), tube = std(0x333333, { metalness: 0.6, roughness: 0.4 }), red = std(0xd42020);
      body.add(B(1.5, 0.4, 2.8, paint, 0, 0.5, 0));
      body.add(B(1.4, 0.3, 0.9, paint, 0, 0.45, -1.7, 0.2));
      body.add(B(0.9, 0.35, 0.6, trim, 0, 0.85, 0.0));            // seats
      // roll cage
      for (const sx of [-0.6, 0.6]) {
        body.add(CYL(0.05, 0.05, 1.1, tube, sx, 1.2, -0.7, 6, 0.35));
        body.add(CYL(0.05, 0.05, 1.1, tube, sx, 1.2, 0.8, 6, -0.35));
        body.add(CYL(0.05, 0.05, 1.5, tube, sx, 1.7, 0.05, 6, Math.PI / 2));
      }
      body.add(CYL(0.05, 0.05, 1.3, tube, 0, 1.7, -0.7, 6, 0, 0, Math.PI / 2));
      body.add(CYL(0.05, 0.05, 1.3, tube, 0, 1.7, 0.8, 6, 0, 0, Math.PI / 2));
      body.add(B(0.7, 0.5, 0.6, trim, 0, 0.8, 1.35));             // engine block
      body.add(B(0.1, 0.9, 0.1, red, 0.5, 1.6, 1.4)); body.add(B(0.3, 0.2, 0.05, red, 0.5, 2.1, 1.4)); // flag
      return { halfW: 0.85, halfL: 1.55, frontZ: -2.0, rearZ: 1.7, lightY: 0.6, brakeY: 0.7, brakeW: 1.2,
        exhaust: [[-0.25, 0.55, 1.72], [0.25, 0.55, 1.72]], ...W4(0.85, -1.15, 1.1, 0.46, 0.4) };
    },
  },
  {
    id: 'hoverpod', name: 'HOVERPOD', cls: 'ANTI-GRAV', color: '#5ad8ff',
    blurb: 'No wheels. Floats. Jumps go 2x further with low gravity.',
    stats: { top: 1.02, accel: 1.05, steer: 1.1, grip: 0.85, drift: 1.3 },
    perk: { gravity: 0.45, jump: 1.25 },
    bars: { speed: 7, accel: 7, handling: 8, drift: 8 },
    engine: { base: 120, type: 'sine' },
    build(body) {
      const paint = std(0x5ad8ff, { metalness: 0.6, roughness: 0.25 }), dark = std(0x123a4a, { metalness: 0.5, roughness: 0.4 }), glass = std(0x9ff0ff, { metalness: 0.3, roughness: 0.1, transparent: true, opacity: 0.75 });
      const glow = new THREE.MeshStandardMaterial({ color: 0x5af0ff, emissive: 0x3ad0ff, emissiveIntensity: 1.8 });
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 10), paint);
      hull.scale.set(1.05, 0.42, 2.0); hull.position.y = 0.9; body.add(hull);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
      canopy.position.set(0, 1.05, -0.2); canopy.scale.set(1, 0.9, 1.4); body.add(canopy);
      body.add(B(0.9, 0.2, 0.8, dark, -1.15, 0.85, 0.5)); body.add(B(0.9, 0.2, 0.8, dark, 1.15, 0.85, 0.5)); // side pods
      body.add(B(0.4, 0.06, 0.8, glow, -1.15, 0.72, 0.5)); body.add(B(0.4, 0.06, 0.8, glow, 1.15, 0.72, 0.5));
      body.add(B(1.4, 0.08, 0.3, glow, 0, 0.62, 0.4));            // underglow strip
      body.add(B(0.14, 0.5, 0.14, dark, -0.6, 1.2, 1.7)); body.add(B(0.14, 0.5, 0.14, dark, 0.6, 1.2, 1.7));
      body.add(B(1.6, 0.06, 0.4, paint, 0, 1.45, 1.8));           // fin
      body.add(CYL(0.24, 0.3, 0.4, dark, -0.45, 0.85, 2.1, 10, Math.PI / 2));
      body.add(CYL(0.24, 0.3, 0.4, dark, 0.45, 0.85, 2.1, 10, Math.PI / 2));
      return { halfW: 1.1, halfL: 2.0, frontZ: -2.05, rearZ: 2.3, lightY: 0.9, brakeY: 0.95, brakeW: 1.2,
        exhaust: [[-0.45, 0.85, 2.3], [0.45, 0.85, 2.3]], wheels: [], hover: true, bodyLift: 0.5 };
    },
  },
  {
    id: 'juggernaut', name: 'JUGGERNAUT', cls: 'ARMORED', color: '#6b6f5a',
    blurb: 'Rolling bunker. Starts every run with 2 SHIELD charges.',
    stats: { top: 0.8, accel: 0.85, steer: 0.75, grip: 1.15, drift: 0.6 },
    perk: { armor: 2 },
    bars: { speed: 3, accel: 4, handling: 3, drift: 2 },
    engine: { base: 30, type: 'square' },
    build(body) {
      const paint = std(0x6b6f5a, { metalness: 0.2, roughness: 0.7 }), dark = std(0x3a3d30, { metalness: 0.2, roughness: 0.8 }), glass = std(0x2a3a2a, { metalness: 0.6, roughness: 0.3 }), hazard = std(0xffc020, { metalness: 0.1, roughness: 0.6 });
      body.add(B(2.4, 1.1, 4.6, paint, 0, 0.95, 0));
      body.add(B(2.2, 0.5, 1.1, paint, 0, 0.9, -2.5, 0.35));
      body.add(B(2.0, 0.55, 1.8, dark, 0, 1.75, 0.2));            // turret box
      body.add(B(1.9, 0.25, 0.5, glass, 0, 1.45, -1.2));          // slit
      body.add(CYL(0.12, 0.12, 2.0, dark, 0.3, 1.85, -0.6, 8, Math.PI / 2)); // cannon
      body.add(B(2.6, 0.5, 4.8, dark, 0, 0.45, 0));               // skirts
      body.add(B(2.5, 0.12, 0.6, hazard, 0, 0.5, -2.7)); body.add(B(2.5, 0.12, 0.6, hazard, 0, 0.5, 2.5));
      body.add(B(0.3, 0.3, 0.3, dark, -0.9, 2.15, 0.6)); body.add(B(0.3, 0.3, 0.3, dark, 0.9, 2.15, 0.6));
      body.add(CYL(0.08, 0.08, 1.4, dark, -0.9, 2.6, 1.6, 6));    // antenna
      return { halfW: 1.3, halfL: 2.4, frontZ: -2.78, rearZ: 2.4, lightY: 0.9, brakeY: 0.9, brakeW: 2.0,
        exhaust: [[-0.8, 0.5, 2.5], [0.8, 0.5, 2.5]], wheels: [
          { x: -1.15, z: -1.6 }, { x: 1.15, z: -1.6 }, { x: -1.15, z: 1.6 }, { x: 1.15, z: 1.6 },
          { x: -1.15, z: 0 }, { x: 1.15, z: 0 }], wheelR: 0.5, wheelW: 0.5 };
    },
  },
  {
    id: 'nuke', name: 'NUKE RANGER', cls: 'ROCKET CAR', color: '#ff4a1a',
    blurb: 'A jet engine on wheels. Nitro top speed is DOUBLED.',
    stats: { top: 1.08, accel: 1.1, steer: 0.88, grip: 0.95, drift: 0.9 },
    perk: { nitroBonus: 2.2, nitroDrain: 1.45 },
    bars: { speed: 9, accel: 8, handling: 5, drift: 5 },
    engine: { base: 64, type: 'sawtooth' },
    build(body) {
      const paint = std(0xff4a1a, { metalness: 0.5, roughness: 0.3 }), white = std(0xf4f4f4), dark = TRIM(), glass = GLASS(), chrome = CHROME();
      const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 4.6, 12), paint);
      fus.rotation.x = Math.PI / 2; fus.position.set(0, 0.75, 0); body.add(fus);
      body.add(CONE(0.5, 1.2, white, 0, 0.75, -2.9, 12, -Math.PI / 2));
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.56, 1.5, 12), dark);
      jet.rotation.x = Math.PI / 2; jet.position.set(0, 0.8, 2.1); body.add(jet);
      const jetIn = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0xff8030, emissive: 0xff5010, emissiveIntensity: 1.6 }));
      jetIn.rotation.x = Math.PI / 2; jetIn.position.set(0, 0.8, 2.85); body.add(jetIn);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), glass);
      canopy.scale.set(1, 0.8, 1.6); canopy.position.set(0, 1.25, -0.6); body.add(canopy);
      body.add(B(2.2, 0.06, 0.8, white, 0, 0.5, 1.2)); // stub wings
      body.add(B(0.08, 0.9, 0.7, white, 0, 1.6, 1.6)); // tail fin
      body.add(B(0.4, 0.5, 0.5, chrome, 0, 0.55, 1.4));
      return { halfW: 1.0, halfL: 2.4, frontZ: -3.4, rearZ: 2.9, lightY: 0.75, brakeY: 0.95, brakeW: 0.8,
        exhaust: [[-0.22, 0.8, 2.9], [0.22, 0.8, 2.9]], bigFlames: true, ...W4(0.95, -1.5, 1.45, 0.4, 0.34) };
    },
  },
  {
    id: 'sprinkle', name: 'SPRINKLE VAN', cls: 'ICE CREAM', color: '#ff8fc0',
    blurb: 'Jingle jingle. Every coin is worth 3x. Handles like a fridge.',
    stats: { top: 0.9, accel: 0.9, steer: 0.82, grip: 1.05, drift: 0.9 },
    perk: { coinMult: 3 },
    bars: { speed: 5, accel: 5, handling: 4, drift: 5 },
    engine: { base: 50, type: 'triangle' },
    build(body) {
      const paint = std(0xffffff, { metalness: 0.1, roughness: 0.6 }), pink = std(0xff8fc0, { metalness: 0.1, roughness: 0.6 }), mint = std(0x8fe8d0, { metalness: 0.1, roughness: 0.6 }), glass = std(0x6a8aa8, { metalness: 0.6, roughness: 0.2 }), cone = std(0xd8a060, { roughness: 0.8 }), cherry = std(0xe02040);
      body.add(B(2.1, 1.5, 4.4, paint, 0, 1.15, 0.3));
      body.add(B(2.0, 0.7, 1.0, paint, 0, 0.75, -2.3));
      body.add(B(1.9, 0.7, 0.9, glass, 0, 1.5, -1.9));
      body.add(B(2.12, 0.5, 4.42, pink, 0, 0.6, 0.3));
      body.add(B(2.12, 0.2, 4.42, mint, 0, 1.7, 0.3));
      body.add(B(0.05, 0.8, 1.8, glass, 1.06, 1.3, 0.8));          // serving window
      body.add(B(0.05, 0.8, 1.8, glass, -1.06, 1.3, 0.8));
      body.add(CONE(0.32, 0.9, cone, 0, 2.2, 0.4, 10, Math.PI));   // big cone on roof
      body.add(SPH(0.36, pink, 0, 2.85, 0.4)); body.add(SPH(0.3, mint, 0, 3.3, 0.4)); body.add(SPH(0.1, cherry, 0, 3.62, 0.4));
      return { halfW: 1.1, halfL: 2.3, frontZ: -2.82, rearZ: 2.52, lightY: 0.7, brakeY: 0.95, brakeW: 1.8,
        exhaust: [[-0.6, 0.35, 2.5], [0.6, 0.35, 2.5]], ...W4(1.0, -1.55, 1.65, 0.42, 0.36) };
    },
  },
];

export const CAR_BY_ID = Object.fromEntries(CARS.map((c) => [c.id, c]));
