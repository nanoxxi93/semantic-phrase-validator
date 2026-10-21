import type { EmbeddingCache } from './embeddingCache.interface.js';

interface CacheEntry {
  vector: number[];
  expiresAt: number;
}

export interface InMemoryEmbeddingCacheOptions {
  maxCapacity?: number;
  defaultTtlSeconds?: number;
}

/**
 * High-performance, in-memory LRU cache for 384-dimensional text embeddings.
 * Evicts least-recently-used items when maxCapacity is reached,
 * and transparently invalidates entries based on TTL.
 */
export class InMemoryEmbeddingCache implements EmbeddingCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly maxCapacity: number;
  private readonly defaultTtlSeconds: number;

  constructor(options: InMemoryEmbeddingCacheOptions = {}) {
    this.maxCapacity = options.maxCapacity ?? 1000;
    this.defaultTtlSeconds = options.defaultTtlSeconds ?? 3600;
  }

  private normalizeKey(key: string): string {
    return key.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  get(key: string): number[] | null {
    const normalizedKey = this.normalizeKey(key);
    const entry = this.store.get(normalizedKey);

    if (!entry) {
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.store.delete(normalizedKey);
      return null;
    }

    // Refresh LRU order: delete and re-insert at the end
    this.store.delete(normalizedKey);
    this.store.set(normalizedKey, entry);

    return entry.vector;
  }

  set(key: string, embedding: number[], ttlSeconds?: number): void {
    const normalizedKey = this.normalizeKey(key);
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const expiresAt = Date.now() + ttl * 1000;

    // If key already exists, delete it so re-inserting moves it to the most recently used position
    if (this.store.has(normalizedKey)) {
      this.store.delete(normalizedKey);
    } else if (this.store.size >= this.maxCapacity) {
      // Evict oldest (least recently used) entry (first key in iteration order)
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(normalizedKey, {
      vector: embedding,
      expiresAt,
    });
  }

  delete(key: string): void {
    const normalizedKey = this.normalizeKey(key);
    this.store.delete(normalizedKey);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
