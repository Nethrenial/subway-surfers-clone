import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Obstacle, type ObstacleResources } from '../entities/Obstacle';
import { createSegmentPattern, type HazardPlacement } from './PatternGenerator';

export type ObstacleTemplates = Record<'barrier' | 'hurdle' | 'gate' | 'drone' | 'train', THREE.Object3D>;
import type { SeededRandom } from '../utils/random';

const SEGMENT_LENGTH = 12;
const SEGMENT_COUNT = 10;
const RECYCLE_Z = 17;

class TrackSegment {
  readonly group = new THREE.Group();
  readonly obstacles: Obstacle[] = [];

  constructor(
    index: number,
    obstacleResources: ObstacleResources,
    deckGeometry: THREE.BufferGeometry,
    markingGeometry: THREE.BufferGeometry,
    trackMaterial: THREE.Material,
    laneMaterial: THREE.Material,
  ) {
    const deck = new THREE.Mesh(deckGeometry, trackMaterial);
    deck.position.y = -0.18;
    deck.receiveShadow = true;
    this.group.add(deck);

    const markings = new THREE.Mesh(markingGeometry, laneMaterial);
    markings.receiveShadow = true;
    this.group.add(markings);

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
      if (placement) this.obstacles[i].configure(placement.type, placement.lane, placement.z, placement.motionAmplitude);
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
    const deckGeometry = new THREE.BoxGeometry(7.8, 0.28, SEGMENT_LENGTH);
    const markingParts = [
      translatedBox(0.055, 0.018, SEGMENT_LENGTH - 0.55, -1.175, 0.012, 0),
      translatedBox(0.055, 0.018, SEGMENT_LENGTH - 0.55, 1.175, 0.012, 0),
      translatedBox(0.16, 0.11, SEGMENT_LENGTH, -3.82, 0.08, 0),
      translatedBox(0.16, 0.11, SEGMENT_LENGTH, 3.82, 0.08, 0),
    ];
    const markingGeometry = mergeGeometries(markingParts, false);
    for (const part of markingParts) part.dispose();
    if (!markingGeometry) throw new Error('Could not merge track marking geometry.');
    this.geometries.push(deckGeometry, markingGeometry);
    const obstacleResources = this.createObstacleResources();

    for (let i = 0; i < SEGMENT_COUNT; i += 1) {
      const segment = new TrackSegment(
        i,
        obstacleResources,
        deckGeometry,
        markingGeometry,
        trackMaterial,
        laneMaterial,
      );
      this.segments.push(segment);
      this.obstacles.push(...segment.obstacles);
      this.group.add(segment.group);
    }
    this.reset(rng);
  }

  update(delta: number, elapsed: number, speed: number): void {
    this.distance += speed * delta;
    let minZ = Infinity;
    for (const segment of this.segments) minZ = Math.min(minZ, segment.group.position.z);

    for (const segment of this.segments) {
      for (const obstacle of segment.obstacles) {
        obstacle.previousWorldZ = obstacle.worldZ();
        if (obstacle.active) {
          obstacle.updateMotion(elapsed);
          const worldZ = obstacle.worldZ();
          obstacle.group.visible = worldZ > -52 && worldZ < 16;
        }
      }
      segment.group.position.z += speed * delta;
      if (segment.group.position.z > RECYCLE_Z) {
        segment.group.position.z = minZ - SEGMENT_LENGTH;
        minZ = segment.group.position.z;
        segment.configure(createSegmentPattern(this.generation, this.rng));
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
      segment.configure(createSegmentPattern(this.generation, this.rng));
      this.generation += 1;
      for (const obstacle of segment.obstacles) obstacle.previousWorldZ = obstacle.worldZ();
    }
  }

  setObstacleTemplates(templates: ObstacleTemplates): void {
    for (const obstacle of this.obstacles) {
      for (const type of Object.keys(templates) as (keyof ObstacleTemplates)[]) {
        obstacle.setProfileModel(type, templates[type].clone(true));
      }
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
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
}

function translatedBox(width: number, height: number, depth: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}
