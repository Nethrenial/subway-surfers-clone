import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const MODULE_LENGTH = 22;
const MODULES_PER_BATCH = 3;
const BATCH_COUNT = 2;
const BATCH_LENGTH = MODULE_LENGTH * MODULES_PER_BATCH;
const RECYCLE_Z = 18 + MODULE_LENGTH * (MODULES_PER_BATCH - 1);

export interface WorldTemplates {
  arch: THREE.Object3D;
  pylon: THREE.Object3D;
  lamp: THREE.Object3D;
  billboard: THREE.Object3D;
  utility: THREE.Object3D;
  buildingA: THREE.Object3D;
  buildingB: THREE.Object3D;
}

export class WorldArtDirector {
  readonly group = new THREE.Group();
  private readonly segments: THREE.Group[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly platformMaterial = new THREE.MeshStandardMaterial({ color: '#081526', roughness: 0.84, metalness: 0.08 });

  constructor(templates: WorldTemplates) {
    for (let batchIndex = 0; batchIndex < BATCH_COUNT; batchIndex += 1) {
      const segment = new THREE.Group();
      segment.position.z = 4 - batchIndex * BATCH_LENGTH;
      const platformGeometry = new THREE.BoxGeometry(4.8, 0.42, MODULE_LENGTH);
      for (let moduleIndex = 0; moduleIndex < MODULES_PER_BATCH; moduleIndex += 1) {
        const index = batchIndex * MODULES_PER_BATCH + moduleIndex;
        const module = new THREE.Group();
        module.position.z = -moduleIndex * MODULE_LENGTH;
        const leftBuilding = (index % 2 === 0 ? templates.buildingA : templates.buildingB).clone(true);
        const rightBuilding = (index % 3 === 0 ? templates.buildingB : templates.buildingA).clone(true);
        leftBuilding.position.set(-8.2 - (index % 2), 0, -2);
        rightBuilding.position.set(8.2 + (index % 3) * 0.5, 0, 2);
        leftBuilding.rotation.y = Math.PI;
        module.add(leftBuilding, rightBuilding);

        const leftNear = (index % 2 === 0 ? templates.pylon : templates.lamp).clone(true);
        const rightNear = (index % 2 === 0 ? templates.lamp : templates.pylon).clone(true);
        leftNear.position.set(-4.55, 0, 3.4);
        rightNear.position.set(4.55, 0, -3.5);
        rightNear.rotation.y = Math.PI;
        module.add(leftNear, rightNear);

        if (index % 3 === 1) {
          const billboard = templates.billboard.clone(true);
          billboard.position.set(index % 2 === 0 ? -6 : 6, 0, 0);
          billboard.rotation.y = index % 2 === 0 ? 0.28 : Math.PI - 0.28;
          module.add(billboard);
        } else {
          const utility = templates.utility.clone(true);
          utility.position.set(index % 2 === 0 ? -5.7 : 5.7, 0, 0);
          module.add(utility);
        }

        if (index % 3 === 0) {
          const arch = templates.arch.clone(true);
          arch.position.z = -8;
          module.add(arch);
        }
        const leftPlatform = new THREE.Mesh(platformGeometry, this.platformMaterial);
        const rightPlatform = new THREE.Mesh(platformGeometry, this.platformMaterial);
        leftPlatform.position.set(-6.4, -0.32, 0);
        rightPlatform.position.set(6.4, -0.32, 0);
        module.add(leftPlatform, rightPlatform);
        segment.add(module);
      }
      this.mergeSegment(segment);
      platformGeometry.dispose();
      this.segments.push(segment);
      this.group.add(segment);
    }
  }

  update(delta: number, speed: number): void {
    let minZ = Infinity;
    for (const segment of this.segments) minZ = Math.min(minZ, segment.position.z);
    for (const segment of this.segments) {
      segment.position.z += speed * delta;
      if (segment.position.z > RECYCLE_Z) {
        segment.position.z = minZ - BATCH_LENGTH;
        minZ = segment.position.z;
      }
    }
  }

  reset(): void {
    for (let index = 0; index < this.segments.length; index += 1) {
      this.segments[index].position.z = 4 - index * BATCH_LENGTH;
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.platformMaterial.dispose();
  }

  private mergeSegment(segment: THREE.Group): void {
    segment.updateWorldMatrix(true, true);
    const inverse = segment.matrixWorld.clone().invert();
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    segment.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const list = groups.get(material) ?? [];
      list.push(geometry);
      groups.set(material, list);
    });
    segment.clear();
    for (const [material, sourceGeometries] of groups) {
      const geometry = mergeGeometries(sourceGeometries, false);
      for (const source of sourceGeometries) source.dispose();
      if (!geometry) continue;
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      segment.add(mesh);
    }
  }
}
