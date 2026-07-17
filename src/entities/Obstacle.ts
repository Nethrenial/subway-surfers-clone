import * as THREE from 'three';

export type ObstacleType = 'barrier' | 'hurdle' | 'gate';

export interface ObstacleResources {
  barrier: THREE.Group;
  hurdle: THREE.Group;
  gate: THREE.Group;
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

  private readonly profiles: Record<ObstacleType, THREE.Group>;

  constructor(resources: ObstacleResources) {
    this.profiles = {
      barrier: resources.barrier.clone(true),
      hurdle: resources.hurdle.clone(true),
      gate: resources.gate.clone(true),
    };
    for (const profile of Object.values(this.profiles)) {
      profile.visible = false;
      this.group.add(profile);
    }
    this.group.visible = false;
  }

  configure(type: ObstacleType, lane: number, localZ: number): void {
    this.type = type;
    this.active = true;
    this.group.visible = true;
    this.group.position.set((lane - 1) * 2.35, 0, localZ);
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
    } else {
      this.halfWidth = 0.92;
      this.halfDepth = 0.4;
      this.minY = 0;
      this.maxY = 2.35;
    }
  }

  disable(): void {
    this.active = false;
    this.group.visible = false;
  }

  worldZ(): number {
    return this.group.parent ? this.group.parent.position.z + this.group.position.z : this.group.position.z;
  }
}
