import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AssetManager } from '../assets/AssetManager';
import { MaterialLibrary } from '../assets/MaterialLibrary';
import { InputController, type InputAction } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { Player } from '../entities/Player';
import { CameraRig } from '../systems/CameraRig';
import { CollectibleSystem } from '../systems/CollectibleSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { EffectsManager } from '../systems/EffectsManager';
import { Hud } from '../systems/Hud';
import { PowerUpSystem, type PowerUpType } from '../systems/PowerUpSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { TrackManager } from '../systems/TrackManager';
import { WorldArtDirector } from '../systems/WorldArtDirector';
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
  private readonly scoreSystem = new ScoreSystem();
  private readonly effects = new EffectsManager();
  private readonly materials = new MaterialLibrary();
  private readonly assets = new AssetManager(this.materials);
  private readonly track: TrackManager;
  private readonly collectibles: CollectibleSystem;
  private readonly powerUps: PowerUpSystem;
  private readonly hud: Hud;
  private readonly loop = new Loop((delta, elapsed) => this.update(delta, elapsed), () => this.render());
  private readonly worldRoot = new THREE.Group();
  private worldArt: WorldArtDirector | null = null;
  private fallbackCity: THREE.Group | null = null;
  private environmentTexture: THREE.Texture | null = null;
  private seedValue = 7;
  private rng = createSeededRandom(this.seedValue);
  private state: GameState = 'running';
  private frame = 0;
  private elapsed = 0;
  private speed = BASE_SPEED;
  private pausedForScreenshot = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private tutorialTime = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.setClearColor('#091426');
    this.renderer.toneMappingExposure = 1.1;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = 0.9;
    pmrem.dispose();
    this.input = new InputController(canvas);
    this.hud = new Hud(
      () => this.pause(),
      () => this.resume(),
      () => this.resetRun(),
    );
    this.track = new TrackManager(this.rng);
    this.collectibles = new CollectibleSystem(this.rng);
    this.powerUps = new PowerUpSystem(this.rng);
    this.createScene();
    resizeRenderer(this.renderer, this.camera, 1.75);
    this.installTestHooks();
    this.publishDiagnostics();
  }

  async initialize(onProgress: (progress: number) => void): Promise<void> {
    try {
      await this.assets.loadAll(onProgress);
      this.player.setVisual(this.assets.cloneHero());
      this.track.setObstacleTemplates({
        barrier: this.assets.cloneMerged('barrier', 'BarrierRoot'),
        hurdle: this.assets.cloneMerged('hurdle', 'HurdleRoot'),
        gate: this.assets.cloneMerged('gate', 'GateRoot'),
        drone: this.assets.cloneMerged('drone', 'DroneRoot'),
        train: this.assets.cloneMerged('train', 'TrainRoot'),
      });
      this.collectibles.setGeometries(
        this.assets.combinedGeometry('rewards', 'RelayTokenRoot'),
        this.assets.combinedGeometry('rewards', 'RareShardRoot'),
      );
      this.powerUps.setTemplates({
        magnet: this.assets.cloneMerged('rewards', 'PowerMagnetRoot'),
        shield: this.assets.cloneMerged('rewards', 'PowerShieldRoot'),
        multiplier: this.assets.cloneMerged('rewards', 'PowerMultiplierRoot'),
        'jump-boost': this.assets.cloneMerged('rewards', 'PowerJumpRoot'),
      });
      this.worldArt = new WorldArtDirector({
        arch: this.assets.cloneMerged('world', 'TransitArchRoot'),
        pylon: this.assets.cloneMerged('world', 'RoutePylonRoot'),
        lamp: this.assets.cloneMerged('world', 'StreetLampRoot'),
        billboard: this.assets.cloneMerged('world', 'BillboardRoot'),
        utility: this.assets.cloneMerged('world', 'UtilityClusterRoot'),
        buildingA: this.assets.cloneMerged('world', 'BuildingARoot'),
        buildingB: this.assets.cloneMerged('world', 'BuildingBRoot'),
      });
      if (this.fallbackCity) {
        this.worldRoot.remove(this.fallbackCity);
        this.disposeGroup(this.fallbackCity);
        this.fallbackCity = null;
      }
      this.worldRoot.add(this.worldArt.group);
      this.publishDiagnostics();
    } catch (error) {
      console.warn('Presentation assets failed to load; using procedural fallback.', error);
    }
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.track.dispose();
    this.collectibles.dispose();
    this.powerUps.dispose();
    this.effects.dispose();
    this.worldArt?.dispose();
    this.assets.dispose();
    this.materials.dispose();
    this.environmentTexture?.dispose();
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
    this.player.jumpMultiplier = this.powerUps.jumpMultiplier;
    this.player.update(delta, input);
    this.track.update(delta, this.elapsed, this.speed);
    this.worldArt?.update(delta, this.speed);
    const collectedPower = this.powerUps.update(delta, this.speed, this.player);
    if (collectedPower) {
      this.effects.burst(this.player.position.x, this.player.position.y + 1, this.player.position.z);
      this.cameraRig.addTrauma(0.16);
      this.hud.flashPowerUp();
    }
    const collection = this.collectibles.update(delta, this.speed, this.player, this.powerUps.magnetActive);
    if (collection.count > 0) {
      this.scoreSystem.collect(collection.value, this.powerUps.scoreMultiplier);
      this.effects.burst(collection.x, collection.y, collection.z);
      this.cameraRig.addTrauma(0.08);
      this.hud.flashCollect();
    }
    const hit = this.collision.findPlayerHit(this.player, this.track.obstacles);
    if (hit) {
      if (this.powerUps.consumeShield()) {
        hit.disable();
        this.cameraRig.addTrauma(0.42);
        this.effects.burst(this.player.position.x, this.player.position.y + 1, this.player.position.z);
        this.hud.flashShield();
      } else {
        this.endRun();
      }
    }

    this.scoreSystem.update(delta, this.speed, this.powerUps.scoreMultiplier);
    this.effects.update(delta);
    this.cameraRig.update(delta, this.player.position.x, this.reducedMotion);
    this.hud.update(
      this.scoreSystem.score,
      this.scoreSystem.distance,
      this.speed,
      this.scoreSystem.coins,
      this.powerUps.scoreMultiplier,
      this.powerUps.remaining,
    );
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

    this.worldRoot.add(this.track.group, this.collectibles.group, this.powerUps.group, this.effects.group);
    this.fallbackCity = this.createCityBackdrop();
    this.worldRoot.add(this.fallbackCity, this.createSky());
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
    this.hud.setState('paused', this.scoreSystem.score, this.scoreSystem.distance);
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.hud.setState('running', this.scoreSystem.score, this.scoreSystem.distance);
  }

  private endRun(): void {
    this.state = 'game-over';
    this.player.crash();
    this.cameraRig.addTrauma(0.85);
    this.hud.flashImpact();
    this.hud.setState('game-over', this.scoreSystem.score, this.scoreSystem.distance);
  }

  private resetRun(seed = this.seedValue): void {
    this.seedValue = seed;
    this.rng = createSeededRandom(seed);
    this.state = 'running';
    this.elapsed = 0;
    this.speed = BASE_SPEED;
    this.tutorialTime = 0;
    this.player.reset();
    this.track.reset(this.rng);
    this.collectibles.reset(this.rng);
    this.powerUps.reset(this.rng);
    this.effects.reset();
    this.worldArt?.reset();
    this.scoreSystem.reset();
    this.cameraRig.snap(0);
    this.hud.update(0, 0, this.speed, 0, 1, this.powerUps.remaining);
    this.hud.setState('running', 0, 0);
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: (value: number) => {
        this.resetRun(value);
      },
      setState: (name: string) => {
        if (name === 'active-play') this.resetRun();
        else if (name === 'game-over') this.endRun();
        else if (name === 'paused') this.pause();
        else if (name === 'power-up-test') {
          this.resetRun();
          this.powerUps.spawnForTest('magnet', this.player);
        }
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
      grantPowerUp: (type: PowerUpType) => this.powerUps.activate(type),
    };
  }

  private publishDiagnostics(): void {
    const info = this.renderer.info;
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.scoreSystem.score,
      distance: this.scoreSystem.distance,
      speed: this.speed,
      state: this.state,
      coins: this.scoreSystem.coins,
      multiplier: this.powerUps.scoreMultiplier,
      powerUps: { ...this.powerUps.remaining },
      player: {
        position: { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z },
        lane: this.player.lane,
        targetLane: this.player.targetLane,
        state: this.player.state,
      },
      entities: {
        obstacles: this.track.obstacles.filter((obstacle) => obstacle.active).length,
        collectibles: this.collectibles.pool.activeCount,
        segments: 10,
      },
      assets: { ...this.assets.diagnostics },
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

  private createSky(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(120, 24, 12);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#071b42') },
        horizonColor: { value: new THREE.Color('#61324f') },
        glowColor: { value: new THREE.Color('#ff8b63') },
      },
      vertexShader: `varying vec3 vDirection; void main() { vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vDirection; uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 glowColor; void main() { float h = clamp(vDirection.y * 0.5 + 0.5, 0.0, 1.0); vec3 color = mix(horizonColor, topColor, pow(h, 0.7)); float glow = pow(max(0.0, dot(normalize(vDirection), normalize(vec3(-0.5, 0.12, -0.8)))), 10.0); gl_FragColor = vec4(color + glowColor * glow * 0.28, 1.0); }`,
    });
    const sky = new THREE.Mesh(geometry, material);
    sky.frustumCulled = false;
    return sky;
  }

  private disposeGroup(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
  }
}
