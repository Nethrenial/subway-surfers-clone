import { describe, expect, it } from 'vitest';
import { Player } from '../src/entities/Player';
import { CollectibleSystem } from '../src/systems/CollectibleSystem';
import { createSeededRandom } from '../src/utils/random';

describe('CollectibleSystem magnet capture', () => {
  it('detaches a trail front-to-back instead of bending every coin together', () => {
    const player = new Player();
    const system = new CollectibleSystem(createSeededRandom(7));
    system.pool.releaseAll();
    const front = system.pool.acquire()!;
    const back = system.pool.acquire()!;
    front.activate(-2.35, 0.95, -1, false);
    back.activate(-2.35, 0.95, -2.32, false);

    for (let frame = 0; frame < 5; frame += 1) system.update(0.05, 10.8, player, true);

    expect(front.capturing).toBe(true);
    expect(back.capturing).toBe(false);
    expect(front.x).toBeGreaterThan(-2.35);
    expect(back.x).toBe(-2.35);
    system.dispose();
    player.dispose();
  });

  it('clears capture state when a pooled coin is reused', () => {
    const system = new CollectibleSystem(createSeededRandom(9));
    const coin = system.pool.acquire()!;
    coin.activate(0, 1, -4, false);
    coin.capturing = true;
    coin.captureElapsed = 0.2;
    system.pool.release(coin);
    expect(coin).toMatchObject({
      capturing: false,
      captureElapsed: 0,
      captureDuration: 0,
      captureStartX: 0,
      captureStartY: 0,
      captureStartZ: 0,
      captureVelocityZ: 0,
    });
    const reused = system.pool.acquire()!;
    reused.activate(0, 1, -4, false);

    expect(reused.capturing).toBe(false);
    expect(reused.captureElapsed).toBe(0);
    system.dispose();
  });

  it('keeps serial capture totals stable across frame partitions', () => {
    const simulate = (delta: number, speed = 10.8): number => {
      const player = new Player();
      const system = new CollectibleSystem(createSeededRandom(4));
      system.spawnMagnetTrailForTest(player);
      let collected = 0;
      for (let elapsed = 0; elapsed < 2; elapsed += delta) {
        collected += system.update(delta, speed, player, true).count;
        expect(system.captureDiagnostics.capturing).toBeLessThanOrEqual(1);
      }
      system.dispose();
      player.dispose();
      return collected;
    };

    expect(simulate(1 / 30)).toBe(6);
    expect(simulate(1 / 60)).toBe(6);
    expect(simulate(0.05)).toBe(6);
    expect(simulate(1 / 60, 18.5)).toBe(6);
  });
});
