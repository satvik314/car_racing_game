// Shared tuning constants for Sunset Overdrive Highway
export const CFG = {
  roadWidth: 16,
  laneXs: [-5.25, -1.75, 1.75, 5.25],

  baseMaxSpeed: 80,        // world units / s at game start
  maxSpeedGrowth: 16,      // extra top speed earned over distance
  nitroBonus: 22,          // extra top speed while nitro is held
  accel: 21,
  brake: 46,
  coastDrag: 5.5,

  steerLow: 13.5,          // lateral units/s at low speed (tight)
  steerHigh: 8.0,          // lateral units/s at top speed (loose)
  gripNormal: 9.0,         // how fast lateral velocity tracks target
  gripDrift: 1.6,          // low grip while drifting -> slide

  gravity: 34,
  jumpVy: 14,

  playerHalfW: 1.0,        // overwritten by the selected car
  playerHalfL: 2.1,
  nearMissMinSpeed: 32,

  spawnZ: -430,
  killZ: 42,
  worldLen: 474,           // spawn->kill recycle distance

  kmhScale: 4.0,           // display units -> km/h

  // power-up durations (seconds)
  fx: {
    magnet: 9, ghost: 6, slowmo: 5, x2: 12, giant: 7, mega: 6,
  },
  rocketAmmo: 3,
  chaosInterval: 35,       // seconds between world shifts in CHAOS mode
};

// Fallback traffic palette (themes override this)
export const TRAFFIC_COLORS = [0xa85638, 0x8f4a3a, 0xb98a5a, 0x7d7a5a, 0x6e6259, 0x96503f, 0xc2a06a, 0x5f6e5a, 0x9c6b52];

// Power-up catalogue (id -> HUD label, colour, popup text)
export const POWERUPS = {
  shield:   { label: 'SHIELD',  short: 'SHLD', color: 0x5ad8ff, hex: '#5ad8ff', text: 'SHIELD UP' },
  magnet:   { label: 'MAGNET',  short: 'MAG',  color: 0xff4fd8, hex: '#ff4fd8', text: 'COIN MAGNET' },
  ghost:    { label: 'GHOST',   short: 'GHST', color: 0xd0d0ff, hex: '#d0d0ff', text: 'GHOST MODE' },
  slowmo:   { label: 'SLOW-MO', short: 'SLOW', color: 0x8fe8ff, hex: '#8fe8ff', text: 'BULLET TIME' },
  x2:       { label: '2X SCORE', short: '2X',  color: 0xffe066, hex: '#ffe066', text: 'DOUBLE SCORE' },
  rocket:   { label: 'ROCKETS', short: 'RKT',  color: 0xff6a1a, hex: '#ff6a1a', text: '+3 ROCKETS' },
  giant:    { label: 'GIANT',   short: 'BIG',  color: 0x9dff8a, hex: '#9dff8a', text: 'GIANT MODE' },
  coinrain: { label: 'COIN RAIN', short: 'RAIN', color: 0xf7c948, hex: '#f7c948', text: 'COIN RAIN!' },
  mega:     { label: 'MEGA NITRO', short: 'MEGA', color: 0xff9a3a, hex: '#ff9a3a', text: 'MEGA NITRO' },
};
