import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryEmbeddingCache } from '../../src/cache/inMemoryEmbeddingCache.js';

describe('InMemoryEmbeddingCache', () => {
  let cache: InMemoryEmbeddingCache;

  beforeEach(() => {
    cache = new InMemoryEmbeddingCache({ maxCapacity: 3, defaultTtlSeconds: 3600 });
  });

  it('should return null when key does not exist in cache (cache miss)', () => {
    expect(cache.get('non_existent_key')).toBeNull();
  });

  it('should store and retrieve an embedding vector successfully (cache hit)', () => {
    const dummyVector = [0.1, 0.2, 0.3];
    cache.set('frase prueba', dummyVector);

    const retrieved = cache.get('frase prueba');
    expect(retrieved).toEqual(dummyVector);
  });

  it('should treat normalized keys case-insensitively', () => {
    const dummyVector = [0.5, 0.6];
    cache.set('Frase de Ejemplo', dummyVector);

    expect(cache.get('frase de ejemplo')).toEqual(dummyVector);
    expect(cache.get('  Frase de Ejemplo  ')).toEqual(dummyVector);
  });

  it('should expire entries when TTL has elapsed', () => {
    vi.useFakeTimers();

    const dummyVector = [0.9, 0.8];
    cache.set('expiring_phrase', dummyVector, 10); // 10 seconds TTL

    expect(cache.get('expiring_phrase')).toEqual(dummyVector);

    // Advance time by 11 seconds
    vi.advanceTimersByTime(11 * 1000);

    expect(cache.get('expiring_phrase')).toBeNull();

    vi.useRealTimers();
  });

  it('should evict least recently used (LRU) entry when maxCapacity is exceeded', () => {
    const vec1 = [1.0];
    const vec2 = [2.0];
    const vec3 = [3.0];
    const vec4 = [4.0];

    // Capacity is 3
    cache.set('key1', vec1);
    cache.set('key2', vec2);
    cache.set('key3', vec3);

    // Access key1 so key2 becomes least recently used
    cache.get('key1');

    // Add 4th item -> should evict key2
    cache.set('key4', vec4);

    expect(cache.get('key2')).toBeNull(); // evicted!
    expect(cache.get('key1')).toEqual(vec1);
    expect(cache.get('key3')).toEqual(vec3);
    expect(cache.get('key4')).toEqual(vec4);
  });

  it('should delete a specific key from the cache', () => {
    cache.set('to_delete', [1.2, 3.4]);
    expect(cache.get('to_delete')).toBeDefined();

    cache.delete('to_delete');
    expect(cache.get('to_delete')).toBeNull();
  });

  it('should clear all entries', () => {
    cache.set('k1', [1]);
    cache.set('k2', [2]);

    cache.clear();

    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toBeNull();
  });
});
