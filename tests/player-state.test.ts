import { describe, expect, it } from 'vitest';
import type { InputFrame } from '../src/core/InputController';
import { PLAYER_JUMP_APEX, Player } from '../src/entities/Player';

const idle: InputFrame = { left: false, right: false, jump: false, roll: false, pause: false, restart: false };

function input(action: keyof InputFrame): InputFrame {
  return { ...idle, [action]: true };
}

describe('Player state transitions', () => {
  it('queues rapid lane changes against the target lane', () => {
    const player = new Player();
    player.update(1 / 60, input('right'));
    player.update(1 / 60, input('right'));
    expect(player.targetLane).toBe(2);
    player.dispose();
  });

  it('completes an adjacent lane change in the declared duration', () => {
    const player = new Player();
    player.update(0.17, input('right'));
    expect(player.position.x).toBeCloseTo(1.175, 2);
    player.update(0.17, idle);
    expect(player.position.x).toBeCloseTo(2.35);
    expect(player.lane).toBe(2);
    player.dispose();
  });

  it('retargets rapid lane inputs without teleporting', () => {
    const player = new Player();
    player.update(0.34, input('left'));
    player.update(0.01, input('right'));
    const beforeRetarget = player.position.x;
    player.update(0.01, input('right'));

    expect(player.targetLane).toBe(2);
    expect(Math.abs(player.position.x - beforeRetarget)).toBeLessThan(0.05);
    player.update(0.01, input('left'));
    expect(Math.abs(player.position.x - player.previousX)).toBeLessThan(0.05);
    player.dispose();
  });

  it('jumps, fast-falls into a roll, and returns to running', () => {
    const player = new Player();
    player.update(1 / 60, input('jump'));
    expect(player.state).toBe('jumping');
    expect(player.verticalVelocity).toBeGreaterThan(0);
    player.update(1 / 60, input('roll'));
    expect(player.state).toBe('rolling');
    expect(player.verticalVelocity).toBeLessThan(0);
    for (let i = 0; i < 90; i += 1) player.update(1 / 60, idle);
    expect(player.state).toBe('running');
    expect(player.position.y).toBe(0);
    player.dispose();
  });

  it('applies jump boost to takeoff velocity', () => {
    const player = new Player();
    player.jumpMultiplier = 1.28;
    player.update(1 / 60, input('jump'));
    expect(player.verticalVelocity).toBeGreaterThan(12);
    player.dispose();
  });

  it('reaches the configured jump clearance at the maximum supported delta', () => {
    const player = new Player();
    player.update(0.05, input('jump'));
    let highestColliderMin = player.colliderMinY;
    for (let frame = 0; frame < 20; frame += 1) {
      player.update(0.05, idle);
      highestColliderMin = Math.max(highestColliderMin, player.colliderMinY);
    }
    expect(highestColliderMin).toBeGreaterThan(PLAYER_JUMP_APEX);
    player.dispose();
  });
});
