import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Obstacle, type ObstacleResources } from '../src/entities/Obstacle';

function resources(): ObstacleResources {
  return {
    barrier: new THREE.Group(),
    hurdle: new THREE.Group(),
    gate: new THREE.Group(),
    drone: new THREE.Group(),
    train: new THREE.Group(),
  };
}

describe('obstacle motion', () => {
  it('moves an oncoming train faster than the scrolling track', () => {
    const obstacle = new Obstacle(resources());
    obstacle.configure('train', 1, -24);

    obstacle.updateMotion(0.5, 1, 12);

    expect(obstacle.worldZ()).toBeCloseTo(-19.68);
  });

  it('gives drones an animated hover and bank', () => {
    const obstacle = new Obstacle(resources());
    obstacle.configure('drone', 1, -12, 1.2);

    obstacle.updateMotion(0.2, 0.7, 12);

    const drone = obstacle.group.children.find((child) => child.visible)!;
    expect(drone.position.y).not.toBe(0);
    expect(drone.rotation.z).not.toBe(0);
  });
});
