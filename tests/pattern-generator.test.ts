import { describe, expect, it } from 'vitest';
import {
  chooseNextSafeLane,
  createSegmentPattern,
  isPatternSafe,
  isRecoveryGeneration,
} from '../src/systems/PatternGenerator';
import { createSeededRandom } from '../src/utils/random';

describe('procedural track safety', () => {
  it('keeps one reachable corridor between explicit recovery segments', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const rng = createSeededRandom(seed);
      let safeLane = 1;
      for (let generation = 0; generation < 250; generation += 1) {
        const previousSafeLane = safeLane;
        if (isRecoveryGeneration(generation)) safeLane = chooseNextSafeLane(safeLane, rng);
        const pattern = createSegmentPattern(generation, rng, safeLane);
        expect(isPatternSafe(pattern), `seed ${seed}, generation ${generation}`).toBe(true);
        expect(pattern.length).toBeLessThanOrEqual(2);
        if (isRecoveryGeneration(generation)) {
          expect(pattern).toEqual([]);
          expect(Math.abs(safeLane - previousSafeLane)).toBe(1);
        } else {
          const blocked = new Set(pattern.flatMap((placement) => placement.blockedLanes ?? [placement.lane]));
          expect(blocked.has(safeLane)).toBe(false);
        }
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

  it('rejects overlapping train envelopes that block all lanes across rows', () => {
    expect(isPatternSafe([
      { lane: 2, z: -1.28, type: 'train' },
      { lane: 0, z: 2.86, type: 'train' },
      { lane: 1, z: 2.86, type: 'train' },
    ])).toBe(false);
  });

  it('keeps active train reservation lanes clear in future segments', () => {
    const pattern = createSegmentPattern(14, createSeededRandom(11), 1, [0, 2]);
    expect(pattern.every((placement) => (
      !(placement.blockedLanes ?? [placement.lane]).some((lane) => lane === 0 || lane === 2)
    ))).toBe(true);
  });

  it('leaves enough recovery distance for the next adjacent corridor', () => {
    const rng = createSeededRandom(19);
    const oldPattern = createSegmentPattern(4, rng, 1);
    expect(createSegmentPattern(5, rng, 0)).toEqual([]);
    const nextPattern = createSegmentPattern(6, rng, 0);
    const centerDistance = Math.abs((nextPattern[0]?.z ?? 0) - 24 - (oldPattern[0]?.z ?? 0));
    const worstClearDistance = centerDistance - 2 * (2.7 + 0.38);
    expect(worstClearDistance / 18.5).toBeGreaterThan(0.34 + 0.25);
  });

  it('introduces train and moving-drone hazards only through safe patterns', () => {
    const rng = createSeededRandom(9127);
    const types = new Set<string>();
    let safeLane = 1;
    for (let generation = 8; generation < 600; generation += 1) {
      if (isRecoveryGeneration(generation)) safeLane = chooseNextSafeLane(safeLane, rng);
      const pattern = createSegmentPattern(generation, rng, safeLane);
      expect(isPatternSafe(pattern)).toBe(true);
      for (const placement of pattern) types.add(placement.type);
    }
    expect(types).toContain('train');
    expect(types).toContain('drone');
  });

  it('produces visibly different pattern signatures across run seeds', () => {
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 24; seed += 1) {
      const pattern = createSegmentPattern(14, createSeededRandom(seed));
      signatures.add(pattern.map(({ lane, z, type }) => `${lane}:${z.toFixed(2)}:${type}`).join('|'));
    }
    expect(signatures.size).toBeGreaterThan(18);
  });
});
