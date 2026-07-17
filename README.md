# Neon Relay

Neon Relay is an original, portrait-format 3D endless runner built with Three.js, TypeScript, and Vite. You play a stormline courier switching between three transit lanes, jumping low barricades, rolling under gates, and avoiding full-height blockers while the corridor accelerates.

This project is inspired by the lane-based endless-runner genre. It does not use Subway Surfers characters, branding, environments, music, interface art, or proprietary assets.

## Current State

Stages 1 and 2 are complete. The project is a playable runner with keyboard and swipe controls, deterministic fair track patterns, pooled coin and rare-pickup trails, five hazard profiles, four simultaneous power-up states, score and speed progression, shield recovery, collision, pause, game over, and immediate restart. Presentation, progression, generated assets, and full audio are later stages tracked in `IMPLEMENTATION_STATUS.md`.

## Run Locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5188`.

Production verification:

```bash
npm run build
npm run preview
npm run test:unit
npm run verify:visual
npm run inspect:canvas -- --url http://127.0.0.1:5188 --state active-play --seed 7
```

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Switch left | `Left Arrow` or `A` | Swipe left |
| Switch right | `Right Arrow` or `D` | Swipe right |
| Jump | `Up Arrow`, `W`, or `Space` | Swipe up |
| Roll | `Down Arrow` or `S` | Swipe down |
| Pause/resume | `Escape` | Pause button |
| Restart | `Enter`, `Space`, or Run Again | Run Again button |

## Game Design

**Player promise:** sprint through a luminous storm-transit corridor as a courier, making fast, readable route decisions with precise controls.

**Target feeling:** fast, fair, focused, and immediately recoverable.

**Primary verb:** dodge by switching lanes. Jumping and rolling are secondary verbs that expand route choices.

**Core loop:** scan the next pattern and collectible trail, choose a safe or higher-value response, dodge it, collect rewards, exploit temporary powers, then use a short recovery window before the next pattern.

**Core-loop contract:** the player switches, jumps, or rolls to survive an accelerating three-lane corridor while authored pattern rules create pressure; survival increases distance and score, while a collision clearly ends the run and offers an immediate retry.

**Skill expression:** strong players read silhouettes earlier, chain rapid lane and vertical actions, choose jump or roll rather than abandoning a lane, and remain accurate at higher speed.

**Readability promise:** every obstacle uses a distinct height and color profile, the camera always exposes the next lane decision, and every generated row retains at least one safe lane.

**Current non-goals:** missions, unlocks, shop, imported hero assets, production audio, persistent progression, and final graphics.

## Track And Pacing

- Spatial format: three fixed lanes in a forward-moving portrait corridor.
- Start: two safe track segments establish speed and lane scale.
- First decision: a single readable hazard introduces lane switching.
- First threat: low hurdles, overhead gates, and full-height blockers test jump, roll, and lane changes; later patterns add long trains and lane-sweeping drones.
- Escalation: speed rises from `10.8` to `18.5` world units per second; later patterns can block two lanes and add a second row.
- Recovery: row spacing and safe startup segments provide breathing room.
- Fairness: seeded generation chooses a safe lane before placing hazards; it never fills all three lanes in one row.
- Risk/reward: common trails teach viable routes, raised arcs reward jumping, and rare shards increase currency value.
- Failure: collision flash, camera impulse, crashed pose, summary overlay, and one-input restart explain the setback.

## Architecture

The code follows engine-like ownership without abstracting beyond current mechanics:

| Area | Responsibility |
| --- | --- |
| `src/core/Loop.ts` | Single capped-delta requestAnimationFrame loop |
| `src/core/Renderer.ts` | Renderer setup, DPR cap, and responsive canvas sizing |
| `src/core/InputController.ts` | Keyboard and pointer gestures converted to one-frame intents |
| `src/core/ObjectPool.ts` | Fixed-capacity reusable gameplay objects |
| `src/game/Game.ts` | State transitions and explicit system update order |
| `src/entities/Player.ts` | Lane target, jump/roll queueing, animation, and collision proxy |
| `src/entities/Obstacle.ts` | Pooled hazard profiles and collision bounds |
| `src/entities/Collectible.ts` | Allocation-free pooled collectible data |
| `src/systems/TrackManager.ts` | Reusable segments, seeded fair patterns, and difficulty-ready recycling |
| `src/systems/PatternGenerator.ts` | Pure safe-row generation and validation rules |
| `src/systems/CollectibleSystem.ts` | Instanced coin/rare trails, collection, and magnet attraction |
| `src/systems/PowerUpSystem.ts` | Pooled pickups and explicit duration/stack/consumption rules |
| `src/systems/ScoreSystem.ts` | Distance, currency, reward, and multiplier calculations |
| `src/systems/EffectsManager.ts` | Instanced collection and shield burst particles |
| `src/systems/CollisionSystem.ts` | Allocation-free swept Z and AABB overlap checks |
| `src/systems/CameraRig.ts` | Chase framing and trauma-based impact response |
| `src/systems/Hud.ts` | HUD and pause/game-over presentation driven by game state |

Update order:

```text
input -> state gate -> power state -> player -> track/spawns -> pickups -> collision -> score/effects -> camera -> HUD -> diagnostics -> render
```

Frequently reused track segments, obstacle profiles, collectibles, power-up pickups, and particles remain allocated and are reconfigured when recycled. Coin and particle visuals use instanced meshes. Gameplay randomness flows through a seeded generator for deterministic visual and playtest hooks.

## Testing

Vitest covers scoring, pooling, player transitions, power-up rules, swipe interpretation, and thousands of seeded procedural patterns. `tests/visual.spec.ts` runs against desktop Chromium and mobile WebKit emulation. It verifies:

- Nonblank, varied WebGL output and portrait framing
- Objective progression through distance and score
- Keyboard lane switching
- Real pointer swipe lane switching on mobile
- Jump and roll state transitions
- Pause freezes simulation and resume continues it
- Game-over presentation and restart
- Real instanced coin collection and currency feedback
- Real pooled magnet acquisition and duration UI
- Score-multiplier state and HUD feedback
- Shield consumption against a real seeded obstacle collision
- No console or page errors

The game exposes `window.__THREE_GAME_DIAGNOSTICS__` and deterministic `window.__THREE_GAME_TEST_HOOKS__` for browser QA, canvas inspection, and future bot playtests.

## Assets And Licenses

Stage 1 uses only procedural Three.js geometry and CSS presentation. See `ASSET_ATTRIBUTIONS.md`. Three.js and other package licenses are available in their npm packages.

## Known Limitations

- Visuals are a readable foundation, not the requested final premium bar.
- No persistent economy, progression, missions, settings, unlocks, or saved data yet.
- Audio is not integrated yet.
- Track scenery is currently static while road segments recycle.
- Current power-ups are magnet, shield, score multiplier, and jump boost; elevated traversal and speed bonuses remain future additions.
- Power-up icons and pickup models are functional procedural placeholders scheduled for Blender/asset work in Stage 3.
- Automated tests emulate touch and mobile viewport behavior; physical-device testing remains required before release.

## Roadmap

See `IMPLEMENTATION_STATUS.md` for the staged checklist, known risks, and next tasks.
