import * as THREE from 'three';
import type { PlayerState } from '../entities/Player';

interface AnimatedPart {
  object: THREE.Object3D;
  baseRotation: THREE.Euler;
  basePosition: THREE.Vector3;
  baseScale: THREE.Vector3;
  targetRotation: THREE.Euler;
  targetPosition: THREE.Vector3;
  targetScale: THREE.Vector3;
  targetQuaternion: THREE.Quaternion;
}

export class CharacterAnimationController {
  private readonly parts = new Map<string, AnimatedPart>();
  private time = 0;
  private stateTime = 0;
  private landingTime = 0;
  private previousState: PlayerState = 'running';

  constructor(root: THREE.Object3D) {
    for (const name of [
      'Rig_Hips', 'Rig_Spine', 'Rig_Chest', 'Rig_Neck', 'Rig_Head', 'Rig_Pack',
      'Rig_Shoulder_L', 'Rig_Shoulder_R', 'Rig_Elbow_L', 'Rig_Elbow_R',
      'Rig_Wrist_L', 'Rig_Wrist_R', 'Rig_Hip_L', 'Rig_Hip_R',
      'Rig_Knee_L', 'Rig_Knee_R', 'Rig_Ankle_L', 'Rig_Ankle_R',
      'Rig_Ribbon_A', 'Rig_Ribbon_B', 'Rig_Ribbon_C',
    ]) {
      const object = root.getObjectByName(name);
      if (object) this.parts.set(name, {
        object,
        baseRotation: object.rotation.clone(),
        basePosition: object.position.clone(),
        baseScale: object.scale.clone(),
        targetRotation: object.rotation.clone(),
        targetPosition: object.position.clone(),
        targetScale: object.scale.clone(),
        targetQuaternion: object.quaternion.clone(),
      });
    }
  }

  update(
    delta: number,
    state: PlayerState,
    speedRatio: number,
    verticalVelocity: number,
    laneLean: number,
    laneCut: number,
    rollProgress: number,
  ): void {
    if (state !== this.previousState) {
      if (this.previousState === 'jumping' && state === 'running') this.landingTime = 0.22;
      this.previousState = state;
      this.stateTime = 0;
    }
    this.stateTime += delta;
    this.landingTime = Math.max(0, this.landingTime - delta);
    this.time += delta * THREE.MathUtils.lerp(10.5, 15, speedRatio);
    const stride = Math.sin(this.time);
    const counter = -stride;
    const footPlant = Math.max(0, Math.sin(this.time + Math.PI * 0.2));
    const oppositePlant = Math.max(0, Math.sin(this.time + Math.PI * 1.2));
    this.resetTargets();

    if (state === 'running') {
      const landing = this.landingTime / 0.22;
      const compression = Math.sin(landing * Math.PI) * 0.12;
      const cutWeight = Math.abs(laneCut);
      const directionalLean = laneLean * (1 - cutWeight);
      this.move('Rig_Hips', 0, Math.abs(stride) * 0.045 - compression + cutWeight * 0.1, 0);
      this.rotate('Rig_Hips', 0.1 + compression * 0.7, laneCut * 0.16, stride * 0.045 + directionalLean * 0.65 - laneCut * 0.1);
      this.rotate('Rig_Spine', 0.12, counter * 0.055 - laneCut * 0.1, counter * 0.035 + directionalLean * 0.35 + laneCut * 0.04);
      this.rotate('Rig_Chest', -0.04, stride * 0.075 - laneCut * 0.12, directionalLean * 0.45 - laneCut * 0.04);
      this.rotate('Rig_Head', -0.04 + Math.abs(stride) * 0.025, -stride * 0.045 + laneCut * 0.08, -directionalLean * 0.5 + laneCut * 0.04);
      this.rotate('Rig_Shoulder_L', stride * 0.72 - 0.1, 0, -0.08 - directionalLean * 0.35 + laneCut * 0.18);
      this.rotate('Rig_Shoulder_R', counter * 0.72 - 0.1, 0, 0.08 - directionalLean * 0.35 + laneCut * 0.08);
      this.rotate('Rig_Elbow_L', -0.45 - Math.max(0, -stride) * 0.42, 0, 0);
      this.rotate('Rig_Elbow_R', -0.45 - Math.max(0, -counter) * 0.42, 0, 0);
      this.rotate('Rig_Wrist_L', 0.12 + stride * 0.08, 0, -0.08);
      this.rotate('Rig_Wrist_R', 0.12 + counter * 0.08, 0, 0.08);
      this.rotate('Rig_Hip_L', counter * 0.78 - cutWeight * 0.18, 0, -directionalLean * 0.18 + laneCut * 0.18);
      this.rotate('Rig_Hip_R', stride * 0.78 + cutWeight * 0.18, 0, -directionalLean * 0.18 - laneCut * 0.34);
      this.rotate('Rig_Knee_L', -footPlant * 0.92 - cutWeight * (laneCut < 0 ? 0.48 : 0.2), 0, 0);
      this.rotate('Rig_Knee_R', -oppositePlant * 0.92 - cutWeight * (laneCut > 0 ? 0.48 : 0.2), 0, 0);
      this.rotate('Rig_Ankle_L', footPlant * 0.42 - stride * 0.12, 0, 0);
      this.rotate('Rig_Ankle_R', oppositePlant * 0.42 - counter * 0.12, 0, 0);
    } else if (state === 'jumping') {
      const rise = THREE.MathUtils.clamp(verticalVelocity / 10.4, -1, 1);
      const apex = 1 - Math.abs(rise);
      this.move('Rig_Hips', 0, apex * 0.08, 0);
      this.rotate('Rig_Hips', 0.2 - rise * 0.12, laneCut * 0.12, laneLean * 0.45 - laneCut * 0.16);
      this.rotate('Rig_Spine', -0.08 + apex * 0.2, 0, laneLean * 0.3 - laneCut * 0.1);
      this.rotate('Rig_Chest', -0.12, -laneCut * 0.12, laneLean * 0.35 - laneCut * 0.16);
      this.rotate('Rig_Head', 0.08 - rise * 0.08, 0, -laneLean * 0.4);
      this.rotate('Rig_Shoulder_L', -0.62 + apex * 0.9, 0, -0.62 - apex * 0.52);
      this.rotate('Rig_Shoulder_R', -0.62 + apex * 0.9, 0, 0.62 + apex * 0.52);
      this.rotate('Rig_Elbow_L', -0.72, 0, 0);
      this.rotate('Rig_Elbow_R', -0.72, 0, 0);
      this.rotate('Rig_Hip_L', 0.68 + apex * 0.52, 0, -0.12 - apex * 0.22);
      this.rotate('Rig_Hip_R', -0.32 + apex * 0.62, 0, 0.12 + apex * 0.12);
      this.rotate('Rig_Knee_L', -1.18 - apex * 0.28, 0, 0);
      this.rotate('Rig_Knee_R', -0.72 - apex * 0.42, 0, 0);
      this.rotate('Rig_Ankle_L', 0.48, 0, 0);
      this.rotate('Rig_Ankle_R', 0.26, 0, 0);
    } else if (state === 'rolling') {
      const tuck = Math.sin(Math.min(1, rollProgress) * Math.PI);
      this.move('Rig_Hips', 0, -0.12 * tuck, 0);
      const spin = rollProgress * rollProgress * (3 - 2 * rollProgress);
      this.rotate('Rig_Hips', Math.PI * 2 * spin - 0.24, 0, laneLean * 0.25);
      this.rotate('Rig_Spine', 0.62, 0, 0);
      this.rotate('Rig_Chest', 0.28, 0, 0);
      this.rotate('Rig_Head', -0.48, 0, 0);
      this.rotate('Rig_Shoulder_L', -1.08, 0, 0.5);
      this.rotate('Rig_Shoulder_R', -1.08, 0, -0.5);
      this.rotate('Rig_Elbow_L', -1.35, 0, 0);
      this.rotate('Rig_Elbow_R', -1.35, 0, 0);
      this.rotate('Rig_Hip_L', 1.28, 0, -0.16);
      this.rotate('Rig_Hip_R', 1.28, 0, 0.16);
      this.rotate('Rig_Knee_L', -1.72, 0, 0);
      this.rotate('Rig_Knee_R', -1.72, 0, 0);
      this.rotate('Rig_Ankle_L', 0.7, 0, 0);
      this.rotate('Rig_Ankle_R', 0.7, 0, 0);
    } else {
      this.rotate('Rig_Hips', 0.2, 0.18, -0.4);
      this.rotate('Rig_Spine', 0.28, -0.12, -0.18);
      this.rotate('Rig_Head', -0.18, 0.25, 0.22);
      this.rotate('Rig_Shoulder_L', -1.1, 0, -0.45);
      this.rotate('Rig_Shoulder_R', 0.42, 0, 0.6);
      this.rotate('Rig_Hip_L', 0.7, 0, -0.25);
      this.rotate('Rig_Knee_L', -1.05, 0, 0);
    }

    const ribbonWave = Math.sin(this.time * 0.62) * 0.13;
    this.rotate('Rig_Pack', -0.025 + Math.abs(stride) * 0.035, 0, -laneLean * 0.25);
    this.rotate('Rig_Ribbon_A', 0.08 + ribbonWave, 0, -0.08 - laneLean * 0.4);
    this.rotate('Rig_Ribbon_B', 0.12 - ribbonWave * 1.35, 0, -0.1);
    this.rotate('Rig_Ribbon_C', 0.16 + ribbonWave * 1.7, 0, -0.12);
    this.applyTargets(delta, state);
  }

  private resetTargets(): void {
    for (const part of this.parts.values()) {
      part.targetRotation.copy(part.baseRotation);
      part.targetPosition.copy(part.basePosition);
      part.targetScale.copy(part.baseScale);
    }
  }

  private applyTargets(delta: number, state: PlayerState): void {
    const responsiveness = state === 'rolling' ? 25 : state === 'jumping' ? 20 : 17;
    const blend = 1 - Math.exp(-responsiveness * delta);
    for (const part of this.parts.values()) {
      part.targetQuaternion.setFromEuler(part.targetRotation);
      if (state === 'rolling' && part.object.name === 'Rig_Hips') part.object.quaternion.copy(part.targetQuaternion);
      else part.object.quaternion.slerp(part.targetQuaternion, blend);
      part.object.position.lerp(part.targetPosition, blend);
      part.object.scale.lerp(part.targetScale, blend);
    }
  }

  private rotate(name: string, x: number, y: number, z: number): void {
    const part = this.parts.get(name);
    if (!part) return;
    part.targetRotation.x += x;
    part.targetRotation.y += y;
    part.targetRotation.z += z;
  }

  private move(name: string, x: number, y: number, z: number): void {
    const part = this.parts.get(name);
    if (!part) return;
    part.targetPosition.x += x;
    part.targetPosition.y += y;
    part.targetPosition.z += z;
  }
}
