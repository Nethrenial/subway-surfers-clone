import { describe, expect, it } from 'vitest';
import { ObjectPool, type Poolable } from '../src/core/ObjectPool';

class Item implements Poolable {
  active = false;
  reset(): void {
    this.active = false;
  }
}

describe('ObjectPool', () => {
  it('reuses released instances and enforces capacity', () => {
    const pool = new ObjectPool(() => new Item(), 2);
    const first = pool.acquire();
    const second = pool.acquire();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(pool.acquire()).toBeNull();
    if (first) pool.release(first);
    expect(pool.acquire()).toBe(first);
    expect(pool.activeCount).toBe(2);
  });
});
