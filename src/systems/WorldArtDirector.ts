import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sampleTrackChordRenderPose, type TrackRenderPose } from './TrackCurve';

const MODULE_LENGTH = 22;
const MODULE_COUNT = 6;
const RECYCLE_Z = 26;

export interface WorldTemplates {
  arch: THREE.Object3D;
  pylon: THREE.Object3D;
  lamp: THREE.Object3D;
  billboard: THREE.Object3D;
  utility: THREE.Object3D;
  buildingA: THREE.Object3D;
  buildingB: THREE.Object3D;
}

interface WorldModule {
  root: THREE.Group;
  logicalZ: number;
}

export class WorldArtDirector {
  readonly group = new THREE.Group();
  private readonly modules: WorldModule[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly platformMaterial = new THREE.MeshStandardMaterial({ color: '#081526', roughness: 0.84, metalness: 0.08 });
  private readonly renderPose: TrackRenderPose = { x: 0, y: 0, z: 0, pitch: 0 };

  constructor(templates: WorldTemplates) {
    for (let index = 0; index < MODULE_COUNT; index += 1) {
      const module = new THREE.Group();
      module.position.z = 4 - index * MODULE_LENGTH;
      const platformGeometry = new THREE.BoxGeometry(4.8, 0.42, MODULE_LENGTH);
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

      this.mergeModule(module);
      platformGeometry.dispose();
      const worldModule = { root: module, logicalZ: 4 - index * MODULE_LENGTH };
      this.modules.push(worldModule);
      this.group.add(module);
      this.syncModule(worldModule);
    }
  }

  update(delta: number, speed: number): void {
    let minZ = Infinity;
    for (const module of this.modules) minZ = Math.min(minZ, module.logicalZ);
    for (const module of this.modules) {
      const logicalZ = module.logicalZ + speed * delta;
      if (logicalZ > RECYCLE_Z) {
        module.logicalZ = minZ - MODULE_LENGTH;
        minZ = module.logicalZ;
      } else {
        module.logicalZ = logicalZ;
      }
      this.syncModule(module);
    }
  }

  reset(): void {
    for (let index = 0; index < this.modules.length; index += 1) {
      this.modules[index].logicalZ = 4 - index * MODULE_LENGTH;
      this.syncModule(this.modules[index]);
    }
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.platformMaterial.dispose();
  }

  private mergeModule(module: THREE.Group): void {
    module.updateWorldMatrix(true, true);
    const inverse = module.matrixWorld.clone().invert();
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    module.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const list = groups.get(material) ?? [];
      list.push(geometry);
      groups.set(material, list);
    });
    module.clear();
    for (const [material, sourceGeometries] of groups) {
      const geometry = mergeGeometries(sourceGeometries, false);
      for (const source of sourceGeometries) source.dispose();
      if (!geometry) continue;
      this.geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      module.add(mesh);
    }
  }

  private syncModule(module: WorldModule): void {
    sampleTrackChordRenderPose(0, module.logicalZ, MODULE_LENGTH * 0.5, this.renderPose);
    module.root.position.set(this.renderPose.x, this.renderPose.y, this.renderPose.z);
    module.root.rotation.set(this.renderPose.pitch, 0, 0);
  }
}
