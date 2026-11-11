import { InvalidVectorDimensionError } from '../errors/InvalidVectorDimensionError.js';

/**
 * Calculates the cosine similarity between two numeric vectors of equal dimension.
 * Formula: dotProduct / (normA * normB)
 *
 * @param vecA First vector of numbers
 * @param vecB Second vector of numbers
 * @returns Similarity score bounded to [0.0000, 1.0000] and rounded to 4 decimals
 * @throws InvalidVectorDimensionError if vectors have mismatched dimensions or are empty
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    throw new InvalidVectorDimensionError(vecA.length, vecB.length);
  }

  const dimension = vecA.length;
  let dotProduct = 0;
  let normASq = 0;
  let normBSq = 0;

  for (let i = 0; i < dimension; i++) {
    const a = vecA[i];
    const b = vecB[i];

    dotProduct += a * b;
    normASq += a * a;
    normBSq += b * b;
  }

  const magnitude = Math.sqrt(normASq) * Math.sqrt(normBSq);

  // Safe zero-magnitude check to prevent 0 / 0 = NaN or Division by zero
  if (magnitude === 0) {
    return 0.0;
  }

  const rawCosine = dotProduct / magnitude;

  // Clamp mathematically to [0.0, 1.0] to prevent floating point anomalies like 1.0000000000000002 or negative noise
  const clampedCosine = Math.min(1.0, Math.max(0.0, rawCosine));

  // Round symmetrically to 4 decimal places
  return Math.round((clampedCosine + Number.EPSILON) * 10000) / 10000;
}
