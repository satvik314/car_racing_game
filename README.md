# Sunset Overdrive — CHAOS EDITION

An endless arcade racer built with Three.js (no build step, no external assets, everything is
procedurally generated in code, including the audio). Open `app/index.html` from any static
server and go.

## Worlds

Pick a world in the garage (`↑ ↓` or `T`). Each one re-skins the sky, lighting, road, scenery,
weather and traffic paint, and has its own synth soundtrack.

| World | What's different |
| --- | --- |
| **Sunset Highway** | Route 77 at golden hour. Cacti, palms, billboards, dunes. |
| **Neon City** | Midnight synthwave. Glowing towers, holograms, rain, retro sun with scanlines, neon grid ground. |
| **Frozen Tundra** | Snow, aurora, pines, ice crystals, igloos. Ice road: grip is cut to 62%. |
| **Inferno** | Volcanoes, lava rivers, fire geysers, dead trees, skull piles, rising embers. |
| **Lunar Run** | Craters, moon bases, landers, Earth and a ringed planet in the sky. Gravity is 32%, jumps go forever. |
| **Candy Kingdom** | Lollipops, candy canes, donuts, cupcakes, ice-cream towers, rainbow sprinkles. Slightly floaty. |
| **CHAOS MODE** | Starts in a random world and shifts to a new one every 35 seconds, with a bonus each shift. |

## Garage

Pick a car with `← →` or `C`. Stats multiply the base handling model; every car has a perk.

| Car | Class | Perk |
| --- | --- | --- |
| **Vortex GT** | Sports coupe | Drift combos charge 40% faster. |
| **Hellcat 440** | Muscle | Near misses refill double nitro. |
| **Stomper** | Monster truck | Crushes sedans, bikes, rival racers and cones instead of crashing. |
| **Viper X1** | Formula | Fastest car. Near misses grant a slipstream speed burst. |
| **Dune Bug** | Buggy | Nitro regenerates 3x faster. Twitchiest steering. |
| **Hoverpod** | Anti-grav | No wheels. 45% gravity, higher jumps, immune to oil slicks. |
| **Juggernaut** | Armored | Starts every run with 2 shield charges. |
| **Nuke Ranger** | Rocket car | Nitro top speed is more than doubled (drains faster). |
| **Sprinkle Van** | Ice cream | Every coin is worth 3x. |

## Power-ups (glowing crates on the road)

| Crate | Effect |
| --- | --- |
| **SHLD** | Shield charge (stacks to 3). Absorbs one crash or barrel. |
| **MAG** | Coin magnet with a huge pull radius for 9 s. |
| **GHST** | Ghost mode: phase through traffic for 6 s. |
| **SLOW** | Bullet time: the world slows to 42% for 5 s, your steering doesn't. |
| **2X** | Double score for 12 s. |
| **RKT** | +3 rockets. Fire with `X` / `F`. Auto-aim, blow up anything ahead. |
| **BIG** | Giant mode for 7 s: 2x size, squash every vehicle you touch. |
| **RAIN** | Coin rain: 36 coins dumped across the road ahead. |
| **MEGA** | Mega nitro: infinite, stronger nitro for 6 s. |

## Hazards

Traffic cones (knock them for points, they slow you a bit), oil slicks (spin-out), and explosive
barrels (a crash unless you're shielded, ghosted or giant; shoot them for a chain reaction).
Traffic now includes buses, motorbikes, police cruisers and rival sports cars that swerve into
your lane to block you.

## Controls

| Key | Action |
| --- | --- |
| `← →` / `A D` | Steer |
| `↑` / `W` | Gas |
| `↓` / `S` | Brake (brake + steer = drift) |
| `SHIFT` | Drift |
| `SPACE` | Nitro |
| `X` / `F` / `E` / `CTRL` | Fire rocket |
| `P` / `ESC` | Pause (ESC on the wrecked screen returns to the garage) |
| `M` | Mute |

Touch controls appear automatically on phones.

## Debug

`?auto` self-drives. `?theme=neon&car=viper` preselects. `?warp` jumps to late-game difficulty.
`?auto&power=giant,rocket` applies power-ups on start.
