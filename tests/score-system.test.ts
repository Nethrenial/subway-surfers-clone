import { describe, expect, it } from 'vitest';
import { ScoreSystem } from '../src/systems/ScoreSystem';

describe('ScoreSystem', () => {
  it('applies distance and power-up multipliers without changing distance', () => {
    const score = new ScoreSystem();
    score.update(1, 10, 1);
    expect(score.distance).toBe(10);
    expect(score.score).toBe(110);
    score.update(1, 10, 2);
    expect(score.distance).toBe(20);
    expect(score.score).toBe(330);
  });

  it('awards common and rare collectible values', () => {
    const score = new ScoreSystem();
    score.collect(1, 1);
    score.collect(5, 2);
    expect(score.coins).toBe(6);
    expect(score.score).toBe(385);
    score.reset();
    expect(score).toMatchObject({ coins: 0, distance: 0, score: 0 });
  });
});
