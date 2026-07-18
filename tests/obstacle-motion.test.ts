import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Obstacle, type ObstacleResources } from '../src/entities/Obstacle';
import { PLAYER_JUMP_APEX, PLAYER_ROLL_HEIGHT, PLAYER_STANDING_HEIGHT } from '../src/entities/Player';
import { findClearLane } from '../src/systems/RouteSafety';

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
  it('moves a visible train continuously from its scheduled entry', () => {
    const obstacle = new Obstacle(resources());
    obstacle.configure('train', 1, -24);
    obstacle.scheduleTrain(12, 12, 70, -66.7);

    obstacle.updateMotion(0.5, 1, 12, 12);
    const entryZ = obstacle.worldZ();
    obstacle.updateMotion(0.5, 1.5, 12, 18);

    expect(entryZ).toBeCloseTo(-66.7);
    expect(obstacle.worldZ() - entryZ).toBeCloseTo(6 * 0.72);
  });

  it('gives drones an animated hover and bank', () => {
    const obstacle = new Obstacle(resources());
    obstacle.configure('drone', 1, -12, 1.2);

    obstacle.updateMotion(0.2, 0.7, 12);

    const drone = obstacle.group.children.find((child) => child.visible)!;
    expect(drone.position.y).not.toBe(0);
    expect(drone.rotation.z).not.toBe(0);
  });

  it('derives distinct traversal classes from player dimensions', () => {
    const obstacle = new Obstacle(resources());

    obstacle.configure('hurdle', 1, -12);
    expect(obstacle.traversal).toBe('jump');
    expect(obstacle.maxY).toBeCloseTo(PLAYER_STANDING_HEIGHT * 0.52);

    obstacle.configure('gate', 1, -12);
    expect(obstacle.traversal).toBe('roll');
    expect(obstacle.minY).toBeGreaterThan(PLAYER_ROLL_HEIGHT);

    obstacle.configure('drone', 1, -12);
    expect(obstacle.traversal).toBe('either');
    expect(obstacle.minY).toBeGreaterThan(PLAYER_ROLL_HEIGHT);
    expect(obstacle.maxY).toBeLessThan(PLAYER_JUMP_APEX + 0.08);

    obstacle.configure('barrier', 1, -12);
    expect(obstacle.traversal).toBe('avoid');
    expect(obstacle.maxY).toBeGreaterThan(PLAYER_STANDING_HEIGHT);
  });

  it('moves reward trails to a hazard-free lane', () => {
    const blocker = new Obstacle(resources());
    blocker.configure('train', 1, -20);
    expect(findClearLane(1, -16, -24, [blocker])).toBe(2);
  });

  it('treats every lane swept by a moving drone as occupied', () => {
    const drone = new Obstacle(resources());
    drone.configure('drone', 2, -20, -2.35, [2, 1]);
    expect(findClearLane(1, -18, -22, [drone])).toBe(0);

  });
});
