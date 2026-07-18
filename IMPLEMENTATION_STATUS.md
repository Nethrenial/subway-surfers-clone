# Implementation Status

Last updated: 2026-07-18

## Current Playable Build

Neon Relay opens on a complete main menu and runs as an endless three-lane courier trial. The player can switch lanes, jump, forward-roll, collect common and rare signal currency, acquire four power-ups, survive one collision with a shield, pause, configure audio, view a run summary, and restart. Blender-authored assets, hierarchical humanoid motion, fixed-track chase framing, route-aware hazards and rewards, procedural audio, safely recycled city modules, varied run seeds, deterministic test hooks, and responsive presentation are integrated.

## Stage Checklist

### Stage 1: Playable Foundation

Status: complete and verified.

- [x] Vite, strict TypeScript, and Three.js project setup
- [x] Portrait 9:16 viewport centered on desktop and responsive on mobile
- [x] Single game loop and responsive renderer
- [x] Original procedural courier avatar
- [x] Three-lane movement with queued target changes
- [x] Jumping with buffered airborne jump intent
- [x] Rolling with airborne fast-fall behavior
- [x] Keyboard controls and touch swipes
- [x] Recycled endless track segments
- [x] Barrier, hurdle, and overhead-gate hazards
- [x] Seeded fair pattern generation with at least one safe lane per row
- [x] Swept collision detection for frame-spike resilience
- [x] Distance, score, and gradual speed increase
- [x] Pause, game-over, and immediate restart flow
- [x] Deterministic diagnostics and test hooks
- [x] Desktop and mobile browser interaction tests
- [x] Canvas pixel and renderer-budget inspection

Verification evidence:

- `npm run build`: pass
- `npm run verify:visual`: 3 passed; desktop and mobile interaction loops plus a real seeded collision/restart path
- Desktop canvas: nonblank, no console/page errors, 142 calls, 2,108 triangles
- Mobile canvas: nonblank, no console/page errors, 146 calls, 2,156 triangles
- Screenshots: `artifacts/stage1-desktop/desktop-active-play.png` and `artifacts/stage1-mobile/mobile-active-play.png` (generated locally and ignored by Git)

### Stage 2: Gameplay Depth

Status: complete and verified.

- [x] Instanced common collectible trails and rare five-value shards
- [x] Raised collectible arcs and lane trails for route teaching/risk-reward
- [x] Moving lane-sweeping drone hazards
- [x] Large long-collider transit train hazards
- [x] Magnet, shield, score multiplier, and jump-boost powers
- [x] Different powers coexist; same-type pickup refreshes duration; shield is consumed on one collision
- [x] Active duration HUD and multiplier/currency feedback
- [x] Pure pattern grammar with one guaranteed safe lane per hazard row
- [x] Object pools for collectible data, power-up pickups, and burst effects
- [x] Instanced rendering for collectibles and particles
- [x] Shared merged track-marking geometry to preserve mobile render headroom
- [x] Trauma, flash, HUD punch, particles, and shield recovery feedback
- [x] Unit tests for pooling, scoring, gestures, player transitions, power-up rules, and generator safety
- [x] Real browser tests for collection, power pickup, multiplier state, and shielded collision

Verification evidence:

- `npm run build`: pass under strict TypeScript
- `npm test`: 16 unit assertions and 4 active browser integration tests passed
- Procedural safety: 10,000 seeded generations plus hazard-family coverage passed
- Desktop active canvas: nonblank, no console/page errors, 121 calls, 9,052 triangles, 37 geometries
- Mobile active canvas: nonblank, no console/page errors, 121 calls, 8,956 triangles, 37 geometries
- Mobile draw calls reduced from the pre-optimization 149 to 121
- Screenshots: `artifacts/stage2-desktop/desktop-active-play.png` and `artifacts/stage2-mobile/mobile-active-play.png` (generated locally and ignored by Git)

Deferred from Stage 2 without blocking its loop: near-miss/combo scoring, jetpack/elevated traversal, and speed bonuses are additional depth rather than requirements for the implemented collectible/power-up loop.

### Stage 3: Presentation

Status: complete and verified at the premium gate.

- [x] Credential probe and external asset sourcing ledger
- [x] Original Blender courier source and game-ready GLB
- [x] Authored barrier, hurdle, gate, drone, and train GLBs
- [x] Authored reward, power-up, and modular world kits
- [x] Runtime GLB loading, normalization, hierarchical joint animation, diagnostics, and fallback handling
- [x] Shared runtime PBR roles, procedural panel/track textures, and pivot-safe material batching
- [x] Scrolling district modules with grounded platforms, fog-hidden distance culling, and six modules batched into two recyclers
- [x] Imported asset browser assertions and loading-screen transition
- [x] Neutral tone mapping, one shadow-casting key, controlled practical/rim lighting, fog, and desktop-only bloom
- [x] Character animation for run cycle, airborne pose, hip-pivot roll, landing compression, lane lean, crash, pack, and signal ribbon
- [x] Fixed-track chase camera with body-driven lateral lane-cut motion
- [x] Player-relative jump, roll, either-action, and lane-avoidance obstacle profiles
- [x] Offscreen train scheduling with uninterrupted visible motion and reserved future hazard/reward lanes
- [x] Persistent safe-corridor grammar with one pressure row per segment and measured recovery transitions
- [x] Duration-based lane motion plus time-correlated swept X/Y/Z collision intervals
- [x] Serial per-coin magnet capture arcs with frame-partition coverage at minimum and maximum speed
- [x] Fresh production run seeds with deterministic visual and browser-test hooks
- [x] Full-batch city recycling after the final child module clears the camera
- [x] Moving trains, hovering/rotating drones, gate teeth, hurdle blade, warning motion, and deterministic hazard showcase
- [x] Instanced burst particles, speed streaks, shoe trails, and shield shell
- [x] Procedural Web Audio music, ambience, movement, pickup, threat, and UI matrix with grouped volume controls
- [x] Full menu, loading, settings, pause, failure, safe-area, and polished HUD states
- [x] 20-state desktop/mobile visual regression harness
- [x] Ten-category fresh-eyes scorecard: `23/30`, premium pass, showcase not claimed

Verification evidence:

- `npm run build`: pass under strict TypeScript
- `npm run test:unit`: 36 assertions passed across 11 files
- `npm run verify:visual`: 7 active browser tests passed; 5 viewport-independent mobile duplicates intentionally skipped
- Visual regression: 20 desktop/mobile baselines passed
- Desktop active canvas: 116 calls, 183,822 triangles, 91 geometries, 19 textures, 2 post passes, 8.35 ms smoothed frame time
- Mobile active canvas: 102 calls, 183,808 triangles, 90 geometries, 6 textures, 0 post passes, 10.55 ms smoothed frame time
- Both tiers: nonblank canvas, within renderer budgets, no console/page errors
- Maximum-speed live route soak: generated train entered; zero full-lane walls, train/content overlaps, train velocity discontinuities, or premature train recycling

### Stage 4: Progression

Status: not started.

- [ ] Versioned and validated local save data
- [ ] Currency, experience, levels, statistics, and high scores
- [ ] Missions, daily missions, and achievements
- [ ] Unlockable courier variants, boards, and trails
- [ ] Power-up upgrades and shop
- [ ] Run rewards and milestone feedback
- [ ] Save migration, progression, mission, and reward unit tests

### Stage 5: Optimization And Release Polish

Status: not started.

- [ ] Low, medium, high, and auto quality presets
- [ ] Adaptive DPR and measured frame-time response
- [x] Instanced track decks and material-batched scenery reduce mobile calls without visible LOD switching
- [ ] Accessibility and reduced-motion controls
- [x] Compact non-obscuring onboarding hint with input-triggered dismissal
- [ ] Visibility, focus, rotation, and rapid-input edge cases
- [ ] Two-minute bot playtest and procedural fairness soak test
- [x] Visual regression baselines
- [ ] Production preview, static-host verification, bundle review, and release report

## Known Bugs And Risks

- No known Stage 1 or Stage 2 blocking bug after automated desktop/mobile verification.
- The Stage 3 pass satisfies the premium scorecard but not the showcase gate; repeated city modules, reward vocabulary, and restrained impact VFX are the largest remaining visual gaps.
- Mobile active play uses 102 calls against the 150-call hard budget after the humanoid and route-planning corrections.
- Physical iOS and Android touch/audio/performance checks have not yet run.
- Full two-minute bot playtesting remains a Stage 5 release task.

## Next Highest-Priority Work

1. Implement versioned local progression, missions, high scores, unlocks, and shop systems.
2. Add progression and migration tests before exposing persistent save data.
3. Expand environment and reward variation during Stage 5 only where measured budgets permit.
4. Run physical-device and two-minute bot playtests before a release-ready claim.
