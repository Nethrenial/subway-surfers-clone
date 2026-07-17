# Implementation Status

Last updated: 2026-07-18

## Current Playable Build

Neon Relay currently launches directly into an endless three-lane run. The player can switch lanes, jump, roll, pause, collide, view a run summary, and restart. Track segments and obstacle profiles are reused, patterns are seeded, each hazard row retains a safe lane, and speed increases over time.

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

Status: not started.

- [ ] Collectible currency and trails
- [ ] Moving hazards and large transit hazards
- [ ] Magnet, shield, multiplier, jump boost, and elevated traversal power-ups
- [ ] Explicit power-up stacking/replacement rules and duration HUD
- [ ] Near-miss and combo scoring
- [ ] Pattern grammar with authored compression/release beats
- [ ] Object pools for collectibles and effects
- [ ] Unit tests for procedural safety and player state transitions
- [ ] Collision, pickup, and power-up feedback stack

### Stage 3: Presentation

Status: not started.

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

- No known Stage 1 blocking bug after automated desktop/mobile verification.
- The current obstacle visuals are deliberately foundation-grade and do not satisfy the final premium visual scorecard.
- Static side scenery does not recycle yet and can make long runs feel visually repetitive.
- Mobile active-play uses 146 calls against the initial 150-call target; visual expansion must reduce existing calls before adding density.
- Physical iOS and Android touch/audio/performance checks have not yet run.
- Full two-minute playtesting and long-run fairness testing are deferred until Stage 2 pattern depth is implemented.

## Next Highest-Priority Work

1. Add collectible and effect pools with coin trails that teach safe paths.
2. Expand pattern grammar with moving hazards, safe-path validation, and compression/recovery phases.
3. Add shield, magnet, multiplier, and jump-boost power-ups with explicit state rules.
4. Add unit coverage for player transitions and generator safety.
5. Verify Stage 2 in desktop/mobile browsers and commit the next playable checkpoint.
