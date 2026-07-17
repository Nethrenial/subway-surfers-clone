# Implementation Status

Last updated: 2026-07-18

## Current Playable Build

Neon Relay currently launches directly into an endless three-lane run. The player can switch lanes, jump, roll, collect common and rare signal currency, acquire four power-ups, survive one collision with a shield, pause, view a run summary, and restart. Track segments, obstacles, pickups, and effects are pooled; coin trails and particles are instanced; patterns are seeded; every hazard row retains a safe lane; and speed increases over time.

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

Status: not started.

Work is intentionally paused before this stage while Blender and Blender MCP are configured. Stage 3 must inspect and use that pipeline where it improves hero pickups, obstacles, trains, drones, and environment modules.

- [ ] Credential probe and external asset sourcing ledger
- [ ] Original hero character concept and game-ready generated/imported asset, if credentials allow
- [ ] District art direction, authored environment kit, and animated scenery
- [ ] Character animation controller
- [ ] Material library, particles, speed lines, and reward VFX
- [ ] Production lighting, shadow tiers, fog, and render diagnostics
- [ ] Generated or permissively licensed music and SFX
- [ ] Full menu, loading, settings, selection, and polished HUD states
- [ ] Ten-category visual scorecard and fresh-eyes review

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
- [ ] Instanced or merged scenery to reduce mobile draw calls
- [ ] Accessibility and reduced-motion controls
- [ ] Onboarding and tutorial sequence
- [ ] Visibility, focus, rotation, and rapid-input edge cases
- [ ] Two-minute bot playtest and procedural fairness soak test
- [ ] Visual regression baselines
- [ ] Production preview, static-host verification, bundle review, and release report

## Known Bugs And Risks

- No known Stage 1 or Stage 2 blocking bug after automated desktop/mobile verification.
- The current obstacle visuals are deliberately foundation-grade and do not satisfy the final premium visual scorecard.
- Static side scenery does not recycle yet and can make long runs feel visually repetitive.
- Mobile active-play uses 121 calls against the initial 150-call target, leaving 29 calls of starting headroom for the first graphics pass.
- Physical iOS and Android touch/audio/performance checks have not yet run.
- Full two-minute playtesting and long-run fairness testing are deferred until Stage 2 pattern depth is implemented.

## Next Highest-Priority Work

1. Confirm Blender MCP is exposed to the next OpenCode session and inspect its available operations.
2. Run the director credential probe and complete the external asset sourcing ledger.
3. Replace functional pickup and obstacle placeholders with optimized authored assets and collision proxies.
4. Build the district environment kit, material library, character animation layer, and event-driven VFX.
5. Generate/integrate the production audio matrix and verify browser unlock/volume behavior.
