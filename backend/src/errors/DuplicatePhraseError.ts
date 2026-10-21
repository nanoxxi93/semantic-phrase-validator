import type { SimilarPhraseSummary } from '../repositories/phraseRepository.interface.js';

export interface DuplicatePhraseErrorDetails {
  similarityScore: number;
  threshold: number;
  similarPhrase: SimilarPhraseSummary;
}

/**
 * Domain error thrown when an incoming phrase is determined to be a semantic duplicate
 * and the user/client has not explicitly confirmed saving it.
 */
export class DuplicatePhraseError extends Error {
  public readonly similarityScore: number;
  public readonly threshold: number;
  public readonly similarPhrase: SimilarPhraseSummary;

  constructor(details: DuplicatePhraseErrorDetails) {
    super(
      `Potential semantic duplicate detected with score ${details.similarityScore.toFixed(4)} (threshold: ${details.threshold.toFixed(4)})`
    );
    this.name = 'DuplicatePhraseError';
    this.similarityScore = details.similarityScore;
    this.threshold = details.threshold;
    this.similarPhrase = details.similarPhrase;
  }
}
