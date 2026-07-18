import * as THREE from 'three';
import { ObjectPool, type Poolable } from '../core/ObjectPool';
import type { Player } from '../entities/Player';
import type { Obstacle } from '../entities/Obstacle';
import type { SeededRandom } from '../utils/random';
import { findClearLane, type ProtectedRouteItem } from './RouteSafety';
import { sampleTrackRenderPose, type TrackRenderPose } from './TrackCurve';

export type PowerUpType = 'magnet' | 'shield' | 'multiplier' | 'jump-boost';

const TYPES: readonly PowerUpType[] = ['magnet', 'shield', 'multiplier', 'jump-boost'];
const DURATIONS: Record<PowerUpType, number> = {
  magnet: 9,
  shield: 12,
  multiplier: 8,
  'jump-boost': 10,
};
const COLORS: Record<PowerUpType, string> = {
  magnet: '#ff5aa9',
  shield: '#43efff',
  multiplier: '#ffd45a',
  'jump-boost': '#9dff67',
};

class PowerUpPickup implements Poolable, ProtectedRouteItem {
  readonly group = new THREE.Group();
  active = false;
  type: PowerUpType = 'magnet';
  previousZ = 0;
  readonly routeHalfDepth = 0.45;

  private readonly profiles = new Map<PowerUpType, THREE.Object3D>();
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly renderPose: TrackRenderPose = { x: 0, y: 0, z: 0, pitch: 0 };
  private logicalX = 0;
  private logicalZ = 0;
  private spin = 0;

  get x(): number {
    return this.logicalX;
  }

  get z(): number {
    return this.logicalZ;
  }

  constructor(geometry: THREE.BufferGeometry) {
    for (const type of TYPES) {
      const material = new THREE.MeshStandardMaterial({
        color: COLORS[type],
        emissive: COLORS[type],
        emissiveIntensity: 1.1,
        roughness: 0.22,
        metalness: 0.5,
      });
      this.ownedMaterials.push(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.castShadow = true;
      this.profiles.set(type, mesh);
      this.group.add(mesh);
    }
    this.group.visible = false;
  }

  activate(type: PowerUpType, x: number, z: number): void {
    this.active = true;
    this.type = type;
    this.previousZ = z;
    this.logicalX = x;
    this.logicalZ = z;
    this.spin = 0;
    this.group.visible = true;
    for (const [profileType, profile] of this.profiles) profile.visible = profileType === type;
    this.syncVisualTransform();
  }

  reset(): void {
    this.active = false;
    this.group.visible = false;
  }

  setTemplate(type: PowerUpType, template: THREE.Object3D): void {
    const current = this.profiles.get(type);
    if (!current) return;
    const replacement = template.clone(true);
    replacement.visible = current.visible;
    this.group.remove(current);
    this.profiles.set(type, replacement);
    this.group.add(replacement);
  }

  update(delta: number, speed: number): void {
    this.previousZ = this.logicalZ;
    this.logicalZ += speed * delta;
    this.spin += delta * 2.8;
    this.syncVisualTransform();
  }

  dispose(): void {
    for (const material of this.ownedMaterials) material.dispose();
  }

  private syncVisualTransform(): void {
    sampleTrackRenderPose(this.logicalX, this.logicalZ, this.renderPose);
    this.group.position.set(this.renderPose.x, 1.05 + this.renderPose.y, this.renderPose.z);
    this.group.rotation.y = this.spin;
    this.group.rotation.x = this.renderPose.pitch + Math.sin(this.spin * 0.7) * 0.25;
  }
}

export class PowerUpSystem {
  readonly group = new THREE.Group();
  readonly remaining: Record<PowerUpType, number> = {
    magnet: 0,
    shield: 0,
    multiplier: 0,
    'jump-boost': 0,
  };

  private readonly geometry = new THREE.DodecahedronGeometry(0.43, 0);
  private readonly pool = new ObjectPool(() => new PowerUpPickup(this.geometry), 8);
  private rng: SeededRandom;
  private spawnCursorZ = -34;
  private nextType = 0;

  get routeItems(): readonly ProtectedRouteItem[] {
    return this.pool.items;
  }

  constructor(rng: SeededRandom) {
    this.rng = rng;
    for (const pickup of this.pool.items) this.group.add(pickup.group);
  }

  update(delta: number, speed: number, player: Player, obstacles: readonly Obstacle[] = []): PowerUpType | null {
    for (const type of TYPES) this.remaining[type] = Math.max(0, this.remaining[type] - delta);
    this.spawnCursorZ += speed * delta;
    if (this.spawnCursorZ > -38) {
      const preferredLane = Math.floor(this.rng() * 3);
      const lane = findClearLane(preferredLane, this.spawnCursorZ, this.spawnCursorZ, obstacles);
      if (lane !== null) this.spawnPickup(TYPES[this.nextType % TYPES.length], lane, this.spawnCursorZ);
      this.nextType += 1;
      this.spawnCursorZ -= 82 + this.rng() * 20;
    }

    for (const pickup of this.pool.items) {
      if (!pickup.active) continue;
      pickup.update(delta, speed);
      const crossed =
        Math.max(pickup.previousZ, pickup.z) > player.position.z - 0.6 &&
        Math.min(pickup.previousZ, pickup.z) < player.position.z + 0.6;
      if (crossed && Math.abs(pickup.x - player.position.x) < 0.85) {
        const type = pickup.type;
        this.activate(type);
        this.pool.release(pickup);
        return type;
      }
      if (pickup.z > 11) this.pool.release(pickup);
    }
    return null;
  }

  activate(type: PowerUpType): void {
    this.remaining[type] = Math.max(this.remaining[type], DURATIONS[type]);
  }

  consumeShield(): boolean {
    if (this.remaining.shield <= 0) return false;
    this.remaining.shield = 0;
    return true;
  }

  get magnetActive(): boolean {
    return this.remaining.magnet > 0;
  }

  get scoreMultiplier(): number {
    return this.remaining.multiplier > 0 ? 2 : 1;
  }

  get jumpMultiplier(): number {
    return this.remaining['jump-boost'] > 0 ? 1.28 : 1;
  }

  reset(rng: SeededRandom): void {
    this.rng = rng;
    this.pool.releaseAll();
    for (const type of TYPES) this.remaining[type] = 0;
    this.spawnCursorZ = -34;
    this.nextType = 0;
  }

  setTemplates(templates: Record<PowerUpType, THREE.Object3D>): void {
    for (const pickup of this.pool.items) {
      for (const type of TYPES) pickup.setTemplate(type, templates[type]);
    }
  }

  spawnForTest(type: PowerUpType, player: Player): void {
    const pickup = this.pool.acquire();
    if (pickup) pickup.activate(type, player.position.x, player.position.z - 0.2);
  }

  dispose(): void {
    for (const pickup of this.pool.items) pickup.dispose();
    this.geometry.dispose();
  }

  private spawnPickup(type: PowerUpType, lane: number, z: number): void {
    const pickup = this.pool.acquire();
    if (pickup) pickup.activate(type, (lane - 1) * 2.35, z);
  }
}
