import * as THREE from 'three';

export class MaterialLibrary {
  private readonly materials = new Map<string, THREE.Material>();
  private readonly textures: THREE.Texture[] = [];

  constructor() {
    const panelTexture = this.createPanelTexture();
    this.add('NR_Ceramic', new THREE.MeshPhysicalMaterial({
      color: '#91a8b9', roughness: 0.38, metalness: 0.04, clearcoat: 0.28, clearcoatRoughness: 0.3,
    }));
    this.add('NR_Indigo', new THREE.MeshStandardMaterial({
      color: '#123b82', map: panelTexture, roughness: 0.38, metalness: 0.25,
    }));
    this.add('NR_IndigoMatte', new THREE.MeshStandardMaterial({
      color: '#17486f', map: panelTexture, roughness: 0.7, metalness: 0.04,
    }));
    this.add('NR_Coral', new THREE.MeshStandardMaterial({
      color: '#ff3977', emissive: '#861038', emissiveIntensity: 0.32, roughness: 0.34, metalness: 0.12,
    }));
    this.add('NR_Cyan', new THREE.MeshStandardMaterial({
      color: '#39ddff', emissive: '#047caa', emissiveIntensity: 1.15, roughness: 0.28, metalness: 0.16,
    }));
    this.add('NR_Gold', new THREE.MeshStandardMaterial({
      color: '#ffb531', emissive: '#8b4200', emissiveIntensity: 0.38, roughness: 0.28, metalness: 0.58,
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
    for (const texture of this.textures) texture.dispose();
  }

  private add(name: string, material: THREE.Material): void {
    material.name = name;
    this.materials.set(name, material);
  }

  private createPanelTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#d3dbe8';
    context.fillRect(0, 0, 128, 128);
    context.fillStyle = '#8995aa';
    context.fillRect(0, 0, 128, 4);
    context.fillRect(0, 124, 128, 4);
    context.fillRect(0, 0, 4, 128);
    context.fillRect(124, 0, 4, 128);
    context.fillStyle = '#a7b3c5';
    context.fillRect(12, 12, 104, 2);
    context.fillRect(12, 114, 104, 2);
    context.fillStyle = '#4fdcf2';
    context.fillRect(16, 20, 30, 3);
    context.fillRect(82, 105, 28, 3);
    context.fillStyle = '#657188';
    for (const [x, y] of [[12, 12], [116, 12], [12, 116], [116, 116]]) {
      context.beginPath();
      context.arc(x, y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    this.textures.push(texture);
    return texture;
  }
}
