// Mock for conf ESM module
interface ConfOptions {
  defaults?: Record<string, unknown>;
}

class Conf {
  private store: Map<string, unknown>;
  private defaults: Record<string, unknown>;

  constructor(options: ConfOptions = {}) {
    this.store = new Map();
    this.defaults = options.defaults || {};
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    return (
      (this.store.get(key) as T) ?? (this.defaults[key] as T) ?? defaultValue
    );
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  has(key: string): boolean {
    return this.store.has(key) || key in this.defaults;
  }

  get size(): number {
    return this.store.size;
  }

  *[Symbol.iterator](): IterableIterator<[string, unknown]> {
    for (const [key, value] of this.store) {
      yield [key, value];
    }
  }
}

export default Conf;
