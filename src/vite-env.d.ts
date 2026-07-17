/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  score: number;
  distance: number;
  speed: number;
  state: 'running' | 'paused' | 'game-over';
  coins: number;
  multiplier: number;
  powerUps: Record<'magnet' | 'shield' | 'multiplier' | 'jump-boost', number>;
  player: {
    position: { x: number; y: number; z: number };
    lane: number;
    targetLane: number;
    state: 'running' | 'jumping' | 'rolling' | 'crashed';
  };
  entities: { obstacles: number; collectibles: number; segments: number };
  assets: { files: number; meshes: number; triangles: number; materials: number };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
}

interface ThreeGameTestHooks {
  /** Re-seed the game RNG; all gameplay randomness must flow through it. */
  seed(value: number): void;
  /** Jump to a named state for baselines (scaffold: 'active-play' | 'complete'). */
  setState(name: string): void;
  /** Freeze the simulation while continuing to render the current frame. */
  setPausedForScreenshot(paused: boolean): void;
  /** Freeze ambient/idle animation time so screenshots are stable. */
  setReducedMotion(enabled: boolean): void;
  /** Hide debug UI (lil-gui) before capturing. */
  hideDebugUi(hidden: boolean): void;
  input(action: 'left' | 'right' | 'jump' | 'roll' | 'pause' | 'restart'): void;
  grantPowerUp(type: 'magnet' | 'shield' | 'multiplier' | 'jump-boost'): void;
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __THREE_GAME_TEST_HOOKS__?: ThreeGameTestHooks;
}
