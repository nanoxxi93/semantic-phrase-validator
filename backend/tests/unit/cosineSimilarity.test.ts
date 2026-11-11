import { describe, it, expect } from 'vitest';
import { calculateCosineSimilarity } from '../../src/utils/cosineSimilarity.js';
import { InvalidVectorDimensionError } from '../../src/errors/InvalidVectorDimensionError.js';

describe('calculateCosineSimilarity (Unit Tests)', () => {
  const createVector = (dim: number, fillValue: number = 0): number[] => {
    return new Array(dim).fill(fillValue);
  };

  describe('384-dimensional vectors', () => {
    it('CA-01: should return exactly 1.0000 for identical non-null vectors', () => {
      const vecA = createVector(384, 0.5);
      const vecB = createVector(384, 0.5);

      const similarity = calculateCosineSimilarity(vecA, vecB);
      expect(similarity).toBe(1.0);
      expect(similarity.toFixed(4)).toBe('1.0000');
    });

    it('CA-02: should return exactly 0.0000 for orthogonal vectors', () => {
      const vecA = createVector(384, 0);
      const vecB = createVector(384, 0);
      vecA[0] = 1;
      vecB[1] = 1;

      const similarity = calculateCosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0.0);
      expect(similarity.toFixed(4)).toBe('0.0000');
    });
  });

  describe('1024-dimensional vectors (Cloudflare BGE-M3)', () => {
    it('CA-01: should return exactly 1.0000 for identical 1024-dim vectors', () => {
      const vecA = createVector(1024, 0.25);
      const vecB = createVector(1024, 0.25);

      const similarity = calculateCosineSimilarity(vecA, vecB);
      expect(similarity).toBe(1.0);
      expect(similarity.toFixed(4)).toBe('1.0000');
    });

    it('CA-02: should return exactly 0.0000 for orthogonal 1024-dim vectors', () => {
      const vecA = createVector(1024, 0);
      const vecB = createVector(1024, 0);
      vecA[100] = 1;
      vecB[500] = 1;

      const similarity = calculateCosineSimilarity(vecA, vecB);
      expect(similarity).toBe(0.0);
      expect(similarity.toFixed(4)).toBe('0.0000');
    });

    it('CA-05: should bound results to [0.0000, 1.0000] and round to 4 decimals', () => {
      const vecA = createVector(1024, 0.05);
      const vecB = createVector(1024, 0.05);
      vecA[0] = 0.88;
      vecB[1] = 0.44;

      const similarity = calculateCosineSimilarity(vecA, vecB);
      expect(similarity).toBeGreaterThanOrEqual(0.0);
      expect(similarity).toBeLessThanOrEqual(1.0);
      const decimalPlaces = (similarity.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(4);
    });
  });

  describe('Edge cases and error handling', () => {
    it('CE-1: should throw InvalidVectorDimensionError for mismatched lengths (e.g. 1024 vs 384)', () => {
      const vec1024 = createVector(1024, 1);
      const vec384 = createVector(384, 1);

      expect(() => calculateCosineSimilarity(vec1024, vec384)).toThrow(InvalidVectorDimensionError);
      expect(() => calculateCosineSimilarity(vec384, vec1024)).toThrow(InvalidVectorDimensionError);
    });

    it('CE-1: should throw InvalidVectorDimensionError for empty vectors', () => {
      const emptyVec: number[] = [];
      const validVec = createVector(384, 1);

      expect(() => calculateCosineSimilarity(emptyVec, validVec)).toThrow(InvalidVectorDimensionError);
      expect(() => calculateCosineSimilarity(emptyVec, emptyVec)).toThrow(InvalidVectorDimensionError);
    });

    it('CE-2: should safely return 0.0000 without NaN/Infinity when magnitude is zero', () => {
      const zeroVec = createVector(1024, 0);
      const nonZeroVec = createVector(1024, 1);

      expect(calculateCosineSimilarity(zeroVec, nonZeroVec)).toBe(0.0);
      expect(calculateCosineSimilarity(nonZeroVec, zeroVec)).toBe(0.0);
      expect(calculateCosineSimilarity(zeroVec, zeroVec)).toBe(0.0);
    });
  });
});
