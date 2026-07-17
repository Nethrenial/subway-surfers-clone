import * as THREE from 'three';

export class MaterialLibrary {
  private readonly materials = new Map<string, THREE.Material>();

  constructor() {
    this.add('NR_Ceramic', new THREE.MeshPhysicalMaterial({
      color: '#c8e1eb', roughness: 0.24, metalness: 0.05, clearcoat: 0.72, clearcoatRoughness: 0.18,
    }));
    this.add('NR_Indigo', new THREE.MeshStandardMaterial({ color: '#071c42', roughness: 0.32, metalness: 0.28 }));
    this.add('NR_IndigoMatte', new THREE.MeshStandardMaterial({ color: '#0a2444', roughness: 0.68, metalness: 0.04 }));
    this.add('NR_Coral', new THREE.MeshStandardMaterial({
      color: '#f03c67', emissive: '#8c082d', emissiveIntensity: 0.65, roughness: 0.3, metalness: 0.14,
    }));
    this.add('NR_Cyan', new THREE.MeshStandardMaterial({
      color: '#46eaff', emissive: '#08a9cf', emissiveIntensity: 2.2, roughness: 0.22, metalness: 0.18,
    }));
    this.add('NR_Gold', new THREE.MeshStandardMaterial({
      color: '#ff9a27', emissive: '#9b3700', emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.65,
    }));
    this.add('NR_Lime', new THREE.MeshStandardMaterial({
      color: '#65f875', emissive: '#18a83c', emissiveIntensity: 1.35, roughness: 0.28, metalness: 0.04,
    }));
    this.add('NR_DarkMetal', new THREE.MeshStandardMaterial({ color: '#070b12', roughness: 0.24, metalness: 0.86 }));
    this.add('NR_Rubber', new THREE.MeshStandardMaterial({ color: '#06090d', roughness: 0.92, metalness: 0 }));
    this.add('NR_Skin', new THREE.MeshStandardMaterial({ color: '#793c2d', roughness: 0.72, metalness: 0 }));
    this.add('NR_Visor', new THREE.MeshPhysicalMaterial({
      color: '#12647c', emissive: '#00a7d5', emissiveIntensity: 0.7, roughness: 0.08, metalness: 0.28,
      clearcoat: 1, clearcoatRoughness: 0.05,
    }));
  }

  resolve(importedName: string): THREE.Material {
    const baseName = importedName.replace(/\.\d+$/, '');
    return this.materials.get(baseName) ?? this.materials.get('NR_IndigoMatte')!;
  }

  get(name: string): THREE.Material {
    return this.materials.get(name)!;
  }

  dispose(): void {
    for (const material of this.materials.values()) material.dispose();
  }

  private add(name: string, material: THREE.Material): void {
    material.name = name;
    this.materials.set(name, material);
  }
}
