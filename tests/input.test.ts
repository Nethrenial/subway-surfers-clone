import { describe, expect, it } from 'vitest';
import { interpretSwipe } from '../src/core/InputController';

describe('touch gesture interpretation', () => {
  it.each([
    [-80, 4, 'left'],
    [80, 4, 'right'],
    [3, -80, 'jump'],
    [3, 80, 'roll'],
    [8, 10, null],
  ] as const)('maps delta (%s, %s) to %s', (dx, dy, expected) => {
    expect(interpretSwipe(dx, dy)).toBe(expected);
  });
});
