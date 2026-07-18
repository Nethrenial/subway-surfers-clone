import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Obstacle, type ObstacleResources } from '../src/entities/Obstacle';
import { Player } from '../src/entities/Player';
import { CollisionSystem } from '../src/systems/CollisionSystem';

function resources(): ObstacleResources {
  return {
    barrier: new THREE.Group(),
    hurdle: new THREE.Group(),
    gate: new THREE.Group(),
    drone: new THREE.Group(),
    train: new THREE.Group(),
  };
}

describe('CollisionSystem', () => {
  it('detects an obstacle crossed during a low-frame-rate lane change', () => {
    const player = new Player();
    player.previousX = -2.35;
    player.position.x = 2.35;
    const obstacle = new Obstacle(resources());
    obstacle.configure('barrier', 1, player.position.z);
    obstacle.previousWorldZ = player.position.z;

    expect(new CollisionSystem().findPlayerHit(player, [obstacle])).toBe(obstacle);
    player.dispose();
  });

  it('correlates lateral and longitudinal overlap times', () => {
    const player = new Player();
    player.previousX = 1.28;
    player.position.x = 1.76;
    const obstacle = new Obstacle(resources());
    obstacle.configure('barrier', 1, 3.4);
    obstacle.previousWorldX = 0;
    obstacle.previousWorldZ = 2.475;

    expect(new CollisionSystem().findPlayerHit(player, [obstacle])).toBeNull();
    player.dispose();
  });

  it('includes moving-obstacle X in the time-of-impact interval', () => {
    const player = new Player();
    const obstacle = new Obstacle(resources());
    obstacle.configure('drone', 1, 2.475);
    obstacle.previousWorldX = 1.15;
    obstacle.group.position.x = 1.25;
    obstacle.previousWorldZ = 3.4;

    expect(new CollisionSystem().findPlayerHit(player, [obstacle])).toBe(obstacle);
    player.dispose();
  });
});
