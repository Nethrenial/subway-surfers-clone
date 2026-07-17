import * as THREE from 'three';

export type ObstacleType = 'barrier' | 'hurdle' | 'gate' | 'drone' | 'train';

export interface ObstacleResources {
  barrier: THREE.Group;
  hurdle: THREE.Group;
  gate: THREE.Group;
  drone: THREE.Group;
  train: THREE.Group;
}

export class Obstacle {
  readonly group = new THREE.Group();
  active = false;
  previousWorldZ = 0;
  type: ObstacleType = 'barrier';
  halfWidth = 0.92;
  halfDepth = 0.34;
  minY = 0;
  maxY = 2.35;
  private baseX = 0;
  private motionAmplitude = 0;
  private motionPhase = 0;

  private readonly profiles: Record<ObstacleType, THREE.Object3D>;

  constructor(resources: ObstacleResources) {
    this.profiles = {
      barrier: resources.barrier.clone(true),
      hurdle: resources.hurdle.clone(true),
      gate: resources.gate.clone(true),
      drone: resources.drone.clone(true),
      train: resources.train.clone(true),
    };
    for (const profile of Object.values(this.profiles)) {
      profile.visible = false;
      this.group.add(profile);
    }
    this.group.visible = false;
  }

  setProfileModel(type: ObstacleType, model: THREE.Object3D): void {
    const current = this.profiles[type];
    model.visible = current.visible;
    this.group.remove(current);
    this.profiles[type] = model;
    this.group.add(model);
  }

  configure(type: ObstacleType, lane: number, localZ: number, motionAmplitude = 0): void {
    this.type = type;
    this.active = true;
    this.group.visible = true;
    this.baseX = (lane - 1) * 2.35;
    this.motionAmplitude = motionAmplitude;
    this.motionPhase = lane * 1.7 + localZ * 0.13;
    this.group.position.set(this.baseX, 0, localZ);
    for (const [name, profile] of Object.entries(this.profiles)) profile.visible = name === type;

    if (type === 'hurdle') {
      this.halfWidth = 0.92;
      this.halfDepth = 0.32;
      this.minY = 0;
      this.maxY = 0.88;
    } else if (type === 'gate') {
      this.halfWidth = 0.98;
      this.halfDepth = 0.34;
      this.minY = 1.05;
      this.maxY = 2.45;
    } else if (type === 'drone') {
      this.halfWidth = 0.72;
      this.halfDepth = 0.72;
      this.minY = 0.22;
      this.maxY = 1.72;
    } else if (type === 'train') {
      this.halfWidth = 0.98;
      this.halfDepth = 2.5;
      this.minY = 0;
      this.maxY = 3.1;
    } else {
      this.halfWidth = 0.92;
      this.halfDepth = 0.4;
      this.minY = 0;
      this.maxY = 2.35;
    }
  }

  updateMotion(elapsed: number): void {
    if (this.motionAmplitude === 0) return;
    const sweep = 0.5 + Math.sin(elapsed * 1.75 + this.motionPhase) * 0.5;
    this.group.position.x = this.baseX + this.motionAmplitude * sweep;
    this.group.rotation.y = Math.sin(elapsed * 3 + this.motionPhase) * 0.18;
  }

  disable(): void {
    this.active = false;
    this.group.visible = false;
  }

  worldZ(): number {
    return this.group.parent ? this.group.parent.position.z + this.group.position.z : this.group.position.z;
  }
}
