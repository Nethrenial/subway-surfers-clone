export interface Poolable {
  active: boolean;
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  readonly items: readonly T[];

  constructor(factory: () => T, size: number) {
    this.items = Array.from({ length: size }, factory);
  }

  acquire(): T | null {
    for (const item of this.items) {
      if (item.active) continue;
      item.active = true;
      return item;
    }
    return null;
  }

  release(item: T): void {
    item.reset();
  }

  releaseAll(): void {
    for (const item of this.items) item.reset();
  }

  get activeCount(): number {
    let count = 0;
    for (const item of this.items) if (item.active) count += 1;
    return count;
  }
}
