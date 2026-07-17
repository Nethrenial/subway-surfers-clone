import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool';
import { Collectible } from '../entities/Collectible';
import type { Player } from '../entities/Player';
import type { SeededRandom } from '../utils/random';

export interface CollectionResult {
  count: number;
  value: number;
  x: number;
  y: number;
  z: number;
}

const LANE_X = [-2.35, 0, 2.35] as const;

export class CollectibleSystem {
  readonly group = new THREE.Group();
  readonly pool = new ObjectPool(() => new Collectible(), 80);
  readonly result: CollectionResult = { count: 0, value: 0, x: 0, y: 0, z: 0 };

  private readonly coinGeometry = new THREE.TorusGeometry(0.24, 0.085, 8, 16);
  private readonly coinMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd75e',
    emissive: '#9e5e00',
    emissiveIntensity: 1.25,
    roughness: 0.26,
    metalness: 0.62,
  });
  private readonly rareGeometry = new THREE.OctahedronGeometry(0.35, 0);
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

  constructor(rng: SeededRandom) {
    this.rng = rng;
    this.coins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.rares.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coins.castShadow = true;
    this.rares.castShadow = true;
    this.group.add(this.coins, this.rares);
    this.reset(rng);
  }

  update(delta: number, speed: number, player: Player, magnetActive: boolean): Readonly<CollectionResult> {
    this.result.count = 0;
    this.result.value = 0;
    this.spawnCursorZ += speed * delta;
    while (this.spawnCursorZ > -42) {
      this.spawnTrail(Math.floor(this.rng() * 3), this.spawnCursorZ);
      this.spawnCursorZ -= 13 + this.rng() * 5;
    }

    let coinIndex = 0;
    let rareIndex = 0;
    for (const collectible of this.pool.items) {
      if (!collectible.active) continue;
      collectible.previousZ = collectible.z;
      collectible.z += speed * delta;
      collectible.spin += delta * (collectible.rare ? 4.2 : 7.5);

      const dz = collectible.z - player.position.z;
      if (magnetActive && Math.abs(dz) < 8.5) {
        const attraction = 1 - Math.exp(-9 * delta);
        collectible.x = THREE.MathUtils.lerp(collectible.x, player.position.x, attraction);
        collectible.y = THREE.MathUtils.lerp(collectible.y, player.position.y + 1, attraction);
      }

      const crossedPlayer =
        Math.max(collectible.previousZ, collectible.z) > player.position.z - 0.5 &&
        Math.min(collectible.previousZ, collectible.z) < player.position.z + 0.5;
      const closeEnough = Math.abs(collectible.x - player.position.x) < 0.72 && Math.abs(collectible.y - (player.position.y + 1)) < 1.05;
      if (crossedPlayer && closeEnough) {
        this.result.count += 1;
        this.result.value += collectible.value;
        this.result.x = collectible.x;
        this.result.y = collectible.y;
        this.result.z = collectible.z;
        this.pool.release(collectible);
        continue;
      }
      if (collectible.z > 11) {
        this.pool.release(collectible);
        continue;
      }

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

  reset(rng: SeededRandom): void {
    this.rng = rng;
    this.pool.releaseAll();
    this.spawnCursorZ = -16;
    this.trailIndex = 0;
    this.spawnTrail(1, -3.5);
    this.coins.count = 0;
    this.rares.count = 0;
  }

  dispose(): void {
    this.coinGeometry.dispose();
    this.coinMaterial.dispose();
    this.rareGeometry.dispose();
    this.rareMaterial.dispose();
  }

  private spawnTrail(lane: number, startZ: number): void {
    this.trailIndex += 1;
    const count = this.trailIndex % 4 === 0 ? 8 : 6;
    for (let i = 0; i < count; i += 1) {
      const collectible = this.pool.acquire();
      if (!collectible) return;
      const rare = this.trailIndex % 7 === 0 && i === count - 1;
      const arc = Math.sin((i / Math.max(1, count - 1)) * Math.PI) * (this.trailIndex % 3 === 0 ? 1.1 : 0);
      collectible.activate(LANE_X[lane], 0.95 + arc, startZ - i * 1.32, rare);
    }
  }
}
