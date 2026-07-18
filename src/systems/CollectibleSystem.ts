import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool';
import { Collectible } from '../entities/Collectible';
import type { Player } from '../entities/Player';
import type { Obstacle } from '../entities/Obstacle';
import { findClearLane } from './RouteSafety';
import type { SeededRandom } from '../utils/random';

export interface CollectionResult {
  count: number;
  value: number;
  rareCount: number;
  x: number;
  y: number;
  z: number;
  readonly xs: Float32Array;
  readonly ys: Float32Array;
  readonly zs: Float32Array;
}

const LANE_X = [-2.35, 0, 2.35] as const;
const MAGNET_RADIUS = 8.5;
const MAGNET_WAVE_SPEED = 12;
const CAPTURE_DURATION_MIN = 0.045;
const CAPTURE_DURATION_MAX = 0.065;

export class CollectibleSystem {
  readonly group = new THREE.Group();
  readonly pool = new ObjectPool(() => new Collectible(), 80);
  readonly result: CollectionResult = {
    count: 0,
    value: 0,
    rareCount: 0,
    x: 0,
    y: 0,
    z: 0,
    xs: new Float32Array(80),
    ys: new Float32Array(80),
    zs: new Float32Array(80),
  };

  private coinGeometry: THREE.BufferGeometry = new THREE.TorusGeometry(0.24, 0.085, 8, 16);
  private readonly coinMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd75e',
    emissive: '#9e5e00',
    emissiveIntensity: 1.25,
    roughness: 0.26,
    metalness: 0.62,
  });
  private rareGeometry: THREE.BufferGeometry = new THREE.OctahedronGeometry(0.35, 0);
  private readonly rareMaterial = new THREE.MeshStandardMaterial({
    color: '#ff65d3',
    emissive: '#9d167b',
    emissiveIntensity: 1.5,
    roughness: 0.22,
    metalness: 0.45,
  });
  private readonly coins = new THREE.InstancedMesh(this.coinGeometry, this.coinMaterial, 80);
  private readonly rares = new THREE.InstancedMesh(this.rareGeometry, this.rareMaterial, 16);
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private readonly euler = new THREE.Euler();
  private rng: SeededRandom;
  private spawnCursorZ = -16;
  private trailIndex = 0;
  private magnetWasActive = false;
  private magnetWaveRadius = 0;
  private magnetCapturesStarted = 0;
  private maxConcurrentCaptures = 0;

  get captureDiagnostics(): {
    authored: number;
    capturing: number;
    magnetCapturesStarted: number;
    maxConcurrentCaptures: number;
  } {
    let authored = 0;
    let capturing = 0;
    for (const collectible of this.pool.items) {
      if (!collectible.active) continue;
      if (collectible.capturing) capturing += 1;
      else authored += 1;
    }
    return {
      authored,
      capturing,
      magnetCapturesStarted: this.magnetCapturesStarted,
      maxConcurrentCaptures: this.maxConcurrentCaptures,
    };
  }

  constructor(rng: SeededRandom) {
    this.rng = rng;
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rares.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coins.frustumCulled = false;
    this.rares.frustumCulled = false;
    this.coins.castShadow = true;
    this.rares.castShadow = true;
    this.group.add(this.coins, this.rares);
    this.reset(rng);
  }

  update(
    delta: number,
    speed: number,
    player: Player,
    magnetActive: boolean,
    obstacles: readonly Obstacle[] = [],
  ): Readonly<CollectionResult> {
    this.result.count = 0;
    this.result.value = 0;
    this.result.rareCount = 0;
    if (magnetActive && !this.magnetWasActive) this.magnetWaveRadius = 0;
    const previousWaveRadius = this.magnetWaveRadius;
    if (magnetActive) this.magnetWaveRadius = Math.min(MAGNET_RADIUS, this.magnetWaveRadius + MAGNET_WAVE_SPEED * delta);
    this.magnetWasActive = magnetActive;
    this.spawnCursorZ += speed * delta;
    while (this.spawnCursorZ > -42) {
      this.spawnTrail(Math.floor(this.rng() * 3), this.spawnCursorZ, obstacles);
      this.spawnCursorZ -= 13 + this.rng() * 5;
    }

    let activeCapture: Collectible | null = null;
    for (const collectible of this.pool.items) {
      if (!collectible.active) continue;
      collectible.previousZ = collectible.z;
      collectible.spin += delta * (collectible.rare ? 4.2 : 7.5);
      if (collectible.capturing) activeCapture = collectible;
    }

    let captureAvailableAt = 0;
    if (activeCapture) {
      const remaining = activeCapture.captureDuration - activeCapture.captureElapsed;
      const captureStep = Math.min(delta, remaining);
      this.updateCapture(activeCapture, captureStep, player);
      if (activeCapture.captureElapsed >= activeCapture.captureDuration) {
        this.collect(activeCapture, player.position.x, player.position.y + 1, player.position.z);
        captureAvailableAt = remaining;
      } else {
        captureAvailableAt = Infinity;
      }
    }

    let captureCandidate: Collectible | null = null;
    let captureStartTime = Infinity;
    let candidateAheadAtStart = Infinity;
    if (magnetActive && captureAvailableAt <= delta) {
      for (const collectible of this.pool.items) {
        if (!collectible.active || collectible.capturing) continue;
        const eligibility = this.magnetEligibilityTime(
          player.position.z - collectible.previousZ,
          previousWaveRadius,
          speed,
        );
        const startTime = Math.max(captureAvailableAt, eligibility);
        const aheadAtStart = player.position.z - (collectible.previousZ + speed * startTime);
        const closeEnough = Math.abs(collectible.x - player.position.x) < 0.72
          && Math.abs(collectible.y - (player.position.y + 1)) < 1.05;
        const ordinaryCollisionTime = closeEnough && speed > 0
          ? (player.position.z - 0.5 - collectible.previousZ) / speed
          : Infinity;
        const startsBeforeCollision = ordinaryCollisionTime < 0 || startTime <= ordinaryCollisionTime;
        if (
          startTime <= delta &&
          aheadAtStart >= 0 &&
          startsBeforeCollision &&
          (startTime < captureStartTime || (Math.abs(startTime - captureStartTime) < 1e-6 && aheadAtStart < candidateAheadAtStart))
        ) {
          captureCandidate = collectible;
          captureStartTime = startTime;
          candidateAheadAtStart = aheadAtStart;
        }
      }
    }

    for (const collectible of this.pool.items) {
      if (!collectible.active || collectible.capturing) continue;
      if (collectible === captureCandidate) {
        collectible.z = collectible.previousZ + speed * captureStartTime;
        this.startCapture(collectible, player, speed);
        this.updateCapture(collectible, delta - captureStartTime, player);
        if (collectible.captureElapsed >= collectible.captureDuration) {
          this.collect(collectible, player.position.x, player.position.y + 1, player.position.z);
        }
        continue;
      }
      collectible.z += speed * delta;
      const crossedPlayer =
        Math.max(collectible.previousZ, collectible.z) > player.position.z - 0.5 &&
        Math.min(collectible.previousZ, collectible.z) < player.position.z + 0.5;
      const closeEnough = Math.abs(collectible.x - player.position.x) < 0.72 && Math.abs(collectible.y - (player.position.y + 1)) < 1.05;
      if (crossedPlayer && closeEnough) {
        this.collect(collectible, collectible.x, collectible.y, collectible.z);
        continue;
      }
      if (collectible.z > 11) this.pool.release(collectible);
    }

    let coinIndex = 0;
    let rareIndex = 0;
    for (const collectible of this.pool.items) {
      if (!collectible.active) continue;
      this.position.set(collectible.x, collectible.y, collectible.z);
      this.euler.set(0, collectible.spin, 0);
      this.rotation.setFromEuler(this.euler);
      this.matrix.compose(this.position, this.rotation, this.scale);
      if (collectible.rare) this.rares.setMatrixAt(rareIndex++, this.matrix);
      else this.coins.setMatrixAt(coinIndex++, this.matrix);
    }
    this.coins.count = coinIndex;
    this.rares.count = rareIndex;
    this.coins.instanceMatrix.needsUpdate = true;
    this.rares.instanceMatrix.needsUpdate = true;
    return this.result;
  }

  reset(rng: SeededRandom, obstacles: readonly Obstacle[] = []): void {
    this.rng = rng;
    this.pool.releaseAll();
    this.spawnCursorZ = -16;
    this.trailIndex = 0;
    this.magnetWasActive = false;
    this.magnetWaveRadius = 0;
    this.magnetCapturesStarted = 0;
    this.maxConcurrentCaptures = 0;
    this.spawnTrail(1, -3.5, obstacles);
    this.coins.count = 0;
    this.rares.count = 0;
  }

  setGeometries(coin: THREE.BufferGeometry, rare: THREE.BufferGeometry): void {
    this.coinGeometry.dispose();
    this.rareGeometry.dispose();
    this.coinGeometry = coin;
    this.rareGeometry = rare;
    this.coins.geometry = coin;
    this.rares.geometry = rare;
  }

  spawnForTest(player: Player): void {
    this.pool.releaseAll();
    this.spawnCursorZ = -100;
    const collectible = this.pool.acquire();
    collectible?.activate(player.position.x, player.position.y + 1, player.position.z - 5, false);
  }

  spawnMagnetTrailForTest(player: Player): void {
    this.pool.releaseAll();
    this.spawnCursorZ = -100;
    for (let index = 0; index < 6; index += 1) {
      this.pool.acquire()?.activate(-2.35, 0.95, player.position.z - 3 - index * 1.32, false);
    }
  }

  dispose(): void {
    this.coinGeometry.dispose();
    this.coinMaterial.dispose();
    this.rareGeometry.dispose();
    this.rareMaterial.dispose();
  }

  private spawnTrail(preferredLane: number, startZ: number, obstacles: readonly Obstacle[]): void {
    this.trailIndex += 1;
    const count = this.trailIndex % 4 === 0 ? 8 : 6;
    const endZ = startZ - (count - 1) * 1.32;
    const lane = findClearLane(preferredLane, startZ, endZ, obstacles);
    if (lane === null) return;
    for (let i = 0; i < count; i += 1) {
      const collectible = this.pool.acquire();
      if (!collectible) return;
      const rare = this.trailIndex % 7 === 0 && i === count - 1;
      const arc = Math.sin((i / Math.max(1, count - 1)) * Math.PI) * (this.trailIndex % 3 === 0 ? 1.1 : 0);
      collectible.activate(LANE_X[lane], 0.95 + arc, startZ - i * 1.32, rare);
    }
  }

  private startCapture(collectible: Collectible, player: Player, speed: number): void {
    collectible.capturing = true;
    this.magnetCapturesStarted += 1;
    this.maxConcurrentCaptures = Math.max(this.maxConcurrentCaptures, 1);
    collectible.captureElapsed = 0;
    const distance = Math.max(0, player.position.z - collectible.z);
    collectible.captureDuration = THREE.MathUtils.clamp(0.04 + distance * 0.003, CAPTURE_DURATION_MIN, CAPTURE_DURATION_MAX);
    collectible.captureStartX = collectible.x;
    collectible.captureStartY = collectible.y;
    collectible.captureStartZ = collectible.z;
    collectible.captureVelocityZ = speed;
  }

  private updateCapture(collectible: Collectible, delta: number, player: Player): void {
    collectible.captureElapsed = Math.min(collectible.captureDuration, collectible.captureElapsed + delta);
    const u = collectible.captureElapsed / collectible.captureDuration;
    const eased = u * u * (3 - 2 * u);
    const tangent = u * u * u - 2 * u * u + u;
    const arc = 16 * u * u * (1 - u) * (1 - u) * (collectible.rare ? 0.42 : 0.32);
    collectible.x = THREE.MathUtils.lerp(collectible.captureStartX, player.position.x, eased);
    collectible.y = THREE.MathUtils.lerp(collectible.captureStartY, player.position.y + 1, eased) + arc;
    collectible.z = collectible.captureStartZ * (1 - eased)
      + collectible.captureVelocityZ * collectible.captureDuration * tangent
      + player.position.z * eased;
  }

  private magnetEligibilityTime(ahead: number, waveRadius: number, speed: number): number {
    if (ahead < 0) return Infinity;
    if (ahead <= waveRadius) return 0;
    if (waveRadius >= MAGNET_RADIUS) return speed > 0 ? (ahead - MAGNET_RADIUS) / speed : Infinity;
    const capTime = (MAGNET_RADIUS - waveRadius) / MAGNET_WAVE_SPEED;
    const expandingTime = (ahead - waveRadius) / (speed + MAGNET_WAVE_SPEED);
    if (expandingTime <= capTime) return expandingTime;
    return speed > 0 ? (ahead - MAGNET_RADIUS) / speed : Infinity;
  }

  private collect(collectible: Collectible, x: number, y: number, z: number): void {
    const index = this.result.count;
    this.result.count += 1;
    this.result.value += collectible.value;
    if (collectible.rare) this.result.rareCount += 1;
    this.result.x = x;
    this.result.y = y;
    this.result.z = z;
    this.result.xs[index] = x;
    this.result.ys[index] = y;
    this.result.zs[index] = z;
    this.pool.release(collectible);
  }
}
