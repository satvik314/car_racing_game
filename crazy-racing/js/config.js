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

  playerHalfW: 1.0,
  playerHalfL: 2.1,
  nearMissMinSpeed: 32,

  spawnZ: -430,
  killZ: 42,
  worldLen: 474,           // spawn->kill recycle distance

  kmhScale: 4.0,           // display units -> km/h
};

// Warm muted vehicle colors (no blue/purple)
export const TRAFFIC_COLORS = [0xa85638, 0x8f4a3a, 0xb98a5a, 0x7d7a5a, 0x6e6259, 0x96503f, 0xc2a06a, 0x5f6e5a, 0x9c6b52];
