import { describe, expect, it } from 'vitest';
import { PowerUpSystem } from '../src/systems/PowerUpSystem';
import { createSeededRandom } from '../src/utils/random';

describe('PowerUpSystem', () => {
  it('allows different powers to coexist and refreshes the same type', () => {
    const powers = new PowerUpSystem(createSeededRandom(1));
    powers.activate('magnet');
    powers.remaining.magnet = 3;
    powers.activate('magnet');
    powers.activate('multiplier');
    expect(powers.remaining.magnet).toBe(9);
    expect(powers.magnetActive).toBe(true);
    expect(powers.scoreMultiplier).toBe(2);
    powers.dispose();
  });

  it('consumes shield once and exposes jump boost', () => {
    const powers = new PowerUpSystem(createSeededRandom(2));
    powers.activate('shield');
    powers.activate('jump-boost');
    expect(powers.jumpMultiplier).toBe(1.28);
    expect(powers.consumeShield()).toBe(true);
    expect(powers.consumeShield()).toBe(false);
    powers.dispose();
  });
});
