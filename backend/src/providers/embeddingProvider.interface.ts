export interface EmbeddingProvider {
  /**
   * Unique model identifier (e.g. '@cf/baai/bge-m3' or 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')
   */
  readonly modelIdentifier: string;

  /**
   * Generates a dense numerical vector representing the semantic meaning of the text.
   *
   * @param text The input phrase to vectorize (will be normalized)
   * @returns Promise resolving to an array of floating-point numbers
   */
  generateEmbedding(text: string): Promise<number[]>;
}
