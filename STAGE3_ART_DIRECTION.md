# Stage 3 Art Direction And Sourcing Ledger

Last updated: 2026-07-18

## Art Direction

Neon Relay uses a stormline-solarpunk identity: deep indigo transit infrastructure, pale ceramic shells, coral danger surfaces, cyan route signals, and warm gold rewards. Rounded hard-surface forms and geometric relay glyphs connect the character, hazards, world props, pickups, and interface.

The chase camera prioritizes broad silhouettes, high-value rear character detail, readable hazard height, and luminous path cues. Glow supports authored forms rather than replacing them.

## Skill Loading

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

- Hero/player: original Blender MCP model, glTF export, runtime procedural animation
- Obstacles and train: original Blender MCP models with separate gameplay collision proxies
- Rewards and power-ups: original Blender MCP kit; instancing or pooled clones at runtime
- World and skyline: hybrid Blender authored modules plus instanced/merged Three.js support detail
- Materials, decals, and GUI motifs: shared PBR palette and geometric in-house marks
- Audio: procedural Web Audio fallback because ElevenLabs is credential-blocked

External third-party assets generated or downloaded: none. The missing credential probe and disabled Blender providers are the recorded blockers for external hero generation. All Stage 3 GLBs are original project-owned Blender outputs.

## Technical Art Contract

Hero surfaces:

- Courier helmet/visor, jacket armor, relay pack, limbs, gloves, knee plates, and signal shoes
- Barrier, hurdle, gate, moving drone, and train hazard family
- Relay token, rare shard, magnet, shield, multiplier, and jump-boost pickups
- Transit arch and close world modules

Support surfaces:

- Repeated pylons, lamps, utility clusters, building modules, windows, lane plates, cables, signs, and particles
- Support detail remains shared, cloned, instanced, merged, culled, or simplified

Material roles:

- `NR_Ceramic`: pale painted shell
- `NR_Indigo` / `NR_IndigoMatte`: structural shell and fabric-like surfaces
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

## Blender Outputs

| Asset | Runtime path | Size |
| --- | --- | ---: |
| Courier | `public/assets/models/neon-courier.glb` | 608 KB |
| Barrier | `public/assets/models/barrier-premium.glb` | 128 KB |
| Hurdle | `public/assets/models/hurdle-premium.glb` | 76 KB |
| Gate | `public/assets/models/gate-premium.glb` | 140 KB |
| Drone | `public/assets/models/drone-premium.glb` | 164 KB |
| Train | `public/assets/models/train-premium.glb` | 232 KB |
| Reward/power kit | `public/assets/models/reward-power-kit.glb` | 380 KB |
| World kit | `public/assets/models/world-kit.glb` | 724 KB |
| Editable source | `art/blender/neon-relay-stage3.blend` | 388 KB |

Courier Blender bounds before runtime normalization: `1.246 x 0.825 x 2.241 m`. Runtime scale will preserve the existing collision contract instead of using detailed meshes for collisions.

## Audio Matrix

External generation is blocked, so Stage 3 will author a procedural Web Audio matrix:

| Group | Events |
| --- | --- |
| Music | menu/run harmonic layers, pulse, adaptive speed intensity |
| Ambience | stormline wind, transit hum |
| Movement | jump, roll, landing, lane switch |
| Interaction | common pickup, rare pickup, magnet, shield, multiplier, jump boost |
| Threat | warning sweep, shield absorb, collision/fail |
| UI | confirm, pause, resume, restart |

The runtime must provide browser gesture unlock, master/music/SFX groups, pause/resume cleanup, and independent volume controls.
