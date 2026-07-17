import * as THREE from 'three';
import { ObjectPool, type Poolable } from '../core/ObjectPool';

class BurstParticle implements Poolable {
  active = false;
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vy = 0;
  vz = 0;
  life = 0;

  reset(): void {
    this.active = false;
  }
}

export class EffectsManager {
  readonly group = new THREE.Group();

  private readonly pool = new ObjectPool(() => new BurstParticle(), 48);
  private readonly geometry = new THREE.IcosahedronGeometry(0.08, 0);
  private readonly material = new THREE.MeshBasicMaterial({ color: '#ffe17a' });
  private readonly mesh = new THREE.InstancedMesh(this.geometry, this.material, 48);
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();

  constructor() {
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.mesh);
  }

  burst(x: number, y: number, z: number): void {
    for (let i = 0; i < 8; i += 1) {
      const particle = this.pool.acquire();
      if (!particle) return;
      const angle = (i / 8) * Math.PI * 2;
      particle.x = x;
      particle.y = y;
      particle.z = z;
      particle.vx = Math.cos(angle) * 1.8;
      particle.vy = 1.4 + (i % 3) * 0.35;
      particle.vz = Math.sin(angle) * 1.2;
      particle.life = 0.42;
    }
  }

  update(delta: number): void {
    let index = 0;
    for (const particle of this.pool.items) {
      if (!particle.active) continue;
      particle.life -= delta;
      if (particle.life <= 0) {
        this.pool.release(particle);
        continue;
      }
      particle.vy -= 5.5 * delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.z += particle.vz * delta;
      this.position.set(particle.x, particle.y, particle.z);
      this.scale.setScalar(Math.max(0.25, particle.life / 0.42));
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.mesh.setMatrixAt(index++, this.matrix);
    }
    this.mesh.count = index;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset(): void {
    this.pool.releaseAll();
    this.mesh.count = 0;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
