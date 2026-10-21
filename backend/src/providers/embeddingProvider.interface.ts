export interface EmbeddingProvider {
  /**
   * Generates a 384-dimensional dense numerical vector representing the semantic meaning of the text.
   *
   * @param text The input phrase to vectorize (will be normalized)
   * @returns Promise resolving to an array of exactly 384 floating-point numbers
   */
  generateEmbedding(text: string): Promise<number[]>;
}
