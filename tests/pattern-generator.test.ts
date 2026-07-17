import { describe, expect, it } from 'vitest';
import { createSegmentPattern, isPatternSafe } from '../src/systems/PatternGenerator';
import { createSeededRandom } from '../src/utils/random';

describe('procedural track safety', () => {
  it('keeps at least one safe lane across long seeded runs', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const rng = createSeededRandom(seed);
      for (let generation = 0; generation < 250; generation += 1) {
        const pattern = createSegmentPattern(generation, rng);
        expect(isPatternSafe(pattern), `seed ${seed}, generation ${generation}`).toBe(true);
        expect(pattern.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('rejects a fully blocked row', () => {
    expect(
      isPatternSafe([
        { lane: 0, z: 0, type: 'barrier' },
        { lane: 1, z: 0, type: 'hurdle' },
        { lane: 2, z: 0, type: 'gate' },
      ]),
    ).toBe(false);
  });

  it('introduces train and moving-drone hazards only through safe patterns', () => {
    const rng = createSeededRandom(9127);
    const types = new Set<string>();
    for (let generation = 8; generation < 600; generation += 1) {
      const pattern = createSegmentPattern(generation, rng);
      expect(isPatternSafe(pattern)).toBe(true);
      for (const placement of pattern) types.add(placement.type);
    }
    expect(types).toContain('train');
    expect(types).toContain('drone');
  });
});
