import * as THREE from 'three';
import { CFG } from './config.js';
import { World } from './world.js';
import { PlayerCar } from './car.js';
import { Traffic } from './traffic.js';
import { Pickups } from './pickups.js';
import { Particles } from './particles.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';

// ============================================================ renderer
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 3.7, 8.6);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================ systems
const world = new World(scene);
const car = new PlayerCar(scene);
const traffic = new Traffic(scene);
const pickups = new Pickups(scene);
const particles = new Particles(scene);
const audio = new AudioSys();
const input = new Input();
const ui = new UI(input, audio, () => { if (state === 'menu' || state === 'gameover') startGame(); });

// debug/test autopilot: open with ?auto to self-drive (gas, weaving, nitro/drift pulses)
if (new URLSearchParams(location.search).has('auto')) {
  let at = 0;
  Object.defineProperty(input, 'gas', { get: () => true });
  Object.defineProperty(input, 'steer', {
    get: () => {
      const v = Math.sin(at * 0.55);
      return v > 0.45 ? 1 : v < -0.45 ? -1 : 0;
    },
  });
  Object.defineProperty(input, 'nitro', { get: () => Math.sin(at * 0.21) > 0.75 });
  Object.defineProperty(input, 'drift', { get: () => Math.sin(at * 0.34) > 0.88 });
  setInterval(() => { at += 0.1; }, 100);
  setTimeout(() => {
    if (state === 'menu') startGame();
    if (new URLSearchParams(location.search).has('warp')) {
      player.speed = 60; dist = 3200; // jump straight into dense/fast late-game
    }
  }, 600);
}

// tap anywhere on menu / gameover overlays to start
document.getElementById('menu').addEventListener('click', () => { if (state === 'menu') startGame(); });
document.getElementById('gameover').addEventListener('click', () => { if (state === 'gameover') startGame(); });

// ============================================================ game state
let state = 'menu'; // menu | playing | paused | crash | gameover
let best = parseInt(localStorage.getItem('sunset-overdrive-best') || '0', 10) || 0;

const player = {
  x: 0, y: 0, vx: 0, vy: 0, speed: 0,
  grounded: true, airTime: 0, steering: 0,
};

let score = 0, dist = 0, nitro = 60, mult = 1;
let drifting = false, driftSlip = false, driftTime = 0, driftGain = 0, driftTickT = 0, multGraceT = 0;
let nitroActive = false;
let timeScale = 1, crashTimer = 0, crashSpin = 0;
let shake = 0, camFov = 62;
let skidTimer = 0, exhaustTimer = 0;

const events = { crash: null, nearMiss: false, coins: 0, nitro: 0, ramp: false };
const carState = { x: 0, y: 0, steer: 0, vx: 0, speed: 0, drifting: false, braking: false, gas: false, grounded: true, crashed: false, crashSpin: 0 };
const tmpV = new THREE.Vector3();

function difficulty() { return Math.min(1, dist / 5200); }
function topSpeed() {
  return CFG.baseMaxSpeed + Math.min(CFG.maxSpeedGrowth, dist * 0.0035) + (nitroActive ? CFG.nitroBonus : 0);
}

function resetGame() {
  player.x = 0; player.y = 0; player.vx = 0; player.vy = 0;
  player.speed = 14; player.grounded = true; player.airTime = 0;
  score = 0; dist = 0; nitro = 60; mult = 1;
  drifting = false; driftSlip = false; driftTime = 0; driftGain = 0; multGraceT = 0;
  nitroActive = false; timeScale = 1; shake = 0;
  car.group.rotation.set(0, 0, 0);
  car.body.rotation.set(0, 0, 0);
  world.reset();
  traffic.reset();
  pickups.reset();
}

function startGame() {
  audio.ensure();
  audio.ui();
  resetGame();
  state = 'playing';
  ui.showHUD();
}

function gameOver() {
  state = 'gameover';
  timeScale = 1;
  audio.setEngine(false, 0, false);
  audio.setDrift(false);
  audio.setNitro(false);
  const finalScore = Math.round(score);
  const isNew = finalScore > best;
  if (isNew) {
    best = finalScore;
    localStorage.setItem('sunset-overdrive-best', String(best));
  }
  ui.showGameOver(finalScore, best, isNew);
}

// discrete key actions
input.onAction = (a) => {
  audio.ensure();
  if (a === 'mute') { ui.setMuted(audio.toggleMute()); return; }
  if (a === 'enter') {
    if (state === 'menu' || state === 'gameover') startGame();
    else if (state === 'paused') togglePause();
  } else if (a === 'pause') {
    if (state === 'playing' || state === 'paused') togglePause();
  }
};

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    ui.showPause(true);
    audio.ui();
    audio.setEngine(false, 0, false);
    audio.setDrift(false);
    audio.setNitro(false);
  } else if (state === 'paused') {
    state = 'playing';
    ui.showPause(false);
    audio.ui();
  }
}

// ============================================================ crash
function beginCrash(v) {
  state = 'crash';
  crashTimer = 0;
  timeScale = 0.13;
  crashSpin = (player.x < v.x ? -1 : 1) * (4 + Math.random() * 3);
  shake = 1.6;
  const mx = (player.x + v.x) / 2;
  particles.sparks(mx, 0.8, 0, 30);
  particles.dustBurst(mx, 0.4, 0, 10);
  audio.crash();
  audio.setDrift(false);
  audio.setNitro(false);
  ui.popup('CRASH!', 'big');
}

// ============================================================ update
function updatePlaying(dt) {
  const s01 = Math.min(1, player.speed / 100);

  // ---- nitro
  nitroActive = input.nitro && nitro > 0.5;
  if (nitroActive) nitro = Math.max(0, nitro - 30 * dt);
  else nitro = Math.min(100, nitro + 3.2 * dt);

  // ---- longitudinal
  const top = topSpeed();
  if (input.gas) player.speed += CFG.accel * dt;
  else player.speed -= CFG.coastDrag * dt;
  if (input.brake) player.speed -= CFG.brake * dt;
  if (nitroActive) player.speed += CFG.accel * 1.7 * dt;
  player.speed = THREE.MathUtils.clamp(player.speed, 0, top);

  // ---- steering / drift
  const wantDrift = (input.drift || (input.brake && input.steer !== 0)) && player.speed > 22 && player.grounded;
  if (wantDrift && !drifting) drifting = true;
  if (!wantDrift) drifting = false;

  const steerAuthority = THREE.MathUtils.lerp(CFG.steerLow, CFG.steerHigh, s01) * Math.min(1, player.speed / 14);
  const targetVx = input.steer * steerAuthority * (drifting ? 1.35 : 1);
  const grip = drifting ? CFG.gripDrift : CFG.gripNormal;
  player.vx += (targetVx - player.vx) * Math.min(1, grip * dt);
  player.x += player.vx * dt;

  const maxX = CFG.roadWidth / 2 - 1.25;
  if (player.x > maxX) { player.x = maxX; player.vx = Math.min(0, player.vx * -0.25); }
  if (player.x < -maxX) { player.x = -maxX; player.vx = Math.max(0, player.vx * -0.25); }

  // ---- drift combo
  driftSlip = drifting && Math.abs(player.vx) > 3.5;
  if (driftSlip) {
    driftTime += dt;
    driftTickT += dt;
    const gain = 55 * mult * dt;
    driftGain += gain;
    score += gain;
    if (driftTickT > 1.1) {
      driftTickT = 0;
      if (mult < 8) {
        mult++;
        ui.popup('DRIFT x' + mult, 'drift');
        audio.driftTick();
      }
    }
    // smoke + skid marks at rear wheels
    skidTimer -= dt;
    if (skidTimer <= 0) {
      skidTimer = 0.035;
      for (const left of [true, false]) {
        car.rearWheelPos(tmpV, left);
        world.addSkid(tmpV.x, tmpV.z);
        particles.tireSmoke(tmpV.x, 0.15, tmpV.z, 1);
      }
    }
  } else if (driftTime > 0) {
    if (driftTime > 0.7 && driftGain > 20) ui.popup('DRIFT +' + Math.round(driftGain), 'drift');
    driftTime = 0; driftGain = 0; driftTickT = 0;
    multGraceT = 1.6; // multiplier lingers briefly
  }
  if (multGraceT > 0) {
    multGraceT -= dt;
    if (multGraceT <= 0) mult = 1;
  }

  // ---- air
  if (!player.grounded) {
    player.vy -= CFG.gravity * dt;
    player.y += player.vy * dt;
    player.airTime += dt;
    if (player.y <= 0) {
      player.y = 0; player.vy = 0; player.grounded = true;
      car.landBounce(1);
      particles.dustBurst(player.x, 0.1, 0, 14);
      audio.land();
      if (player.airTime > 0.35) {
        const bonus = Math.round(player.airTime * 220) * mult;
        score += bonus;
        ui.popup('AIR TIME +' + bonus, 'air');
        if (traffic.hasNear(player.x, 0, 9)) {
          score += 200 * mult;
          ui.popup('CLOSE LANDING +' + 200 * mult, 'near');
        }
      }
      player.airTime = 0;
    }
  }

  // ---- world + traffic + pickups
  world.update(dt, player.speed);
  events.crash = null; events.nearMiss = false; events.coins = 0; events.nitro = 0; events.ramp = false;
  traffic.update(dt, player.speed, player.x, player.y, false, difficulty(), events);
  pickups.update(dt, player.speed, player, events);

  if (events.crash) { beginCrash(events.crash); }
  if (events.nearMiss) {
    const bonus = 150 * mult;
    score += bonus;
    nitro = Math.min(100, nitro + 12);
    ui.popup('NEAR MISS +' + bonus, 'near');
    audio.nearMiss();
  }
  for (let i = 0; i < events.coins; i++) {
    score += 25 * mult;
    audio.coin();
    particles.coinSparkle(events.coinX, events.coinY, events.coinZ);
  }
  if (events.coins > 0) ui.popup('+' + 25 * mult * events.coins, 'coin');
  if (events.nitro > 0) {
    nitro = Math.min(100, nitro + 40);
    ui.popup('NITRO +', 'nitro');
    audio.nitroPickup();
  }
  if (events.ramp && player.grounded) {
    player.grounded = false;
    player.vy = CFG.jumpVy;
    player.airTime = 0;
    audio.jump();
    particles.dustBurst(player.x, 0.2, 1.5, 8);
  }

  // ---- score / distance
  dist += player.speed * dt;
  score += player.speed * dt * (0.5 + 0.12 * mult);

  // ---- exhaust / nitro flames
  exhaustTimer -= dt;
  if (exhaustTimer <= 0) {
    exhaustTimer = nitroActive ? 0.016 : (input.gas ? 0.09 : 0.22);
    for (const left of [true, false]) {
      car.exhaustPos(tmpV, left);
      if (nitroActive) particles.nitroFlame(tmpV.x, tmpV.y, tmpV.z);
      else if (input.gas && player.grounded) particles.exhaust(tmpV.x, tmpV.y, tmpV.z);
    }
  }

  // ---- car visuals
  carState.x = player.x; carState.y = player.y; carState.steer = input.steer;
  carState.vx = player.vx; carState.speed = player.speed; carState.drifting = drifting;
  carState.braking = input.brake; carState.gas = input.gas;
  carState.grounded = player.grounded; carState.crashed = false; carState.crashSpin = 0;
  car.update(dt, carState);

  particles.update(dt, player.speed);

  // ---- audio
  audio.setEngine(true, s01, nitroActive);
  audio.setDrift(driftSlip);
  audio.setNitro(nitroActive);

  // ---- camera shake floor (decay happens in updateCamera)
  shake = Math.max(shake, nitroActive ? 0.16 : s01 > 0.8 ? 0.05 : 0);
}

function updateCrash(dtReal) {
  crashTimer += dtReal;
  const dt = dtReal * timeScale;
  player.speed = Math.max(0, player.speed - 40 * dtReal);
  player.x += player.vx * dt;
  world.update(dt, player.speed);
  traffic.update(dt, player.speed, player.x, player.y, true, difficulty(), events);
  pickups.update(dt, player.speed, player, events);
  carState.x = player.x; carState.y = player.y; carState.steer = 0; carState.vx = player.vx;
  carState.speed = player.speed; carState.drifting = false; carState.braking = true;
  carState.gas = false; carState.grounded = true; carState.crashed = true; carState.crashSpin = crashSpin;
  car.update(dtReal, carState);
  particles.update(dtReal, player.speed);
  if (Math.random() < 0.3) particles.sparks(player.x, 0.6, 0, 3);
  audio.setEngine(true, Math.min(1, player.speed / 100) * 0.4, false);
  if (crashTimer > 1.5) gameOver();
}

function updateMenu(dt) {
  world.update(dt, 16);
  particles.update(dt, 16);
  carState.x = 0; carState.y = 0; carState.steer = 0; carState.vx = 0; carState.speed = 0;
  carState.drifting = false; carState.braking = false; carState.gas = false;
  carState.grounded = true; carState.crashed = false; carState.crashSpin = 0;
  car.update(dt, carState);
}

// ============================================================ camera
function updateCamera(dt) {
  shake = Math.max(0, shake * (1 - 2.5 * dt) - 0.01 * dt);
  const s01 = Math.min(1, player.speed / 100);
  const tx = player.x * 0.55;
  const ty = 3.7 + player.y * 0.35;
  camera.position.x += (tx - camera.position.x) * Math.min(1, 6 * dt);
  camera.position.y += (ty - camera.position.y) * Math.min(1, 6 * dt);
  camera.position.z = 8.6;
  if (shake > 0.005) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * shake * 0.35;
  }
  camera.lookAt(player.x * 0.7, 1.25 + player.y * 0.3, -8);
  const targetFov = 62 + s01 * 11 + (nitroActive ? 9 : 0);
  camFov += (targetFov - camFov) * Math.min(1, 5 * dt);
  if (Math.abs(camFov - camera.fov) > 0.05) {
    camera.fov = camFov;
    camera.updateProjectionMatrix();
  }
}

// ============================================================ loop
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dtReal = Math.min(0.05, clock.getDelta());
  const dt = dtReal * timeScale;

  if (state === 'playing') updatePlaying(dt);
  else if (state === 'crash') updateCrash(dtReal);
  else if (state === 'menu') updateMenu(dtReal);
  else if (state === 'gameover') { world.update(dtReal, 5); particles.update(dtReal, 5); }
  // paused: render frozen frame

  if (state !== 'paused') updateCamera(dtReal);

  if (state === 'playing' || state === 'crash') {
    ui.update(player.speed * CFG.kmhScale, score, mult, nitro / 100, dist / 1000, nitroActive);
  }

  renderer.render(scene, camera);
}

ui.showMenu(best);
frame();
