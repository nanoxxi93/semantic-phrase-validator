import { InvalidVectorDimensionError } from '../errors/InvalidVectorDimensionError.js';

const REQUIRED_DIMENSION = 384;

/**
 * Calculates the cosine similarity between two numeric vectors of 384 dimensions.
 * Formula: dotProduct / (normA * normB)
 *
 * @param vecA First vector of 384 numbers
 * @param vecB Second vector of 384 numbers
 * @returns Similarity score bounded to [0.0000, 1.0000] and rounded to 4 decimals
 * @throws InvalidVectorDimensionError if any vector does not have exactly 384 dimensions
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== REQUIRED_DIMENSION || vecB.length !== REQUIRED_DIMENSION) {
    throw new InvalidVectorDimensionError(REQUIRED_DIMENSION, vecA.length, vecB.length);
  }

  let dotProduct = 0;
  let normASq = 0;
  let normBSq = 0;

  for (let i = 0; i < REQUIRED_DIMENSION; i++) {
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
