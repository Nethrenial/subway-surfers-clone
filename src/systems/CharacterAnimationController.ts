import * as THREE from 'three';
import type { PlayerState } from '../entities/Player';

interface AnimatedPart {
  object: THREE.Object3D;
  baseRotation: THREE.Euler;
  basePosition: THREE.Vector3;
}

export class CharacterAnimationController {
  private readonly parts = new Map<string, AnimatedPart>();
  private time = 0;

  constructor(root: THREE.Object3D) {
    for (const name of [
      'UpperArm_L', 'UpperArm_R', 'ForearmGuard_L', 'ForearmGuard_R',
      'Thigh_L', 'Thigh_R', 'Shin_L', 'Shin_R', 'Helmet', 'RelayPack',
    ]) {
      const object = root.getObjectByName(name);
      if (object) this.parts.set(name, {
        object,
        baseRotation: object.rotation.clone(),
        basePosition: object.position.clone(),
      });
    }
  }

  update(delta: number, state: PlayerState, speedRatio: number): void {
    this.time += delta * THREE.MathUtils.lerp(8, 13, speedRatio);
    const stride = Math.sin(this.time);
    const counter = Math.sin(this.time + Math.PI);
    this.resetParts();

    if (state === 'running') {
      this.rotate('UpperArm_L', stride * 0.42, 0, 0);
      this.rotate('UpperArm_R', counter * 0.42, 0, 0);
      this.rotate('ForearmGuard_L', Math.max(0, -stride) * 0.34, 0, 0);
      this.rotate('ForearmGuard_R', Math.max(0, -counter) * 0.34, 0, 0);
      this.rotate('Thigh_L', counter * 0.34, 0, 0);
      this.rotate('Thigh_R', stride * 0.34, 0, 0);
      this.rotate('Shin_L', Math.max(0, stride) * 0.3, 0, 0);
      this.rotate('Shin_R', Math.max(0, counter) * 0.3, 0, 0);
      this.move('Helmet', 0, 0, Math.abs(stride) * 0.025);
      this.move('RelayPack', 0, 0, Math.abs(counter) * 0.018);
    } else if (state === 'jumping') {
      this.rotate('UpperArm_L', -1.0, 0, -0.12);
      this.rotate('UpperArm_R', -1.0, 0, 0.12);
      this.rotate('Thigh_L', 0.55, 0, 0);
      this.rotate('Thigh_R', -0.2, 0, 0);
      this.rotate('Shin_L', -0.48, 0, 0);
    } else if (state === 'rolling') {
      this.rotate('UpperArm_L', -0.65, 0, 0.35);
      this.rotate('UpperArm_R', -0.65, 0, -0.35);
      this.rotate('Thigh_L', 0.8, 0, 0);
      this.rotate('Thigh_R', 0.8, 0, 0);
      this.rotate('Shin_L', -0.75, 0, 0);
      this.rotate('Shin_R', -0.75, 0, 0);
    }
  }

  private resetParts(): void {
    for (const part of this.parts.values()) {
      part.object.rotation.copy(part.baseRotation);
      part.object.position.copy(part.basePosition);
    }
  }

  private rotate(name: string, x: number, y: number, z: number): void {
    const part = this.parts.get(name);
    if (!part) return;
    part.object.rotation.x += x;
    part.object.rotation.y += y;
    part.object.rotation.z += z;
  }

  private move(name: string, x: number, y: number, z: number): void {
    const part = this.parts.get(name);
    if (!part) return;
    part.object.position.x += x;
    part.object.position.y += y;
    part.object.position.z += z;
  }
}
