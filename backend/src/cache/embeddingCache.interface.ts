/**
 * Abstract interface for caching 384-dimensional text embeddings.
 * Decouples the service domain from specific caching technologies
 * (e.g., in-memory LRU cache vs distributed Redis).
 */
export interface EmbeddingCache {
  /**
   * Retrieves an embedding vector associated with the normalized text key.
   * Returns null if the key is missing or expired.
   */
  get(key: string): Promise<number[] | null> | number[] | null;

  /**
   * Stores an embedding vector associated with the normalized text key,
   * with an optional time-to-live in seconds.
   */
  set(key: string, embedding: number[], ttlSeconds?: number): Promise<void> | void;

  /**
   * Removes a specific key from the cache.
   */
  delete(key: string): Promise<void> | void;

  /**
   * Clears all cached entries.
   */
  clear(): Promise<void> | void;
}
