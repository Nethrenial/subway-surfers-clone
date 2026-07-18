import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Obstacle, type ObstacleResources } from '../entities/Obstacle';
import type { Collectible } from '../entities/Collectible';
import {
  chooseNextSafeLane,
  createSegmentPattern,
  isRecoveryGeneration,
  type HazardPlacement,
} from './PatternGenerator';
import type { ProtectedRouteItem } from './RouteSafety';

export type ObstacleTemplates = Record<'barrier' | 'hurdle' | 'gate' | 'drone' | 'train', THREE.Object3D>;
import type { SeededRandom } from '../utils/random';
import { TRAIN_RELATIVE_SPEED, TRAIN_SPEED_MULTIPLIER } from '../game/RunnerTuning';
import { sampleTrackChordRenderPose, type TrackRenderPose } from './TrackCurve';

const SEGMENT_LENGTH = 12;
const SEGMENT_COUNT = 10;
const TRACK_SLICE_LENGTH = 3;
const TRACK_SLICES_PER_SEGMENT = SEGMENT_LENGTH / TRACK_SLICE_LENGTH;
const TRACK_SLICE_COUNT = SEGMENT_COUNT * TRACK_SLICES_PER_SEGMENT;
const RECYCLE_Z = 17;
const VISIBLE_FAR_Z = -64;
const VISIBLE_NEAR_Z = 16;
const TRAIN_ENTRY_Z = VISIBLE_FAR_Z - 2.7;
const TRAIN_ROUTE_DISTANCE = (VISIBLE_NEAR_Z + 2.7 - TRAIN_ENTRY_Z) / TRAIN_SPEED_MULTIPLIER;

class TrackSegment {
  readonly group = new THREE.Group();
  readonly obstacles: Obstacle[] = [];
  placements: readonly HazardPlacement[] = [];

  constructor(
    index: number,
    obstacleResources: ObstacleResources,
  ) {
    for (let i = 0; i < 4; i += 1) {
      const obstacle = new Obstacle(obstacleResources);
      this.obstacles.push(obstacle);
      this.group.add(obstacle.group);
    }
    this.group.name = `track-segment-${index}`;
  }

  configure(placements: readonly HazardPlacement[]): void {
    this.placements = placements;
    for (let i = 0; i < this.obstacles.length; i += 1) {
      const placement = placements[i];
      if (placement) {
        this.obstacles[i].configure(
          placement.type,
          placement.lane,
          placement.z,
          placement.motionAmplitude,
          placement.blockedLanes,
        );
      }
      else this.obstacles[i].disable();
    }
  }
}

export class TrackManager {
  readonly group = new THREE.Group();
  readonly obstacles: Obstacle[] = [];
  distance = 0;

  private readonly segments: TrackSegment[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly deckInstances: THREE.InstancedMesh;
  private readonly markingInstances: THREE.InstancedMesh;
  private readonly instanceMatrix = new THREE.Matrix4();
  private readonly instancePosition = new THREE.Vector3();
  private readonly instanceRotation = new THREE.Quaternion();
  private readonly instanceScale = new THREE.Vector3(1, 1, 1);
  private readonly renderPose: TrackRenderPose = { x: 0, y: 0, z: 0, pitch: 0 };
  private readonly trackPitchAxis = new THREE.Vector3(1, 0, 0);
  private generation = 0;
  private safeLane = 1;
  private trainConflictViolations = 0;
  private trainMotionViolations = 0;
  private prematureTrainRecycles = 0;
  private routeWallViolations = 0;
  private trainsEntered = 0;

  get routeDiagnostics(): {
    scheduledTrains: number;
    visibleTrains: number;
    leadTrainZ: number | null;
    trainConflictViolations: number;
    trainMotionViolations: number;
    prematureTrainRecycles: number;
    routeWallViolations: number;
    trainsEntered: number;
  } {
    let scheduledTrains = 0;
    let visibleTrains = 0;
    let leadTrainZ: number | null = null;
    for (const obstacle of this.obstacles) {
      if (!obstacle.active || obstacle.type !== 'train') continue;
      scheduledTrains += 1;
      if (!obstacle.group.visible) continue;
      visibleTrains += 1;
      leadTrainZ = Math.max(leadTrainZ ?? -Infinity, obstacle.worldZ());
    }
    return {
      scheduledTrains,
      visibleTrains,
      leadTrainZ,
      trainConflictViolations: this.trainConflictViolations,
      trainMotionViolations: this.trainMotionViolations,
      prematureTrainRecycles: this.prematureTrainRecycles,
      routeWallViolations: this.routeWallViolations,
      trainsEntered: this.trainsEntered,
    };
  }

  constructor(private rng: SeededRandom) {
    const trackTexture = createTrackTexture();
    this.textures.push(trackTexture);
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: '#456684',
      map: trackTexture,
      roughness: 0.72,
      metalness: 0.18,
    });
    const laneMaterial = new THREE.MeshStandardMaterial({
      color: '#5ee8ff',
      emissive: '#087f9b',
      emissiveIntensity: 1.8,
      roughness: 0.28,
    });
    this.materials.push(trackMaterial, laneMaterial);
    const deckGeometry = new THREE.BoxGeometry(7.8, 0.28, TRACK_SLICE_LENGTH);
    const markingParts = [
      translatedBox(0.055, 0.018, TRACK_SLICE_LENGTH - 0.08, -1.175, 0.012, 0),
      translatedBox(0.055, 0.018, TRACK_SLICE_LENGTH - 0.08, 1.175, 0.012, 0),
      translatedBox(0.16, 0.11, TRACK_SLICE_LENGTH, -3.82, 0.08, 0),
      translatedBox(0.16, 0.11, TRACK_SLICE_LENGTH, 3.82, 0.08, 0),
    ];
    const markingGeometry = mergeGeometries(markingParts, false);
    for (const part of markingParts) part.dispose();
    if (!markingGeometry) throw new Error('Could not merge track marking geometry.');
    this.geometries.push(deckGeometry, markingGeometry);
    this.deckInstances = new THREE.InstancedMesh(deckGeometry, trackMaterial, TRACK_SLICE_COUNT);
    this.deckInstances.receiveShadow = true;
    this.deckInstances.frustumCulled = false;
    this.markingInstances = new THREE.InstancedMesh(markingGeometry, laneMaterial, TRACK_SLICE_COUNT);
    this.markingInstances.receiveShadow = true;
    this.markingInstances.frustumCulled = false;
    this.group.add(this.deckInstances, this.markingInstances);
    const obstacleResources = this.createObstacleResources();

    for (let i = 0; i < SEGMENT_COUNT; i += 1) {
      const segment = new TrackSegment(
        i,
        obstacleResources,
      );
      this.segments.push(segment);
      this.obstacles.push(...segment.obstacles);
      this.group.add(segment.group);
    }
    this.reset(rng);
  }

  update(
    delta: number,
    elapsed: number,
    speed: number,
    collectibles: readonly Collectible[] = [],
    protectedItems: readonly ProtectedRouteItem[] = [],
  ): void {
    for (const obstacle of this.obstacles) {
      obstacle.previousWorldX = obstacle.worldX();
      obstacle.previousWorldZ = obstacle.worldZ();
    }
    this.distance += speed * delta;
    let minZ = Infinity;
    for (const segment of this.segments) {
      minZ = Math.min(minZ, segment.group.position.z);
    }

    for (const segment of this.segments) {
      segment.group.position.z += speed * delta;
      if (segment.group.position.z > RECYCLE_Z) {
        for (const obstacle of segment.obstacles) {
          if (obstacle.active && obstacle.type === 'train' && this.distance < obstacle.trainExitDistance) {
            this.prematureTrainRecycles += 1;
          }
        }
        segment.group.position.z = minZ - SEGMENT_LENGTH;
        minZ = segment.group.position.z;
        if (isRecoveryGeneration(this.generation)) this.safeLane = chooseNextSafeLane(this.safeLane, this.rng);
        segment.configure(createSegmentPattern(
          this.generation,
          this.rng,
          this.safeLane,
          this.reservedTrainLanes(),
        ));
        this.scheduleSegmentTrains(segment, collectibles, protectedItems);
        this.generation += 1;
        for (const obstacle of segment.obstacles) {
          obstacle.previousWorldX = obstacle.worldX();
          obstacle.previousWorldZ = obstacle.worldZ();
        }
      }
    }
    for (const obstacle of this.obstacles) {
      if (!obstacle.active) continue;
      obstacle.updateMotion(delta, elapsed, speed, this.distance);
      const worldZ = obstacle.worldZ();
      const previousDistance = this.distance - speed * delta;
      if (
        obstacle.type === 'train' &&
        previousDistance < obstacle.trainEnterDistance &&
        this.distance >= obstacle.trainEnterDistance
      ) {
        this.trainsEntered += 1;
      }
      if (
        obstacle.type === 'train' &&
        previousDistance >= obstacle.trainEnterDistance &&
        this.distance < obstacle.trainExitDistance
      ) {
        const expectedDisplacement = speed * delta * TRAIN_SPEED_MULTIPLIER;
        if (Math.abs(worldZ - obstacle.previousWorldZ - expectedDisplacement) > 0.02) {
          this.trainMotionViolations += 1;
        }
      }
      if (obstacle.type === 'train' && this.distance >= obstacle.trainExitDistance) {
        obstacle.disable();
        continue;
      }
      obstacle.group.visible = worldZ + obstacle.halfDepth > VISIBLE_FAR_Z && worldZ - obstacle.halfDepth < VISIBLE_NEAR_Z;
    }
    this.trainConflictViolations += this.countTrainConflicts(collectibles, protectedItems);
    if (this.hasFullLaneWall()) this.routeWallViolations += 1;
    this.syncTrackInstances();
  }

  reset(rng: SeededRandom): void {
    this.rng = rng;
    this.distance = 0;
    this.generation = 0;
    this.safeLane = 1;
    this.trainConflictViolations = 0;
    this.trainMotionViolations = 0;
    this.prematureTrainRecycles = 0;
    this.routeWallViolations = 0;
    this.trainsEntered = 0;
    for (const obstacle of this.obstacles) obstacle.disable();
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      segment.group.position.set(0, 0, 4 - i * SEGMENT_LENGTH);
      if (isRecoveryGeneration(this.generation)) this.safeLane = chooseNextSafeLane(this.safeLane, this.rng);
      segment.configure(createSegmentPattern(
        this.generation,
        this.rng,
        this.safeLane,
        this.reservedTrainLanes(),
      ));
      this.scheduleSegmentTrains(segment, [], []);
      this.generation += 1;
      for (const obstacle of segment.obstacles) {
        obstacle.previousWorldX = obstacle.worldX();
        obstacle.previousWorldZ = obstacle.worldZ();
      }
      for (const obstacle of segment.obstacles) {
        const worldZ = obstacle.worldZ();
        obstacle.group.visible = obstacle.active && worldZ + obstacle.halfDepth > VISIBLE_FAR_Z && worldZ - obstacle.halfDepth < VISIBLE_NEAR_Z;
      }
    }
    this.syncTrackInstances();
  }

  setObstacleTemplates(templates: ObstacleTemplates): void {
    for (const obstacle of this.obstacles) {
      for (const type of Object.keys(templates) as (keyof ObstacleTemplates)[]) {
        obstacle.setProfileModel(type, templates[type].clone(true));
      }
    }
  }

  setShowcaseForTest(): void {
    for (const obstacle of this.obstacles) obstacle.disable();
    const showcase = [
      { type: 'train', lane: 1, worldZ: -38 },
      { type: 'drone', lane: 0, worldZ: -19 },
      { type: 'gate', lane: 2, worldZ: -25 },
      { type: 'hurdle', lane: 1, worldZ: -12 },
      { type: 'barrier', lane: 1, worldZ: -24 },
    ] as const;
    for (let index = 0; index < showcase.length; index += 1) {
      const obstacle = index === 0 ? this.segments[this.segments.length - 1].obstacles[0] : this.obstacles[index];
      const item = showcase[index];
      const segmentZ = obstacle.group.parent?.position.z ?? 0;
      obstacle.configure(item.type, item.lane, item.worldZ - segmentZ, item.type === 'drone' ? 1.1 : 0);
      if (item.type === 'train') {
        obstacle.scheduleTrain(this.distance, this.distance, this.distance + TRAIN_ROUTE_DISTANCE, TRAIN_ENTRY_Z);
      }
      obstacle.previousWorldX = obstacle.worldX();
      obstacle.previousWorldZ = obstacle.worldZ();
    }
  }

  setCollisionForTest(): void {
    for (const obstacle of this.obstacles) obstacle.disable();
    const obstacle = this.obstacles[0];
    const segmentZ = obstacle.group.parent?.position.z ?? 0;
    obstacle.configure('barrier', 1, -4 - segmentZ);
    obstacle.previousWorldX = obstacle.worldX();
    obstacle.previousWorldZ = obstacle.worldZ();
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
  }

  private createObstacleResources(): ObstacleResources {
    const warning = new THREE.MeshStandardMaterial({
      color: '#ff4f91',
      emissive: '#a50b52',
      emissiveIntensity: 1.2,
      roughness: 0.32,
      metalness: 0.16,
    });
    const frame = new THREE.MeshStandardMaterial({ color: '#243c57', roughness: 0.42, metalness: 0.5 });
    const signal = new THREE.MeshStandardMaterial({
      color: '#ffdc63',
      emissive: '#b56a06',
      emissiveIntensity: 1.5,
      roughness: 0.28,
    });
    this.materials.push(warning, frame, signal);

    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z = 0) => {
      this.geometries.push(geometry);
      const part = new THREE.Mesh(geometry, material);
      part.position.set(x, y, z);
      part.castShadow = true;
      part.receiveShadow = true;
      return part;
    };

    const barrier = new THREE.Group();
    barrier.add(mesh(new THREE.BoxGeometry(1.75, 1.58, 0.68), frame, 0, 0.79));
    barrier.add(mesh(new THREE.BoxGeometry(1.92, 0.22, 0.78), warning, 0, 1.48, -0.02));
    barrier.add(mesh(new THREE.BoxGeometry(0.34, 0.34, 0.8), signal, 0, 0.84, -0.04));

    const hurdle = new THREE.Group();
    hurdle.add(mesh(new THREE.BoxGeometry(1.82, 0.48, 0.62), warning, 0, 0.48));
    hurdle.add(mesh(new THREE.BoxGeometry(0.18, 0.64, 0.5), frame, -0.68, 0.32));
    hurdle.add(mesh(new THREE.BoxGeometry(0.18, 0.64, 0.5), frame, 0.68, 0.32));
    hurdle.add(mesh(new THREE.BoxGeometry(0.78, 0.11, 0.68), signal, 0, 0.72, -0.02));

    const gate = new THREE.Group();
    gate.add(mesh(new THREE.BoxGeometry(0.18, 2.38, 0.54), frame, -0.9, 1.19));
    gate.add(mesh(new THREE.BoxGeometry(0.18, 2.38, 0.54), frame, 0.9, 1.19));
    gate.add(mesh(new THREE.BoxGeometry(2, 0.5, 0.7), warning, 0, 1.72));
    gate.add(mesh(new THREE.BoxGeometry(0.8, 0.12, 0.76), signal, 0, 1.45, -0.02));

    const drone = new THREE.Group();
    drone.add(mesh(new THREE.SphereGeometry(0.54, 12, 8), frame, 0, 0.94));
    drone.add(mesh(new THREE.BoxGeometry(1.62, 0.12, 0.34), warning, 0, 0.96));
    drone.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.18, 12), signal, 0, 0.94, -0.52));
    drone.add(mesh(new THREE.TorusGeometry(0.68, 0.055, 6, 16), signal, 0, 0.94));

    const train = new THREE.Group();
    train.add(mesh(new THREE.BoxGeometry(1.9, 2.65, 5), frame, 0, 1.34));
    train.add(mesh(new THREE.BoxGeometry(1.72, 0.64, 0.12), warning, 0, 1.92, 2.54));
    train.add(mesh(new THREE.BoxGeometry(1.15, 0.42, 0.14), signal, 0, 1.94, 2.62));
    train.add(mesh(new THREE.BoxGeometry(1.42, 0.18, 0.16), signal, 0, 0.62, 2.62));
    return { barrier, hurdle, gate, drone, train };
  }

  private syncTrackInstances(): void {
    for (let segmentIndex = 0; segmentIndex < this.segments.length; segmentIndex += 1) {
      const segmentZ = this.segments[segmentIndex].group.position.z;
      for (let sliceIndex = 0; sliceIndex < TRACK_SLICES_PER_SEGMENT; sliceIndex += 1) {
        const instanceIndex = segmentIndex * TRACK_SLICES_PER_SEGMENT + sliceIndex;
        const offsetZ = -SEGMENT_LENGTH * 0.5 + TRACK_SLICE_LENGTH * (sliceIndex + 0.5);
        const z = segmentZ + offsetZ;
        sampleTrackChordRenderPose(0, z, TRACK_SLICE_LENGTH * 0.5, this.renderPose);
        this.instancePosition.set(this.renderPose.x, this.renderPose.y - 0.18, this.renderPose.z);
        this.instanceRotation.setFromAxisAngle(this.trackPitchAxis, this.renderPose.pitch);
        this.instanceMatrix.compose(this.instancePosition, this.instanceRotation, this.instanceScale);
        this.deckInstances.setMatrixAt(instanceIndex, this.instanceMatrix);
        this.instancePosition.y += 0.18;
        this.instanceMatrix.compose(this.instancePosition, this.instanceRotation, this.instanceScale);
        this.markingInstances.setMatrixAt(instanceIndex, this.instanceMatrix);
      }
    }
    this.deckInstances.instanceMatrix.needsUpdate = true;
    this.markingInstances.instanceMatrix.needsUpdate = true;
  }

  private scheduleSegmentTrains(
    segment: TrackSegment,
    collectibles: readonly Collectible[],
    protectedItems: readonly ProtectedRouteItem[],
  ): void {
    const trains = segment.obstacles.filter((obstacle) => obstacle.active && obstacle.type === 'train');
    if (trains.length === 0) return;

    for (const train of trains) {
      let enterDistance = this.distance;
      const maxIterations = this.obstacles.length + collectibles.length + protectedItems.length + 2;
      for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        let nextEnterDistance = enterDistance;
        for (const obstacle of this.obstacles) {
          if (!obstacle.active || trains.includes(obstacle)) continue;
          if (obstacle.type === 'train') {
            if (obstacle.occupiedLanes.includes(train.lane)) {
              nextEnterDistance = Math.max(nextEnterDistance, obstacle.trainExitDistance);
            }
            continue;
          }
          if (!this.blocksTrainRoute(train, obstacle)) continue;
          nextEnterDistance = Math.max(
            nextEnterDistance,
            this.requiredTrainEntryDistance(
              enterDistance,
              obstacle.worldZ(),
              obstacle.halfDepth,
              VISIBLE_NEAR_Z,
            ),
          );
        }
        for (const item of collectibles) {
          if (!item.active || item.routeProtected === false || Math.abs(item.x - train.worldX()) >= 0.8) continue;
          nextEnterDistance = Math.max(
            nextEnterDistance,
            this.requiredTrainEntryDistance(enterDistance, item.z, item.routeHalfDepth ?? 0.35, 11),
          );
        }
        for (const item of protectedItems) {
          if (!item.active || item.routeProtected === false || Math.abs(item.x - train.worldX()) >= 0.8) continue;
          nextEnterDistance = Math.max(
            nextEnterDistance,
            this.requiredTrainEntryDistance(enterDistance, item.z, item.routeHalfDepth ?? 0.45, 11),
          );
        }
        if (nextEnterDistance <= enterDistance + 0.0001) break;
        enterDistance = nextEnterDistance;
      }

      const exitDistance = enterDistance + TRAIN_ROUTE_DISTANCE;
      const recycleDistance = this.distance + RECYCLE_Z - segment.group.position.z;
      if (exitDistance + 1 > recycleDistance) {
        train.configure('barrier', train.lane, train.localZ());
      } else {
        train.scheduleTrain(this.distance, enterDistance, exitDistance, TRAIN_ENTRY_Z);
        if (enterDistance <= this.distance + 0.0001) this.trainsEntered += 1;
      }
    }
  }

  private requiredTrainEntryDistance(
    enterDistance: number,
    bodyWorldZ: number,
    bodyHalfDepth: number,
    clearZ: number,
  ): number {
    const bodyZAtEntry = bodyWorldZ + enterDistance - this.distance;
    const gapAtEntry = bodyZAtEntry - TRAIN_ENTRY_Z;
    const clearance = 2.7 + bodyHalfDepth + 0.1;
    const closingDistance = TRAIN_RELATIVE_SPEED * TRAIN_ROUTE_DISTANCE;
    if (gapAtEntry <= -clearance || gapAtEntry >= closingDistance + clearance) return enterDistance;
    return Math.max(enterDistance, this.distance + clearZ + bodyHalfDepth - bodyWorldZ);
  }

  private blocksTrainRoute(train: Obstacle, obstacle: Obstacle): boolean {
    if (obstacle.occupiedLanes.includes(train.lane)) return true;
    const blocked = new Set<number>([train.lane]);
    const rowZ = obstacle.worldZ();
    for (const rowObstacle of this.obstacles) {
      if (!rowObstacle.active || rowObstacle.type === 'train') continue;
      if (Math.abs(rowObstacle.worldZ() - rowZ) > 0.1) continue;
      for (const lane of rowObstacle.occupiedLanes) blocked.add(lane);
    }
    return blocked.size >= 3;
  }

  private reservedTrainLanes(): number[] {
    const lanes: number[] = [];
    for (const obstacle of this.obstacles) {
      if (!obstacle.active || obstacle.type !== 'train' || obstacle.trainExitDistance <= this.distance) continue;
      for (const lane of obstacle.occupiedLanes) {
        if (!lanes.includes(lane)) lanes.push(lane);
      }
    }
    return lanes;
  }

  private countTrainConflicts(
    collectibles: readonly Collectible[],
    protectedItems: readonly ProtectedRouteItem[],
  ): number {
    let conflicts = 0;
    for (const train of this.obstacles) {
      if (!train.active || train.type !== 'train' || !train.group.visible) continue;
      for (const obstacle of this.obstacles) {
        if (obstacle === train || !obstacle.active || !obstacle.occupiedLanes.includes(train.lane)) continue;
        const overlapDistance = train.halfDepth + obstacle.halfDepth + 0.1;
        if (Math.abs(train.worldZ() - obstacle.worldZ()) < overlapDistance) conflicts += 1;
      }
      for (const item of collectibles) {
        if (!item.active || item.routeProtected === false || Math.abs(item.x - train.worldX()) >= 0.8) continue;
        if (Math.abs(train.worldZ() - item.z) < train.halfDepth + item.routeHalfDepth + 0.1) conflicts += 1;
      }
      for (const item of protectedItems) {
        if (!item.active || item.routeProtected === false || Math.abs(item.x - train.worldX()) >= 0.8) continue;
        if (Math.abs(train.worldZ() - item.z) < train.halfDepth + (item.routeHalfDepth ?? 0.45) + 0.1) {
          conflicts += 1;
        }
      }
    }
    return conflicts;
  }

  private hasFullLaneWall(): boolean {
    for (const boundaryObstacle of this.obstacles) {
      if (!boundaryObstacle.active) continue;
      const halfDepth = boundaryObstacle.halfDepth + 0.38;
      if (this.isFullLaneWallAt(boundaryObstacle.worldZ() - halfDepth)) return true;
      if (this.isFullLaneWallAt(boundaryObstacle.worldZ() + halfDepth)) return true;
    }
    return false;
  }

  private isFullLaneWallAt(z: number): boolean {
    let lane0 = false;
    let lane1 = false;
    let lane2 = false;
    for (const obstacle of this.obstacles) {
      if (!obstacle.active || Math.abs(obstacle.worldZ() - z) > obstacle.halfDepth + 0.381) continue;
      for (const lane of obstacle.occupiedLanes) {
        if (lane === 0) lane0 = true;
        else if (lane === 1) lane1 = true;
        else if (lane === 2) lane2 = true;
      }
      if (lane0 && lane1 && lane2) return true;
    }
    return false;
  }
}

function translatedBox(width: number, height: number, depth: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

function createTrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 256, 0);
  gradient.addColorStop(0, '#70829a');
  gradient.addColorStop(0.5, '#a6b3c1');
  gradient.addColorStop(1, '#70829a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 512);

  context.strokeStyle = '#3c4b61';
  context.lineWidth = 3;
  for (const y of [2, 128, 256, 384, 510]) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(256, y);
    context.stroke();
  }
  context.fillStyle = '#5c6d84';
  for (const x of [18, 95, 172]) {
    for (const y of [34, 162, 290, 418]) {
      context.fillRect(x, y, 66, 44);
      context.fillStyle = '#bac5d0';
      context.fillRect(x + 5, y + 5, 56, 3);
      context.fillStyle = '#5c6d84';
    }
  }
  context.fillStyle = '#d1a63b';
  for (let x = -20; x < 276; x += 30) {
    context.save();
    context.translate(x, 250);
    context.rotate(-0.55);
    context.fillRect(0, 0, 13, 36);
    context.restore();
  }
  context.fillStyle = '#4a596e';
  for (let index = 0; index < 48; index += 1) {
    const x = (index * 73 + 19) % 256;
    const y = (index * 137 + 41) % 512;
    context.fillRect(x, y, 2 + index % 3, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}
