import { describe, it, expect } from 'vitest';
import { calculateCosineSimilarity } from '../../src/utils/cosineSimilarity.js';
import { InvalidVectorDimensionError } from '../../src/errors/InvalidVectorDimensionError.js';

describe('calculateCosineSimilarity (Unit Tests)', () => {
  const DIMENSION = 384;

  const createVector = (fillValue: number = 0): number[] => {
    return new Array(DIMENSION).fill(fillValue);
  };

  it('CA-01: should return exactly 1.0000 for identical non-null vectors', () => {
    const vecA = createVector(0.5);
    const vecB = createVector(0.5);

    const similarity = calculateCosineSimilarity(vecA, vecB);
    expect(similarity).toBe(1.0);
    expect(similarity.toFixed(4)).toBe('1.0000');
  });

  it('CA-02: should return exactly 0.0000 for orthogonal vectors', () => {
    const vecA = createVector(0);
    const vecB = createVector(0);
    vecA[0] = 1;
    vecB[1] = 1;

    const similarity = calculateCosineSimilarity(vecA, vecB);
    expect(similarity).toBe(0.0);
    expect(similarity.toFixed(4)).toBe('0.0000');
  });

  it('CA-05: should bound results to [0.0000, 1.0000] and round to 4 decimals', () => {
    const vecA = createVector(0.1);
    const vecB = createVector(0.1);
    // slightly perturb to create non-trivial cosine
    vecA[0] = 0.99;
    vecB[1] = 0.55;

    const similarity = calculateCosineSimilarity(vecA, vecB);
    expect(similarity).toBeGreaterThanOrEqual(0.0);
    expect(similarity).toBeLessThanOrEqual(1.0);
    // check that it has at most 4 decimal places
    const decimalPlaces = (similarity.toString().split('.')[1] || '').length;
    expect(decimalPlaces).toBeLessThanOrEqual(4);
  });

  it('CE-1: should throw InvalidVectorDimensionError for empty vectors or mismatched lengths', () => {
    const emptyVec: number[] = [];
    const validVec = createVector(1);
    const shortVec = new Array(128).fill(1);

    expect(() => calculateCosineSimilarity(emptyVec, validVec)).toThrow(InvalidVectorDimensionError);
    expect(() => calculateCosineSimilarity(validVec, shortVec)).toThrow(InvalidVectorDimensionError);
    expect(() => calculateCosineSimilarity(emptyVec, emptyVec)).toThrow(InvalidVectorDimensionError);
  });

  it('CE-2: should safely return 0.0000 without NaN/Infinity when any vector has zero magnitude', () => {
    const zeroVec = createVector(0);
    const nonZeroVec = createVector(1);

    const similarity1 = calculateCosineSimilarity(zeroVec, nonZeroVec);
    expect(similarity1).toBe(0.0);
    expect(Number.isNaN(similarity1)).toBe(false);

    const similarity2 = calculateCosineSimilarity(nonZeroVec, zeroVec);
    expect(similarity2).toBe(0.0);
    expect(Number.isNaN(similarity2)).toBe(false);

    const similarity3 = calculateCosineSimilarity(zeroVec, zeroVec);
    expect(similarity3).toBe(0.0);
    expect(Number.isNaN(similarity3)).toBe(false);
  });
});
