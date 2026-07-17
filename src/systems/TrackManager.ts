import * as THREE from 'three';
import { Obstacle, type ObstacleResources, type ObstacleType } from '../entities/Obstacle';
import type { SeededRandom } from '../utils/random';

const SEGMENT_LENGTH = 12;
const SEGMENT_COUNT = 10;
const RECYCLE_Z = 17;

interface HazardPlacement {
  lane: number;
  z: number;
  type: ObstacleType;
}

class TrackSegment {
  readonly group = new THREE.Group();
  readonly obstacles: Obstacle[] = [];

  constructor(index: number, obstacleResources: ObstacleResources, trackMaterial: THREE.Material, laneMaterial: THREE.Material) {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7.8, 0.28, SEGMENT_LENGTH), trackMaterial);
    deck.position.y = -0.18;
    deck.receiveShadow = true;
    this.group.add(deck);

    const laneGeometry = new THREE.BoxGeometry(0.055, 0.018, SEGMENT_LENGTH - 0.55);
    for (const x of [-1.175, 1.175]) {
      const lane = new THREE.Mesh(laneGeometry, laneMaterial);
      lane.position.set(x, 0.012, 0);
      this.group.add(lane);
    }

    const edgeGeometry = new THREE.BoxGeometry(0.16, 0.11, SEGMENT_LENGTH);
    for (const x of [-3.82, 3.82]) {
      const edge = new THREE.Mesh(edgeGeometry, laneMaterial);
      edge.position.set(x, 0.08, 0);
      this.group.add(edge);
    }

    for (let i = 0; i < 4; i += 1) {
      const obstacle = new Obstacle(obstacleResources);
      this.obstacles.push(obstacle);
      this.group.add(obstacle.group);
    }
    this.group.name = `track-segment-${index}`;
  }

  configure(placements: readonly HazardPlacement[]): void {
    for (let i = 0; i < this.obstacles.length; i += 1) {
      const placement = placements[i];
      if (placement) this.obstacles[i].configure(placement.type, placement.lane, placement.z);
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
  private generation = 0;

  constructor(private rng: SeededRandom) {
    const trackMaterial = new THREE.MeshStandardMaterial({ color: '#10243a', roughness: 0.72, metalness: 0.18 });
    const laneMaterial = new THREE.MeshStandardMaterial({
      color: '#5ee8ff',
      emissive: '#087f9b',
      emissiveIntensity: 1.8,
      roughness: 0.28,
    });
    this.materials.push(trackMaterial, laneMaterial);
    const obstacleResources = this.createObstacleResources();

    for (let i = 0; i < SEGMENT_COUNT; i += 1) {
      const segment = new TrackSegment(i, obstacleResources, trackMaterial, laneMaterial);
      this.segments.push(segment);
      this.obstacles.push(...segment.obstacles);
      this.group.add(segment.group);
    }
    this.reset(rng);
  }

  update(delta: number, speed: number): void {
    this.distance += speed * delta;
    let minZ = Infinity;
    for (const segment of this.segments) minZ = Math.min(minZ, segment.group.position.z);

    for (const segment of this.segments) {
      for (const obstacle of segment.obstacles) obstacle.previousWorldZ = obstacle.worldZ();
      segment.group.position.z += speed * delta;
      if (segment.group.position.z > RECYCLE_Z) {
        segment.group.position.z = minZ - SEGMENT_LENGTH;
        minZ = segment.group.position.z;
        segment.configure(this.createPattern(this.generation));
        this.generation += 1;
        for (const obstacle of segment.obstacles) obstacle.previousWorldZ = obstacle.worldZ();
      }
    }
  }

  reset(rng: SeededRandom): void {
    this.rng = rng;
    this.distance = 0;
    this.generation = 0;
    for (let i = 0; i < this.segments.length; i += 1) {
      const segment = this.segments[i];
      segment.group.position.set(0, 0, 4 - i * SEGMENT_LENGTH);
      segment.configure(this.createPattern(this.generation));
      this.generation += 1;
      for (const obstacle of segment.obstacles) obstacle.previousWorldZ = obstacle.worldZ();
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }

  private createPattern(generation: number): HazardPlacement[] {
    if (generation < 2) return [];
    const safeLane = Math.floor(this.rng() * 3);
    const typeRoll = this.rng();
    const type: ObstacleType = typeRoll < 0.38 ? 'hurdle' : typeRoll < 0.68 ? 'gate' : 'barrier';
    const placements: HazardPlacement[] = [];
    const dense = generation > 5 && this.rng() > 0.38;
    const blockedLanes = [0, 1, 2].filter((lane) => lane !== safeLane);
    placements.push({ lane: blockedLanes[0], z: -1.8, type });
    if (dense) placements.push({ lane: blockedLanes[1], z: -1.8, type: this.rng() > 0.5 ? type : 'barrier' });
    if (generation > 4 && this.rng() > 0.5) {
      const secondSafeLane = blockedLanes[Math.floor(this.rng() * blockedLanes.length)];
      const secondBlocked = [0, 1, 2].filter((lane) => lane !== secondSafeLane);
      placements.push({ lane: secondBlocked[0], z: 3.4, type: this.rng() > 0.5 ? 'hurdle' : 'gate' });
      if (this.rng() > 0.62) placements.push({ lane: secondBlocked[1], z: 3.4, type: 'barrier' });
    }
    return placements;
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
    return { barrier, hurdle, gate };
  }
}
