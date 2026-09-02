# Plan — Crazy 3D Car Racing Game (Three.js)

## Goal
A fun, polished, playable browser racing game built with Three.js, delivered as a static website (previewable via version card).

## Stage 1 — Skill loading & approach
- Load `vibecoding-webapp-swarm` SKILL.md to check delivery guidance.
- Decision: Three.js game is framework-agnostic → single-page vanilla HTML/JS game with Three.js via CDN (import maps). No React needed.

## Stage 2 — Game implementation (coder subagent)
- Spawn `coder` subagent to build the game in `/mnt/agents/output/crazy-racing/`
- Game spec:
  - `index.html` entry; Three.js + addons via CDN import map (no build step)
  - Endless/desert-highway arcade racer with:
    - Player car with arcade physics (acceleration, steering, drift, boost/Nitro)
    - AI traffic cars to dodge + rival racers to overtake
    - Procedurally generated track segments, scenery (buildings, mountains, cacti), day-sunset lighting, fog
    - Speedometer HUD, score/distance, boost meter, minimap-free simple UI
    - Jump ramps, coin/boost pickups, near-miss bonus
    - Sound effects via WebAudio (synthesized, no external assets)
    - Start menu, pause, game-over screen, restart
    - Keyboard controls (arrows/WASD, Space boost, P pause) + basic touch controls
  - All visuals generated procedurally in code (low-poly stylized, low-saturation warm palette per default standards)

## Stage 3 — Validation (verifier subagent)
- Verifier loads the page headless, checks: no console errors, scene renders, controls wired, game loop runs.

## Stage 4 — Delivery
- Call `website_version_manager` (type: `html`, project_dir = game folder containing index.html)
- Report to user with version card + controls summary.
