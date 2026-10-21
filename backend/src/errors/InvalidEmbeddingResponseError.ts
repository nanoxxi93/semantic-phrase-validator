export class InvalidEmbeddingResponseError extends Error {
  constructor(message: string = 'The AI provider returned an invalid embedding structure or non-compliant dimensions.') {
    super(message);
    this.name = 'InvalidEmbeddingResponseError';
  }
}
