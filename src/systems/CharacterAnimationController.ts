import * as THREE from 'three';
import type { PlayerState } from '../entities/Player';

interface AnimatedPart {
  object: THREE.Object3D;
  baseRotation: THREE.Euler;
  basePosition: THREE.Vector3;
  baseScale: THREE.Vector3;
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
      });
    }
  }

  update(
    delta: number,
    state: PlayerState,
    speedRatio: number,
    verticalVelocity: number,
    laneLean: number,
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
    this.resetParts();

    if (state === 'running') {
      const landing = this.landingTime / 0.22;
      const compression = Math.sin(landing * Math.PI) * 0.12;
      this.move('Rig_Hips', 0, Math.abs(stride) * 0.045 - compression, 0);
      this.rotate('Rig_Hips', 0.1 + compression * 0.7, 0, stride * 0.045 + laneLean * 0.65);
      this.rotate('Rig_Spine', 0.12, counter * 0.055, counter * 0.035 + laneLean * 0.35);
      this.rotate('Rig_Chest', -0.04, stride * 0.075, laneLean * 0.45);
      this.rotate('Rig_Head', -0.04 + Math.abs(stride) * 0.025, -stride * 0.045, -laneLean * 0.5);
      this.rotate('Rig_Shoulder_L', stride * 0.72 - 0.1, 0, -0.08 - laneLean * 0.35);
      this.rotate('Rig_Shoulder_R', counter * 0.72 - 0.1, 0, 0.08 - laneLean * 0.35);
      this.rotate('Rig_Elbow_L', -0.45 - Math.max(0, -stride) * 0.42, 0, 0);
      this.rotate('Rig_Elbow_R', -0.45 - Math.max(0, -counter) * 0.42, 0, 0);
      this.rotate('Rig_Wrist_L', 0.12 + stride * 0.08, 0, -0.08);
      this.rotate('Rig_Wrist_R', 0.12 + counter * 0.08, 0, 0.08);
      this.rotate('Rig_Hip_L', counter * 0.78, 0, -laneLean * 0.18);
      this.rotate('Rig_Hip_R', stride * 0.78, 0, -laneLean * 0.18);
      this.rotate('Rig_Knee_L', -footPlant * 0.92, 0, 0);
      this.rotate('Rig_Knee_R', -oppositePlant * 0.92, 0, 0);
      this.rotate('Rig_Ankle_L', footPlant * 0.42 - stride * 0.12, 0, 0);
      this.rotate('Rig_Ankle_R', oppositePlant * 0.42 - counter * 0.12, 0, 0);
    } else if (state === 'jumping') {
      const rise = THREE.MathUtils.clamp(verticalVelocity / 10.4, -1, 1);
      const apex = 1 - Math.abs(rise);
      this.move('Rig_Hips', 0, apex * 0.08, 0);
      this.rotate('Rig_Hips', 0.2 - rise * 0.12, 0, laneLean * 0.45);
      this.rotate('Rig_Spine', -0.08 + apex * 0.2, 0, laneLean * 0.3);
      this.rotate('Rig_Chest', -0.12, 0, laneLean * 0.35);
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
      this.rotate('Rig_Hips', -Math.PI * 2 * spin + 0.24, 0, laneLean * 0.25);
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
  }

  private resetParts(): void {
    for (const part of this.parts.values()) {
      part.object.rotation.copy(part.baseRotation);
      part.object.position.copy(part.basePosition);
      part.object.scale.copy(part.baseScale);
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
