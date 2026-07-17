import * as THREE from 'three';
import { InputController, type InputAction } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { Player } from '../entities/Player';
import { CameraRig } from '../systems/CameraRig';
import { CollisionSystem } from '../systems/CollisionSystem';
import { Hud } from '../systems/Hud';
import { TrackManager } from '../systems/TrackManager';
import { createSeededRandom } from '../utils/random';

type GameState = 'running' | 'paused' | 'game-over';

const BASE_SPEED = 10.8;
const MAX_SPEED = 18.5;

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.1, 150);
  private readonly input: InputController;
  private readonly player = new Player();
  private readonly collision = new CollisionSystem();
  private readonly cameraRig = new CameraRig(this.camera);
  private readonly track: TrackManager;
  private readonly hud: Hud;
  private readonly loop = new Loop((delta, elapsed) => this.update(delta, elapsed), () => this.render());
  private readonly worldRoot = new THREE.Group();
  private rng = createSeededRandom(7);
  private state: GameState = 'running';
  private frame = 0;
  private elapsed = 0;
  private speed = BASE_SPEED;
  private score = 0;
  private pausedForScreenshot = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private tutorialTime = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.setClearColor('#091426');
    this.renderer.toneMappingExposure = 1.1;
    this.input = new InputController(canvas);
    this.hud = new Hud(
      () => this.pause(),
      () => this.resume(),
      () => this.resetRun(),
    );
    this.track = new TrackManager(this.rng);
    this.createScene();
    resizeRenderer(this.renderer, this.camera, 1.75);
    this.installTestHooks();
    this.publishDiagnostics();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.track.dispose();
    this.player.dispose();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private update(delta: number, _elapsed: number): void {
    this.frame += 1;
    resizeRenderer(this.renderer, this.camera, 1.75);
    const input = this.input.consume();

    if (input.pause) {
      if (this.state === 'paused') this.resume();
      else if (this.state === 'running') this.pause();
    }
    if (this.state === 'game-over' && (input.restart || input.jump)) this.resetRun();
    if (this.pausedForScreenshot || this.state !== 'running') {
      this.publishDiagnostics();
      return;
    }

    this.elapsed += delta;
    this.tutorialTime += delta;
    if (this.tutorialTime > 4 || input.left || input.right || input.jump || input.roll) this.hud.hideTutorial();

    this.speed = Math.min(MAX_SPEED, BASE_SPEED + this.elapsed * 0.075);
    this.player.update(delta, input);
    this.track.update(delta, this.speed);
    const hit = this.collision.findPlayerHit(this.player, this.track.obstacles);
    if (hit) this.endRun();

    this.score = this.track.distance * 10 + this.elapsed * this.speed;
    this.cameraRig.update(delta, this.player.position.x, this.reducedMotion);
    this.hud.update(this.score, this.track.distance, this.speed);
    this.publishDiagnostics();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private createScene(): void {
    this.scene.background = new THREE.Color('#091426');
    this.scene.fog = new THREE.FogExp2('#091426', 0.026);

    const hemisphere = new THREE.HemisphereLight('#aeefff', '#07111e', 2.1);
    this.scene.add(hemisphere);
    const key = new THREE.DirectionalLight('#d7f7ff', 3.4);
    key.position.set(-4, 9, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 26;
    this.scene.add(key);
    const rim = new THREE.PointLight('#ff3f90', 24, 18, 2);
    rim.position.set(0, 3, 7);
    this.scene.add(rim);

    this.worldRoot.add(this.track.group);
    this.worldRoot.add(this.createCityBackdrop());
    this.scene.add(this.worldRoot);
    this.scene.add(this.player.group);
  }

  private createCityBackdrop(): THREE.Group {
    const city = new THREE.Group();
    const towerMaterial = new THREE.MeshStandardMaterial({ color: '#0d2035', roughness: 0.72, metalness: 0.25 });
    const windowMaterial = new THREE.MeshBasicMaterial({ color: '#15546a' });
    const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const windowGeometry = new THREE.BoxGeometry(0.08, 1, 1);
    for (let i = 0; i < 18; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      const height = 4 + (i % 5) * 1.35;
      const tower = new THREE.Mesh(towerGeometry, towerMaterial);
      tower.scale.set(1.8 + (i % 3) * 0.7, height, 3.8);
      tower.position.set(side * (6.2 + (i % 4) * 1.4), height / 2 - 0.4, 2 - Math.floor(i / 2) * 10.5);
      city.add(tower);
      const windows = new THREE.Mesh(windowGeometry, windowMaterial);
      windows.scale.set(1, height * 0.62, 2.5);
      windows.position.set(tower.position.x - side * (tower.scale.x / 2 + 0.05), height * 0.54, tower.position.z);
      city.add(windows);
    }
    return city;
  }

  private pause(): void {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.hud.setState('paused', this.score, this.track.distance);
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.hud.setState('running', this.score, this.track.distance);
  }

  private endRun(): void {
    this.state = 'game-over';
    this.player.crash();
    this.cameraRig.addTrauma(0.85);
    this.hud.flashImpact();
    this.hud.setState('game-over', this.score, this.track.distance);
  }

  private resetRun(): void {
    this.rng = createSeededRandom(7);
    this.state = 'running';
    this.elapsed = 0;
    this.speed = BASE_SPEED;
    this.score = 0;
    this.tutorialTime = 0;
    this.player.reset();
    this.track.reset(this.rng);
    this.cameraRig.snap(0);
    this.hud.update(0, 0, this.speed);
    this.hud.setState('running', 0, 0);
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => {
        this.rng = createSeededRandom(value);
        this.track.reset(this.rng);
      },
      setState: (name: string) => {
        if (name === 'active-play') this.resetRun();
        else if (name === 'game-over') this.endRun();
        else if (name === 'paused') this.pause();
        else console.warn(`Unknown test state: ${name}`);
      },
      setPausedForScreenshot: (paused: boolean) => {
        this.pausedForScreenshot = paused;
      },
      setReducedMotion: (enabled: boolean) => {
        this.reducedMotion = enabled;
      },
      hideDebugUi: () => undefined,
      input: (action: InputAction) => this.input.queue(action),
    };
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.score,
      distance: this.track.distance,
      speed: this.speed,
      state: this.state,
      player: {
        position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        lane: this.player.lane,
        targetLane: this.player.targetLane,
        state: this.player.state,
      },
      entities: {
        obstacles: this.track.obstacles.filter((obstacle) => obstacle.active).length,
        segments: 10,
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, 1.75),
      },
    };
  }
}
