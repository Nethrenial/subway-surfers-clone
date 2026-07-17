import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { MaterialLibrary } from './MaterialLibrary';

export type AssetId = 'courier' | 'barrier' | 'hurdle' | 'gate' | 'drone' | 'train' | 'rewards' | 'world';

export interface AssetDiagnostics {
  files: number;
  meshes: number;
  triangles: number;
  materials: number;
}

const PATHS: Record<AssetId, string> = {
  courier: '/assets/models/neon-courier.glb',
  barrier: '/assets/models/barrier-premium.glb',
  hurdle: '/assets/models/hurdle-premium.glb',
  gate: '/assets/models/gate-premium.glb',
  drone: '/assets/models/drone-premium.glb',
  train: '/assets/models/train-premium.glb',
  rewards: '/assets/models/reward-power-kit.glb',
  world: '/assets/models/world-kit.glb',
};

export class AssetManager {
  readonly diagnostics: AssetDiagnostics = { files: 0, meshes: 0, triangles: 0, materials: 0 };

  private readonly loader = new GLTFLoader();
  private readonly assets = new Map<AssetId, GLTF>();
  private readonly mergedTemplates = new Map<string, THREE.Group>();
  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private optimizedHero: THREE.Group | null = null;

  constructor(private readonly materials: MaterialLibrary) {}

  async loadAll(onProgress: (progress: number) => void): Promise<void> {
    const entries = Object.entries(PATHS) as [AssetId, string][];
    let completed = 0;
    await Promise.all(entries.map(async ([id, path]) => {
      const gltf = await this.loader.loadAsync(path);
      this.prepareMaterials(gltf.scene);
      this.assets.set(id, gltf);
      completed += 1;
      onProgress(completed / entries.length);
    }));
    this.computeDiagnostics();
  }

  cloneHero(): THREE.Object3D {
    this.optimizedHero ??= this.createOptimizedHero();
    const clone = this.optimizedHero.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }

  cloneMerged(id: AssetId, rootName?: string): THREE.Group {
    const key = `${id}:${rootName ?? 'scene'}`;
    let template = this.mergedTemplates.get(key);
    if (!template) {
      template = this.mergeByMaterial(this.requireRoot(id, rootName));
      this.mergedTemplates.set(key, template);
    }
    return template.clone(true);
  }

  combinedGeometry(id: AssetId, rootName: string): THREE.BufferGeometry {
    const root = this.requireRoot(id, rootName);
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    const geometries: THREE.BufferGeometry[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      geometries.push(geometry);
    });
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) throw new Error(`Could not merge geometry for ${id}:${rootName}`);
    return merged;
  }

  dispose(): void {
    for (const geometry of this.ownedGeometries) geometry.dispose();
    this.ownedGeometries.length = 0;
    this.assets.clear();
    this.mergedTemplates.clear();
  }

  private requireRoot(id: AssetId, rootName?: string): THREE.Object3D {
    const gltf = this.assets.get(id);
    if (!gltf) throw new Error(`Asset not loaded: ${id}`);
    if (!rootName) return gltf.scene;
    const root = gltf.scene.getObjectByName(rootName);
    if (!root) throw new Error(`Missing ${rootName} in ${id}`);
    return root;
  }

  private prepareMaterials(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const imported = Array.isArray(object.material) ? object.material[0] : object.material;
      object.material = this.materials.resolve(imported?.name ?? 'NR_IndigoMatte');
    });
  }

  private mergeByMaterial(root: THREE.Object3D): THREE.Group {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert();
    const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
      const list = groups.get(material) ?? [];
      list.push(geometry);
      groups.set(material, list);
    });

    const mergedRoot = new THREE.Group();
    mergedRoot.name = `${root.name}_Merged`;
    for (const [material, geometries] of groups) {
      const geometry = mergeGeometries(geometries, false);
      for (const source of geometries) source.dispose();
      if (!geometry) continue;
      this.ownedGeometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mergedRoot.add(mesh);
    }
    return mergedRoot;
  }

  private createOptimizedHero(): THREE.Group {
    const source = this.requireRoot('courier', 'CourierRoot');
    source.updateWorldMatrix(true, true);
    const inverse = source.matrixWorld.clone().invert();
    const animatedNames = new Set([
      'UpperArm_L', 'UpperArm_R', 'ForearmGuard_L', 'ForearmGuard_R',
      'Thigh_L', 'Thigh_R', 'Shin_L', 'Shin_R', 'Helmet', 'RelayPack',
    ]);
    const staticGroups = new Map<THREE.Material, THREE.BufferGeometry[]>();
    const root = new THREE.Group();
    root.name = 'CourierRoot';

    source.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const relative = inverse.clone().multiply(object.matrixWorld);
      if (animatedNames.has(object.name)) {
        const clone = new THREE.Mesh(object.geometry, object.material);
        clone.name = object.name;
        relative.decompose(clone.position, clone.quaternion, clone.scale);
        clone.castShadow = true;
        clone.receiveShadow = true;
        root.add(clone);
        return;
      }
      const material = Array.isArray(object.material) ? object.material[0] : object.material;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(relative);
      const list = staticGroups.get(material) ?? [];
      list.push(geometry);
      staticGroups.set(material, list);
    });

    for (const [material, geometries] of staticGroups) {
      const geometry = mergeGeometries(geometries, false);
      for (const sourceGeometry of geometries) sourceGeometry.dispose();
      if (!geometry) continue;
      this.ownedGeometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `CourierStatic_${material.name}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    return root;
  }

  private computeDiagnostics(): void {
    const materials = new Set<string>();
    this.diagnostics.files = this.assets.size;
    for (const gltf of this.assets.values()) {
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        this.diagnostics.meshes += 1;
        const geometry = object.geometry;
        this.diagnostics.triangles += geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
        const material = Array.isArray(object.material) ? object.material[0] : object.material;
        materials.add(material.name);
      });
    }
    this.diagnostics.triangles = Math.round(this.diagnostics.triangles);
    this.diagnostics.materials = materials.size;
  }
}
