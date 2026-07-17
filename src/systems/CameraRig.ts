import * as THREE from 'three';

export class CameraRig {
  private readonly desired = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private trauma = 0;
  private time = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.snap(0);
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(delta: number, playerX: number, reducedMotion: boolean): void {
    this.time += delta;
    this.desired.set(playerX * 0.14, 5.25, 10.6);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-7 * delta));
    this.lookTarget.set(playerX * 0.08, 1.15, -7.5);
    this.camera.lookAt(this.lookTarget);

    this.trauma = Math.max(0, this.trauma - delta * 1.8);
    if (this.trauma > 0 && !reducedMotion) {
      const shake = this.trauma * this.trauma;
      this.camera.position.x += Math.sin(this.time * 43) * 0.18 * shake;
      this.camera.position.y += Math.cos(this.time * 37) * 0.12 * shake;
      this.camera.rotation.z += Math.sin(this.time * 51) * 0.025 * shake;
    }
  }

  snap(playerX: number): void {
    this.camera.position.set(playerX * 0.14, 5.25, 10.6);
    this.camera.lookAt(playerX * 0.08, 1.15, -7.5);
  }
}
