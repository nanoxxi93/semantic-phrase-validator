import { LRUCache } from 'lru-cache';
import type { EmbeddingCache } from './embeddingCache.interface.js';

export interface InMemoryEmbeddingCacheOptions {
  maxCapacity?: number;
  defaultTtlSeconds?: number;
  perf?: { now: () => number };
}

/**
 * High-performance, in-memory LRU cache for 384-dimensional text embeddings.
 * Wraps the industry-standard `lru-cache` package, providing optimized V8 memory layout,
 * transparent TTL invalidation, and strict least-recently-used eviction.
 */
export class InMemoryEmbeddingCache implements EmbeddingCache {
  private readonly cache: LRUCache<string, number[]>;

  constructor(options: InMemoryEmbeddingCacheOptions = {}) {
    const max = options.maxCapacity ?? 1000;
    const ttl = (options.defaultTtlSeconds ?? 3600) * 1000;

    this.cache = new LRUCache<string, number[]>({
      max,
      ttl,
      perf: options.perf ?? { now: () => Date.now() },
    });
  }

  private normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  get(key: string): number[] | null {
    const normalizedKey = this.normalizeKey(key);
    return this.cache.get(normalizedKey) ?? null;
  }

  set(key: string, embedding: number[], ttlSeconds?: number): void {
    const normalizedKey = this.normalizeKey(key);
    const ttl = ttlSeconds !== undefined ? ttlSeconds * 1000 : undefined;
    this.cache.set(normalizedKey, embedding, { ttl });
  }

  delete(key: string): void {
    const normalizedKey = this.normalizeKey(key);
    this.cache.delete(normalizedKey);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
