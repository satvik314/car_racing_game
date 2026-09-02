import * as THREE from 'three';
import { CFG, POWERUPS } from './config.js';
import { THEMES, THEME_CHOICES } from './themes.js';
import { CARS } from './cars.js';
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

// ============================================================ garage selection (persisted)
const params = new URLSearchParams(location.search);
let sel = { car: 0, theme: 0 };
try { sel = { ...sel, ...JSON.parse(localStorage.getItem('so-garage') || '{}') }; } catch (e) { /* ignore */ }
if (params.has('car')) sel.car = Math.max(0, CARS.findIndex((c) => c.id === params.get('car')));
if (params.has('theme')) sel.theme = Math.max(0, THEME_CHOICES.findIndex((t) => t.id === params.get('theme')));
sel.car = ((sel.car % CARS.length) + CARS.length) % CARS.length;
sel.theme = ((sel.theme % THEME_CHOICES.length) + THEME_CHOICES.length) % THEME_CHOICES.length;
const saveSel = () => localStorage.setItem('so-garage', JSON.stringify(sel));

// ============================================================ systems
const world = new World(scene, renderer);
const car = new PlayerCar(scene, CARS[sel.car]);
const traffic = new Traffic(scene);
const pickups = new Pickups(scene);
const particles = new Particles(scene);
const audio = new AudioSys();
const input = new Input();
const ui = new UI(input, audio, {
  onStart: () => { if (state === 'menu' || state === 'gameover') startGame(); },
  onGarageChange: (what, dir) => garageChange(what, dir),
});

// ============================================================ game state
let state = 'menu'; // menu | playing | paused | crash | gameover
let best = parseInt(localStorage.getItem('sunset-overdrive-best') || '0', 10) || 0;

const player = { x: 0, y: 0, vx: 0, vy: 0, speed: 0, grounded: true, airTime: 0, scale: 1 };

let carDef = CARS[sel.car], stats = carDef.stats, perk = carDef.perk;
let theme = THEMES[0], chaosMode = false, chaosTimer = 0, menuPreviewT = 0, worldsVisited = 1;

let score = 0, dist = 0, nitro = 60, mult = 1, kills = 0, topKmh = 0;
let drifting = false, driftSlip = false, driftTime = 0, driftGain = 0, driftTickT = 0, multGraceT = 0;
let nitroActive = false;
let timeScale = 1, crashTimer = 0, crashSpin = 0;
let shake = 0, camFov = 62;
let skidTimer = 0, exhaustTimer = 0, stompTimer = 0;

// power-ups / add-ons
const fx = { magnet: 0, ghost: 0, slowmo: 0, x2: 0, giant: 0, mega: 0 };
let shield = 0, ammo = 0, oilT = 0, slipT = 0;
const rockets = [];
const ROCKET_POOL = 4;
for (let i = 0; i < ROCKET_POOL; i++) {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: 0xff6a1a, emissive: 0xff3a00, emissiveIntensity: 0.9, metalness: 0.4 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 8), bodyM); b.rotation.x = Math.PI / 2; g.add(b);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xffe066 })); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.8; g.add(tip);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.3), bodyM);
    fin.position.set(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.5); fin.rotation.z = a; g.add(fin);
  }
  g.visible = false; scene.add(g);
  rockets.push({ mesh: g, active: false, x: 0, y: 0, z: 0, life: 0, target: null });
}

const events = { crash: null, nearMiss: false, coins: 0, nitro: 0, ramp: false, power: null, cones: 0, oil: false, barrel: null, crushed: 0 };
const carState = { x: 0, y: 0, steer: 0, vx: 0, speed: 0, drifting: false, braking: false, gas: false, grounded: true, crashed: false, crashSpin: 0 };
const trafficOpts = { ghost: false, giant: false, crush: false, halfW: 1, halfL: 2, scale: 1 };
const hud = { fx: [], bonusMult: 1, kills: 0, ammo: 0, shield: 0, mega: false, vignette: '' };
const tmpV = new THREE.Vector3();

const bonusMult = () => (fx.x2 > 0 ? 2 : 1);
function difficulty() { return Math.min(1, dist / 5200); }
function topSpeed() {
  const base = (CFG.baseMaxSpeed + Math.min(CFG.maxSpeedGrowth, dist * 0.0035)) * stats.top;
  const nb = nitroActive ? CFG.nitroBonus * (perk.nitroBonus || 1) * (fx.mega > 0 ? 1.5 : 1) : 0;
  const slip = slipT > 0 ? (perk.slipstream || 0) : 0;
  return base + nb + slip;
}

// ============================================================ theme / car switching
function applyTheme(t, announce) {
  theme = t;
  world.setTheme(t);
  traffic.setColors(t.traffic);
  audio.setMusic(t.music);
  ui.setAccent(t.accent);
  if (announce) {
    ui.flash();
    ui.themeToast(t.name);
    audio.themeShift();
  }
}

function applyCar(def) {
  carDef = def; stats = def.stats; perk = def.perk;
  car.setCar(def);
  CFG.playerHalfW = car.halfW; CFG.playerHalfL = car.halfL;
  audio.setEngineProfile(def.engine);
}

function garageChange(what, dir) {
  if (state !== 'menu') return;
  audio.ensure(); audio.nav();
  if (what === 'car') {
    sel.car = (sel.car + dir + CARS.length) % CARS.length;
    applyCar(CARS[sel.car]);
  } else {
    sel.theme = (sel.theme + dir + THEME_CHOICES.length) % THEME_CHOICES.length;
    const t = THEME_CHOICES[sel.theme];
    if (t.chaos) { menuPreviewT = 0; applyTheme(THEMES[(Math.random() * THEMES.length) | 0], false); ui.setAccent(t.accent); }
    else applyTheme(t, false);
  }
  saveSel();
  ui.renderGarage(CARS, THEME_CHOICES, sel.car, sel.theme);
}

// ============================================================ start / reset / over
function resetGame() {
  player.x = 0; player.y = 0; player.vx = 0; player.vy = 0;
  player.speed = 14; player.grounded = true; player.airTime = 0; player.scale = 1;
  score = 0; dist = 0; nitro = 60; mult = 1; kills = 0; topKmh = 0;
  drifting = false; driftSlip = false; driftTime = 0; driftGain = 0; multGraceT = 0;
  nitroActive = false; timeScale = 1; shake = 0; oilT = 0; slipT = 0;
  for (const k in fx) fx[k] = 0;
  ammo = 0;
  shield = perk.armor || 0;
  car.setShield(shield > 0); car.setGhost(false); car.setScale(1);
  car.group.rotation.set(0, 0, 0);
  car.body.rotation.set(0, 0, 0);
  for (const r of rockets) { r.active = false; r.mesh.visible = false; }
  audio.setSlowMo(false);
  world.reset();
  traffic.reset();
  pickups.reset();
  worldsVisited = 1;
  const choice = THEME_CHOICES[sel.theme];
  chaosMode = !!choice.chaos;
  if (chaosMode) {
    applyTheme(THEMES[(Math.random() * THEMES.length) | 0], true);
    chaosTimer = CFG.chaosInterval;
  } else if (theme !== choice) applyTheme(choice, false);
}

function startGame() {
  audio.ensure();
  audio.ui();
  resetGame();
  state = 'playing';
  ui.showHUD();
  audio.startMusic();
  if (shield > 0) ui.popup('ARMOR x' + shield, 'shield');
}

function gameOver() {
  state = 'gameover';
  timeScale = 1;
  audio.setEngine(false, 0, false);
  audio.setDrift(false);
  audio.setNitro(false);
  audio.setSlowMo(false);
  audio.stopMusic();
  const finalScore = Math.round(score);
  const isNew = finalScore > best;
  if (isNew) {
    best = finalScore;
    localStorage.setItem('sunset-overdrive-best', String(best));
  }
  ui.showGameOver(finalScore, best, isNew, { dist: dist / 1000, kills, top: topKmh, worlds: worldsVisited });
}

function backToMenu() {
  state = 'menu';
  audio.stopMusic();
  ui.showMenu(best);
  ui.renderGarage(CARS, THEME_CHOICES, sel.car, sel.theme);
  car.setScale(1); car.setGhost(false); car.setShield(false);
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
    else if (state === 'gameover') backToMenu();
  } else if (a === 'fire') {
    if (state === 'playing') fireRocket();
  } else if (state === 'menu') {
    if (a === 'navLeft') garageChange('car', -1);
    else if (a === 'navRight') garageChange('car', 1);
    else if (a === 'navUp') garageChange('theme', -1);
    else if (a === 'navDown') garageChange('theme', 1);
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
    audio.stopMusic();
  } else if (state === 'paused') {
    state = 'playing';
    ui.showPause(false);
    audio.ui();
    audio.startMusic();
  }
}

// ============================================================ power-ups
function applyPower(type, x, z) {
  const info = POWERUPS[type];
  particles.powerBurst(x, 0.5, z, ((info.color >> 16) & 255) / 255, ((info.color >> 8) & 255) / 255, (info.color & 255) / 255);
  ui.popup(info.text, 'power', info.hex);
  switch (type) {
    case 'shield': shield = Math.min(3, shield + 1); car.setShield(true); audio.shieldUp(); break;
    case 'magnet': fx.magnet = CFG.fx.magnet; pickups.magnetRange = 16; audio.powerup(); break;
    case 'ghost': fx.ghost = CFG.fx.ghost; car.setGhost(true); audio.ghost(); break;
    case 'slowmo': fx.slowmo = CFG.fx.slowmo; audio.slowIn(); audio.setSlowMo(true); break;
    case 'x2': fx.x2 = CFG.fx.x2; audio.powerup(); break;
    case 'rocket': ammo += CFG.rocketAmmo; audio.powerup(); break;
    case 'giant': fx.giant = CFG.fx.giant; car.setScale(2.0); audio.giantUp(); shake = 1.2; break;
    case 'coinrain': pickups.coinRain(); audio.coinRain(); particles.confetti(player.x, 1, -4, 60); break;
    case 'mega': fx.mega = CFG.fx.mega; nitro = 100; audio.nitroPickup(); break;
  }
}

function tickEffects(dt) {
  for (const k in fx) {
    if (fx[k] <= 0) continue;
    fx[k] -= dt;
    if (fx[k] > 0) continue;
    fx[k] = 0;
    if (k === 'magnet') pickups.magnetRange = 3.2;
    if (k === 'ghost') car.setGhost(false);
    if (k === 'slowmo') { audio.slowOut(); audio.setSlowMo(false); }
    if (k === 'giant') { car.setScale(1); particles.stomp(player.x, 0, 1.5); }
  }
  if (slipT > 0) slipT -= dt;
  if (oilT > 0) oilT -= dt;
  player.scale = car.scaleCur;
}

function wreck(v, dirX, label, points) {
  if (!traffic.destroy(v, dirX)) return;
  particles.explosion(v.x, 0.6, v.z, v.kind === 'truck' || v.kind === 'bus' ? 1.6 : 1);
  score += points;
  kills++;
  ui.popup(label + ' +' + points, 'boom');
  shake = Math.max(shake, 0.9);
}

function explodeAt(x, z, radius, scale = 1.6) {
  particles.explosion(x, 0.6, z, scale);
  audio.explosion();
  shake = Math.max(shake, 1.3);
  for (const v of traffic.pool) {
    if (!v.active || v.dying) continue;
    if (Math.abs(v.x - x) < radius && Math.abs(v.z - z) < radius) wreck(v, Math.sign(v.x - x) || 1, 'BLAST', 400 * mult * bonusMult());
  }
}

function fireRocket() {
  if (ammo <= 0) { ui.popup('NO ROCKETS', 'warn'); return; }
  const r = rockets.find((p) => !p.active);
  if (!r) return;
  ammo--;
  r.active = true; r.mesh.visible = true;
  r.x = player.x; r.y = 0.8 + (car.bodyLift || 0); r.z = -car.halfL - 1; r.life = 2.6;
  r.target = traffic.nearestAhead(player.x, 7);
  r.mesh.position.set(r.x, r.y, r.z);
  audio.rocket();
  shake = Math.max(shake, 0.35);
}

function updateRockets(dt) {
  for (const r of rockets) {
    if (!r.active) continue;
    r.life -= dt;
    r.z -= 130 * dt;
    if (r.target && r.target.active && !r.target.dying) r.x += (r.target.x - r.x) * Math.min(1, 6 * dt);
    r.mesh.position.set(r.x, r.y, r.z);
    r.mesh.rotation.z += 12 * dt;
    particles.rocketTrail(r.x, r.y, r.z + 0.7);
    const hit = traffic.hitAt(r.x, r.z, 1.0);
    const barrel = pickups.barrelAt(r.x, r.z, 1.4);
    if (hit || barrel) {
      r.active = false; r.mesh.visible = false;
      if (barrel) { pickups.popBarrel(barrel); explodeAt(barrel.x, barrel.z, 8, 2); ui.popup('KABOOM!', 'boom'); }
      if (hit) { wreck(hit, 0, 'DIRECT HIT', 500 * mult * bonusMult()); audio.explosion(); }
      continue;
    }
    if (r.life <= 0 || r.z < -320) { r.active = false; r.mesh.visible = false; }
  }
}

// ============================================================ crash
function beginCrash(vx, label = 'CRASH!') {
  state = 'crash';
  crashTimer = 0;
  timeScale = 0.13;
  crashSpin = (player.x < vx ? -1 : 1) * (4 + Math.random() * 3);
  shake = 1.6;
  const mx = (player.x + vx) / 2;
  particles.sparks(mx, 0.8, 0, 30);
  particles.dustBurst(mx, 0.4, 0, 10);
  audio.crash();
  audio.setDrift(false);
  audio.setNitro(false);
  audio.setSlowMo(false);
  audio.stopMusic();
  car.setGhost(false);
  ui.popup(label, 'big');
}

function absorbHit(x, z, what) {
  // shield takes the hit
  shield--;
  car.shieldPop();
  if (shield <= 0) car.setShield(false);
  particles.shieldBurst(player.x, 0, 0);
  audio.shieldHit();
  shake = Math.max(shake, 1.0);
  ui.popup('SHIELD SAVED YOU', 'shield');
  player.speed *= 0.8;
}

// ============================================================ update
function updatePlaying(dt) {
  tickEffects(dt);
  const slow = fx.slowmo > 0 ? 0.42 : 1;
  const dw = dt * slow; // world time (bullet time slows the world, not the driver)
  const giant = fx.giant > 0;
  const s01 = Math.min(1, player.speed / 100);

  // ---- nitro
  nitroActive = input.nitro && (nitro > 0.5 || fx.mega > 0);
  if (nitroActive && fx.mega <= 0) nitro = Math.max(0, nitro - 30 * (perk.nitroDrain || 1) * dt);
  else if (!nitroActive) nitro = Math.min(100, nitro + 3.2 * (perk.nitroRegen || 1) * dt);
  if (fx.mega > 0) nitro = 100;

  // ---- longitudinal
  const top = topSpeed();
  const accel = CFG.accel * stats.accel;
  if (input.gas) player.speed += accel * dt;
  else player.speed -= CFG.coastDrag * dt;
  if (input.brake) player.speed -= CFG.brake * dt;
  if (nitroActive) player.speed += accel * 1.7 * dt;
  player.speed = THREE.MathUtils.clamp(player.speed, 0, Math.max(top, player.speed - 30 * dt));
  topKmh = Math.max(topKmh, player.speed * CFG.kmhScale);

  // ---- steering / drift
  const wantDrift = (input.drift || (input.brake && input.steer !== 0)) && player.speed > 22 && player.grounded;
  if (wantDrift && !drifting) drifting = true;
  if (!wantDrift) drifting = false;

  const steerAuthority = THREE.MathUtils.lerp(CFG.steerLow, CFG.steerHigh, s01) * Math.min(1, player.speed / 14) * stats.steer;
  const targetVx = oilT > 0 ? player.vx : input.steer * steerAuthority * (drifting ? 1.35 * stats.drift : 1);
  const gripMul = stats.grip * (theme.gripMult || 1);
  const grip = oilT > 0 ? 0.4 : (drifting ? CFG.gripDrift : CFG.gripNormal) * gripMul;
  player.vx += (targetVx - player.vx) * Math.min(1, grip * dt);
  player.x += player.vx * dt;

  const maxX = CFG.roadWidth / 2 - 1.25 * (giant ? 1.6 : 1);
  if (player.x > maxX) { player.x = maxX; player.vx = Math.min(0, player.vx * -0.25); }
  if (player.x < -maxX) { player.x = -maxX; player.vx = Math.max(0, player.vx * -0.25); }

  // ---- drift combo
  driftSlip = (drifting && Math.abs(player.vx) > 3.5) || (oilT > 0 && Math.abs(player.vx) > 2);
  if (driftSlip) {
    driftTime += dt;
    driftTickT += dt;
    const gain = 55 * (perk.driftGain || 1) * mult * bonusMult() * dt;
    driftGain += gain;
    score += gain;
    if (driftTickT > 1.1 / (perk.driftGain || 1)) {
      driftTickT = 0;
      if (mult < 8) {
        mult++;
        ui.popup('DRIFT x' + mult, 'drift');
        audio.driftTick();
      }
    }
    skidTimer -= dt;
    if (skidTimer <= 0 && !car.hover) {
      skidTimer = 0.035;
      for (const left of [true, false]) {
        car.rearWheelPos(tmpV, left);
        world.addSkid(tmpV.x, tmpV.z);
        particles.tireSmoke(tmpV.x, 0.15, tmpV.z, giant ? 2 : 1);
      }
    }
  } else if (driftTime > 0) {
    if (driftTime > 0.7 && driftGain > 20) ui.popup('DRIFT +' + Math.round(driftGain), 'drift');
    driftTime = 0; driftGain = 0; driftTickT = 0;
    multGraceT = 1.6;
  }
  if (multGraceT > 0) {
    multGraceT -= dt;
    if (multGraceT <= 0) mult = 1;
  }

  // ---- air
  const gravity = CFG.gravity * (theme.gravity || 1) * (perk.gravity || 1);
  if (!player.grounded) {
    player.vy -= gravity * dt;
    player.y += player.vy * dt;
    player.airTime += dt;
    if (player.y <= 0) {
      player.y = 0; player.vy = 0; player.grounded = true;
      car.landBounce(1);
      particles.dustBurst(player.x, 0.1, 0, 14);
      audio.land();
      if (giant) { particles.stomp(player.x, 0, 2.3); audio.stomp(); shake = Math.max(shake, 1.2); }
      if (player.airTime > 0.35) {
        const bonus = Math.round(player.airTime * 220) * mult * bonusMult();
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

  // ---- world + traffic + pickups (world time)
  world.update(dw, player.speed);
  events.crash = null; events.nearMiss = false; events.coins = 0; events.nitro = 0; events.ramp = false;
  events.power = null; events.cones = 0; events.oil = false; events.barrel = null; events.crushed = 0;
  trafficOpts.ghost = fx.ghost > 0; trafficOpts.giant = giant; trafficOpts.crush = !!perk.crush;
  trafficOpts.halfW = car.halfW; trafficOpts.halfL = car.halfL; trafficOpts.scale = car.scaleCur;
  traffic.update(dw, player.speed, player.x, player.y, false, difficulty(), events, trafficOpts);
  pickups.update(dw, player.speed, player, events, difficulty());
  updateRockets(dw);

  // ---- resolve events
  if (events.crash) {
    const v = events.crash;
    if (shield > 0) {
      absorbHit(v.x, v.z);
      traffic.destroy(v, Math.sign(v.x - player.x) || 1);
      particles.explosion(v.x, 0.6, v.z, 1);
      kills++;
    } else beginCrash(v.x);
  }
  if (events.barrel) {
    const b = events.barrel;
    if (giant) { explodeAt(b.x, b.z, 8, 2); ui.popup('KABOOM!', 'boom'); score += 300 * mult * bonusMult(); }
    else if (fx.ghost > 0) { /* phase through */ }
    else if (shield > 0) { absorbHit(b.x, b.z); explodeAt(b.x, b.z, 8, 2); }
    else { explodeAt(b.x, b.z, 8, 2); beginCrash(b.x, 'KABOOM!'); }
  }
  if (events.crushed > 0) {
    for (let i = 0; i < events.crushed; i++) {
      const pts = (giant ? 350 : 250) * mult * bonusMult();
      score += pts; kills++;
      ui.popup((giant ? 'SQUASHED' : 'CRUSHED') + ' +' + pts, 'crush');
    }
    audio.crush();
    shake = Math.max(shake, giant ? 0.8 : 0.5);
    if (!giant) player.speed = Math.max(20, player.speed - 6);
    particles.sparks(player.x, 0.5, -1, 14);
  }
  if (events.nearMiss) {
    const bonus = 150 * mult * bonusMult();
    score += bonus;
    nitro = Math.min(100, nitro + 12 * (perk.nearMissNitro || 1));
    ui.popup('NEAR MISS +' + bonus, 'near');
    audio.nearMiss();
    if (perk.slipstream) { slipT = 2.5; ui.popup('SLIPSTREAM!', 'nitro'); }
  }
  if (events.coins > 0) {
    const each = 25 * mult * bonusMult() * (perk.coinMult || 1);
    for (let i = 0; i < events.coins; i++) { score += each; audio.coin(); particles.coinSparkle(events.coinX, events.coinY, events.coinZ); }
    ui.popup('+' + each * events.coins, 'coin');
  }
  if (events.nitro > 0) {
    nitro = Math.min(100, nitro + 40);
    ui.popup('NITRO +', 'nitro');
    audio.nitroPickup();
  }
  if (events.power) applyPower(events.power, events.powerX, events.powerZ);
  if (events.cones > 0) {
    const pts = 30 * mult * bonusMult() * events.cones;
    score += pts;
    ui.popup('CONE +' + pts, 'coin');
    audio.cone();
    particles.dustBurst(events.coneX, 0.2, events.coneZ, 6);
    if (!giant && !perk.crush) player.speed = Math.max(0, player.speed - 3 * events.cones);
  }
  if (events.oil && !giant && !car.hover) {
    oilT = 0.9;
    player.vx += (Math.random() < 0.5 ? -1 : 1) * 9;
    ui.popup('OIL SLICK!', 'warn');
    audio.oil();
  }
  if (events.ramp && player.grounded) {
    player.grounded = false;
    player.vy = CFG.jumpVy * (theme.jumpMult || 1) * (perk.jump || 1) * (giant ? 1.15 : 1);
    player.airTime = 0;
    audio.jump();
    particles.dustBurst(player.x, 0.2, 1.5, 8);
  }

  // ---- chaos mode world shifts
  if (chaosMode && state === 'playing') {
    chaosTimer -= dt;
    if (chaosTimer <= 0) {
      chaosTimer = CFG.chaosInterval;
      let next = theme;
      while (next === theme) next = THEMES[(Math.random() * THEMES.length) | 0];
      applyTheme(next, true);
      worldsVisited++;
      score += 500 * mult;
      ui.popup('WORLD SHIFT +' + 500 * mult, 'power', next.accent);
    } else if (chaosTimer < 3 && Math.ceil(chaosTimer) !== Math.ceil(chaosTimer + dt)) {
      ui.popup('SHIFT IN ' + Math.ceil(chaosTimer), 'warn');
    }
  }

  // ---- score / distance
  dist += player.speed * dw;
  score += player.speed * dw * (0.5 + 0.12 * mult) * bonusMult();

  // ---- exhaust / nitro flames / hover glow
  exhaustTimer -= dt;
  if (exhaustTimer <= 0) {
    exhaustTimer = nitroActive ? 0.016 : (input.gas ? 0.09 : 0.22);
    const big = (car.hints.bigFlames ? 1.8 : 1) * (giant ? 2 : 1) * (fx.mega > 0 ? 1.4 : 1);
    for (const left of [true, false]) {
      car.exhaustPos(tmpV, left);
      if (nitroActive) particles.nitroFlame(tmpV.x, tmpV.y, tmpV.z, big);
      else if (input.gas && player.grounded) particles.exhaust(tmpV.x, tmpV.y, tmpV.z);
    }
    if (car.hover) particles.hoverGlow(player.x, 0.25 + player.y, 0);
  }
  if (giant) {
    stompTimer -= dt;
    if (stompTimer <= 0 && player.grounded) { stompTimer = 0.42; particles.stomp(player.x, 1.5, 1.2); shake = Math.max(shake, 0.25); }
  }

  // ---- car visuals
  carState.x = player.x; carState.y = player.y; carState.steer = input.steer;
  carState.vx = player.vx; carState.speed = player.speed; carState.drifting = drifting;
  carState.braking = input.brake; carState.gas = input.gas;
  carState.grounded = player.grounded; carState.crashed = false; carState.crashSpin = 0;
  car.update(dt, carState);
  if (oilT > 0) car.group.rotation.y += Math.sin(oilT * 14) * 0.9 * dt * 8;

  particles.update(dw, player.speed);

  // ---- audio
  audio.setEngine(true, s01, nitroActive);
  audio.setDrift(driftSlip);
  audio.setNitro(nitroActive);

  shake = Math.max(shake, nitroActive ? 0.16 : s01 > 0.8 ? 0.05 : 0);
}

function updateCrash(dtReal) {
  crashTimer += dtReal;
  const dt = dtReal * timeScale;
  player.speed = Math.max(0, player.speed - 40 * dtReal);
  player.x += player.vx * dt;
  world.update(dt, player.speed);
  traffic.update(dt, player.speed, player.x, player.y, true, difficulty(), events, trafficOpts);
  pickups.update(dt, player.speed, player, events, difficulty());
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
  carState.x = 0; carState.y = 0; carState.steer = 0; carState.vx = 0; carState.speed = 8;
  carState.drifting = false; carState.braking = false; carState.gas = false;
  carState.grounded = true; carState.crashed = false; carState.crashSpin = 0;
  car.update(dt, carState);
  // chaos preview: cycle worlds while it's selected
  if (THEME_CHOICES[sel.theme].chaos) {
    menuPreviewT += dt;
    if (menuPreviewT > 3) {
      menuPreviewT = 0;
      let next = theme;
      while (next === theme) next = THEMES[(Math.random() * THEMES.length) | 0];
      applyTheme(next, false);
      ui.setAccent('#ffffff');
    }
  }
}

// ============================================================ camera
function updateCamera(dt) {
  shake = Math.max(0, shake * (1 - 2.5 * dt) - 0.01 * dt);
  const s01 = Math.min(1, player.speed / 100);
  const big = (car.scaleCur - 1);
  const tx = player.x * 0.55;
  const ty = 3.7 + player.y * 0.35 + big * 6.5;
  camera.position.x += (tx - camera.position.x) * Math.min(1, 6 * dt);
  camera.position.y += (ty - camera.position.y) * Math.min(1, 6 * dt);
  camera.position.z += ((8.6 + big * 11) - camera.position.z) * Math.min(1, 6 * dt);
  if (shake > 0.005) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.5;
    camera.position.y += (Math.random() - 0.5) * shake * 0.35;
  }
  camera.lookAt(player.x * 0.7, 1.25 + player.y * 0.3 + big * 2.5, -8 - big * 6);
  const targetFov = 62 + s01 * 11 + (nitroActive ? 9 : 0) + (fx.slowmo > 0 ? -8 : 0);
  camFov += (targetFov - camFov) * Math.min(1, 5 * dt);
  if (Math.abs(camFov - camera.fov) > 0.05) {
    camera.fov = camFov;
    camera.updateProjectionMatrix();
  }
}

// ============================================================ HUD packing
function packHud() {
  hud.fx.length = 0;
  for (const k of ['magnet', 'ghost', 'slowmo', 'x2', 'giant', 'mega']) {
    if (fx[k] > 0) hud.fx.push({ id: k, label: POWERUPS[k].label, color: POWERUPS[k].hex, t01: fx[k] / CFG.fx[k] });
  }
  hud.bonusMult = bonusMult();
  hud.kills = kills; hud.ammo = ammo; hud.shield = shield; hud.mega = fx.mega > 0;
  hud.vignette = fx.slowmo > 0 ? 'slowmo' : fx.ghost > 0 ? 'ghost' : fx.giant > 0 ? 'giant' : oilT > 0 ? 'danger' : (nitroActive ? 'nitro' : '');
  return hud;
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

  if (state !== 'paused') updateCamera(dtReal);

  if (state === 'playing' || state === 'crash') {
    ui.update(player.speed * CFG.kmhScale, score, mult, nitro / 100, dist / 1000, nitroActive, packHud());
  }

  renderer.render(scene, camera);
}

// ============================================================ boot
applyCar(CARS[sel.car]);
{
  const t = THEME_CHOICES[sel.theme];
  if (t.chaos) { applyTheme(THEMES[(Math.random() * THEMES.length) | 0], false); ui.setAccent(t.accent); }
  else applyTheme(t, false);
}
ui.renderGarage(CARS, THEME_CHOICES, sel.car, sel.theme);
ui.showMenu(best);

// debug/test autopilot: open with ?auto to self-drive (gas, weaving, nitro/drift/fire pulses)
if (params.has('auto')) {
  let at = 0;
  Object.defineProperty(input, 'gas', { get: () => true });
  Object.defineProperty(input, 'steer', {
    get: () => { const v = Math.sin(at * 0.55); return v > 0.45 ? 1 : v < -0.45 ? -1 : 0; },
  });
  Object.defineProperty(input, 'nitro', { get: () => Math.sin(at * 0.21) > 0.75 });
  Object.defineProperty(input, 'drift', { get: () => Math.sin(at * 0.34) > 0.88 });
  setInterval(() => { at += 0.1; if (state === 'playing' && Math.random() < 0.05) fireRocket(); }, 100);
  setTimeout(() => {
    if (state === 'menu') startGame();
    if (params.has('warp')) { player.speed = 60; dist = 3200; }
    if (params.has('power')) { for (const p of params.get('power').split(',')) applyPower(p, 0, -5); }
  }, 600);
  window.__game = {
    get state() { return state; }, get score() { return score; }, get dist() { return dist; }, get kills() { return kills; },
    get fx() { return fx; }, get shield() { return shield; }, get ammo() { return ammo; }, get theme() { return theme; },
    get worlds() { return worldsVisited; }, get player() { return player; },
    applyPower, applyTheme, THEMES, fire: fireRocket, traffic, pickups,
    // drop a live traffic vehicle directly ahead of the player (for tests)
    spawnAhead(kind, z = -30) {
      const v = traffic.pool.find((p) => !p.active && p.kind === kind);
      if (!v) return false;
      v.active = true; v.dying = 0; v.mesh.visible = true; v.mesh.rotation.set(0, 0, 0); v.mesh.position.y = 0;
      v.lane = 1; v.x = player.x; v.targetX = v.x; v.z = z; v.prevZ = z; v.passed = false; v.speed = 0; v.laneTimer = 99;
      return true;
    },
    shiftNow() { chaosTimer = 0.001; },
    setSpeed(s) { player.speed = s; },
  };
}

frame();
