import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraRig } from '../src/systems/CameraRig';

describe('CameraRig', () => {
  it('keeps a fixed track angle while the player changes lanes', () => {
    const camera = new THREE.PerspectiveCamera(62, 9 / 16, 0.1, 170);
    const rig = new CameraRig(camera);
    const initialRotation = camera.rotation.clone();

    for (let frame = 0; frame < 30; frame += 1) rig.update(1 / 60, 2.35, true);

    expect(camera.position.x).toBe(0);
    expect(camera.rotation.y).toBeCloseTo(initialRotation.y);
    expect(camera.rotation.z).toBeCloseTo(initialRotation.z);
  });
});
