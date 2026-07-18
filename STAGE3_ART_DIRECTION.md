# Stage 3 Art Direction And Sourcing Ledger

Last updated: 2026-07-18

## Art Direction

Neon Relay uses a stormline-solarpunk identity: deep indigo transit infrastructure, pale ceramic shells, coral danger surfaces, cyan route signals, and warm gold rewards. Rounded hard-surface forms and geometric relay glyphs connect the character, hazards, world props, pickups, and interface.

The chase camera remains centered on the track during lane changes and prioritizes broad silhouettes, high-value rear character detail, readable hazard height, and luminous path cues. Lateral energy comes from the courier's authored lane-cut pose rather than camera steering. Glow supports authored forms rather than replacing them.

## Skill-loading Ledger

- `threejs-game-director`: invoked and active as primary orchestrator
- `threejs-gameplay-systems`: invoked
- `threejs-aaa-graphics-builder`: invoked
- `threejs-game-ui-designer`: invoked
- `threejs-debug-profiler`: invoked
- `threejs-qa-release`: invoked
- `threejs-3d-generator`: invoked
- `threejs-image-generator`: invoked
- `threejs-audio-generator`: invoked

## External Asset Sourcing

Credential probe output:

```text
TRIPO_API_KEY=MISSING
GEMINI_API_KEY=MISSING
ELEVENLABS_API_KEY=MISSING
```

Blender provider state at phase entry:

- Poly Haven: disabled
- Sketchfab: disabled; API key not configured
- Hyper3D Rodin: disabled
- Hunyuan3D: disabled
- Blender MCP core scene/code/viewport access: enabled and verified on port `9876`

Chosen sources:

- Hero/player: original Blender MCP humanoid model, glTF export, 18-joint object hierarchy, and runtime authored poses
- Obstacles and train: original Blender MCP models with named moving subassemblies and separate gameplay collision proxies
- Rewards and power-ups: original Blender MCP kit; instancing or pooled clones at runtime
- World and skyline: hybrid Blender authored modules plus instanced/merged Three.js support detail
- Materials, decals, and GUI motifs: shared PBR palette and geometric in-house marks
- Audio: procedural Web Audio fallback because ElevenLabs is credential-blocked

- World/sky/background source: original Blender city kit plus an in-house shader sky
- Materials/textures/decals source: shared project-owned PBR roles and deterministic CanvasTexture panel/track art

External third-party assets generated or downloaded: none. The missing credential probe and disabled Blender providers are the recorded blockers for external hero generation. All Stage 3 GLBs are original project-owned Blender outputs.

## Technical Art Contract

Hero surfaces:

- Courier head, neck, hair, ears, slim glasses, hooded jacket, relay pack, articulated limbs, gloves, knee plates, signal shoes, and signal ribbon
- Barrier, hurdle, moving-tooth gate, rotor drone, and independently approaching train hazard family
- Relay token, rare shard, magnet, shield, multiplier, and jump-boost pickups
- Transit arch and close world modules

Support surfaces:

- Repeated pylons, lamps, utility clusters, building modules, windows, lane plates, cables, signs, and particles
- Support detail remains shared, cloned, instanced, merged, culled, or simplified

Material roles:

- `NR_Ceramic`: pale painted shell
- `NR_Indigo` / `NR_IndigoMatte`: panel-textured structural shell and fabric-like surfaces
- `NR_Coral`: danger and action signal
- `NR_Cyan`: route, shield, and energy signal
- `NR_Gold`: reward and premium signal
- `NR_Lime`: jump/vertical traversal signal
- `NR_DarkMetal` / `NR_Rubber`: contact and mechanical detail
- `NR_Visor`: hero glass cue

Target mobile budget:

- Draw calls: target `<=130`, hard limit `150`
- Triangles: target `<=150,000`, hard limit `300,000`
- Geometries: `<=150`
- Textures: `<=20`
- Shadow-casting lights: `1`
- DPR cap: `1.5–1.75`
- Post-processing: at most one measured mobile pass

Mobile degradation order: disable post-processing, lower DPR, reduce shadow map/casters, cull far props, reduce world-module density, then use simpler hero/world LODs.

Render budget: desktop `<=300` calls and `<=750k` triangles; mobile hard limit `<=150` calls and `<=300k` triangles, with the lower Stage 3 target recorded above.

## Blender Outputs

| Asset | Runtime path | Size |
| --- | --- | ---: |
| Courier | `public/assets/models/neon-courier.glb` | 711 KB |
| Barrier | `public/assets/models/barrier-premium.glb` | 128 KB |
| Hurdle | `public/assets/models/hurdle-premium.glb` | 76 KB |
| Gate | `public/assets/models/gate-premium.glb` | 140 KB |
| Drone | `public/assets/models/drone-premium.glb` | 213 KB |
| Train | `public/assets/models/train-premium.glb` | 511 KB |
| Reward/power kit | `public/assets/models/reward-power-kit.glb` | 378 KB |
| World kit | `public/assets/models/world-kit.glb` | 1,119 KB |
| Editable source | `art/blender/neon-relay-stage3.blend` | 464 KB |

Courier Blender bounds before runtime normalization: `1.246 x 0.825 x 2.241 m`. Runtime scale will preserve the existing collision contract instead of using detailed meshes for collisions.

Runtime integration checkpoint:

- All eight GLBs load through `AssetManager` with fallback handling.
- Direct children are merged only within the same anatomical pivot and material; the courier retains hips/spine/chest/head, paired arm and leg chains, pack suspension, and three ribbon joints.
- Trains are scheduled while offscreen, reserve their lanes from later hazards and rewards, then approach continuously at `1.72x` track-relative speed from their first visible frame. Drones reserve every lane in their lateral sweep, hover, bank, and rotate paired blades; gates, hurdles, and warning profiles retain independent motion cues.
- Six full-detail city modules are merged into two independently recycled 66 m batches. Each batch recycles only after its final child module clears the camera. Ten road decks/marking sets render as two instanced submissions.
- Detailed hero meshes use one capsule shadow proxy rather than repeating every articulated part in the shadow pass.
- Far hazard visuals enter at 64 m under exponential fog; collision state is never culled and no close-range LOD is used.

Final measured diagnostics:

| Metric | Desktop | Mobile | Budget |
| --- | ---: | ---: | ---: |
| Calls | 116 | 102 | 300 / 150 |
| Triangles | 183,822 | 183,808 | 750k / 300k |
| Geometries | 91 | 90 | 300 / 200 |
| Textures | 19 | 6 | 60 / 40 |
| Post passes | 2 | 0 | 2 / 1 |
| Smoothed frame time | 8.35 ms | 10.55 ms | <16.67 ms |

The fidelity pass peaked at 249 mobile calls before pivot-safe hazard merging, instanced decks, batched city recyclers, and the hero shadow proxy reduced corrected active play to 102. Triangles and visible distance were retained instead of using aggressive LODs.

## Audio Matrix

External generation is blocked, so Stage 3 authors a procedural Web Audio matrix:

| Group | Events |
| --- | --- |
| Music | menu/run harmonic layers, pulse, adaptive speed intensity |
| Ambience | stormline wind, transit hum |
| Movement | jump, roll, landing, lane switch |
| Interaction | common pickup, rare pickup, magnet, shield, multiplier, jump boost |
| Threat | warning sweep, shield absorb, collision/fail |
| UI | confirm, pause, resume, restart |

The runtime provides browser gesture unlock, master/music/SFX groups, pause/resume cleanup, adaptive run intensity, and independent volume controls.

## Visual Scorecard

Final independent fresh-eyes result: `23/30` (`2.30/3.00`). Premium gate passed; showcase gate is not claimed.

| Category | Score |
| --- | ---: |
| Art direction | 3 |
| Hero/player | 3 |
| Obstacles/enemies | 2 |
| Rewards/interactables | 2 |
| World/environment | 2 |
| Materials/textures | 2 |
| Lighting/render | 2 |
| VFX/motion | 2 |
| UI/HUD | 3 |
| Performance evidence | 2 |

Automatic failures remaining: none. Remaining showcase gaps are broader world/reward variation, stronger event VFX, and denser cinematic composition. The 20-state visual harness covers menu, settings, active play, lane cut, jump, forward roll, hazard showcase, shield, pause, and game over on desktop and mobile.

Fresh-eyes review: independent reviewer inspected the complete desktop/mobile set and serial inspector JSON. Average: `2.30/3.00`.

## Game Design Brief

Player promise: carry a live stormline signal through a fast, readable three-lane city corridor. The target feeling is focused speed with fair recovery. Dodge is the primary verb; jump and roll expand route choices. Pressure comes from accelerating safe-pattern hazards, while coins, rare shards, and temporary powers reward higher-risk routes. Collision clearly fails the run and one input restarts it.

## Core Loop

Scan the next pressure row and reward trail, choose a lane/jump/roll response, execute it, collect or survive, use the authored recovery beat, and repeat at increasing speed. One pressure row per segment preserves a safe corridor; every fifth segment is an empty transition where that corridor can move one adjacent lane. Normal runs vary their seed while QA hooks stay deterministic.

## Level/Encounter Plan

The opening establishes all three lanes before introducing one blocker, then low hurdles and overhead gates teach vertical responses. Trains and sweeping drones expand later threat silhouettes. Coin lines teach safe routes, raised arcs advertise jump rewards, two-lane pressure rows increase density, and explicit empty segments create recovery before the safe corridor changes.

## Reference Ledger And Phase Ledger

- Gameplay references: game feel and endless-runner premium checklist loaded.
- Graphics references: implementation blueprint, model recipes, render recipes, technical art, shader/material guidance, and canonical visual scorecard loaded.
- 3D integration reference: GLB hierarchy, animation, diagnostics, collision, and browser-budget guidance loaded.
- External sourcing: credential probe completed; Blender MCP core used; Tripo, Gemini, ElevenLabs, Poly Haven, Sketchfab, Hyper3D, and Hunyuan3D unavailable as recorded above.
- Gameplay systems: done; real input, pressure, reward, collision, and retry paths browser-tested.
- AAA graphics: done at premium gate; showcase intentionally not claimed.
- UI: done for menu, HUD, settings, pause, failure, responsive fit, and safe areas.
- Debug/profile: done; baseline-to-final bottleneck work and serial renderer evidence recorded.
- QA: Stage 3 done; build, unit, interaction, inspector, and visual regression pass. Physical devices and release bot soak remain Stage 5 tasks.

## QA/Release Evidence

- Measured evidence: serial desktop/mobile inspector JSON is stored under `artifacts/correction-pass/` locally; the current values are recorded in the diagnostics table above.
- Screenshot evidence: 20 committed baselines under `tests/visual-regression.spec.ts-snapshots/`, plus current desktop/mobile active captures under `artifacts/correction-pass/`.
- Canvas and pixel evidence: both active canvases are nonblank. Desktop pixel metrics are 5.71-bit entropy, 0.311 edge density, and 140.5 luminance contrast; mobile metrics are 5.12-bit entropy, 0.288 edge density, and 128.7 contrast.
- Console errors: 0. Page errors: 0 on both serial inspector runs.
- VFX readability: jump trails, roll pose, shield shell, speed streaks, collection bursts, crash flash, and HUD feedback remain outside the next-decision corridor and use event/state-specific colors.
- QA/release status: Stage 3 premium presentation is verified; this is not a release-ready or showcase claim. Physical-device and bot-soak evidence remain Stage 5 requirements.
