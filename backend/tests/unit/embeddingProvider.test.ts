import { describe, it, expect, vi } from 'vitest';
import { MockEmbeddingProvider } from '../../src/providers/mockEmbeddingProvider.js';
import { HuggingFaceEmbeddingProvider } from '../../src/providers/huggingFaceEmbeddingProvider.js';
import { EmptyTextError } from '../../src/errors/EmptyTextError.js';
import { ExternalAIProviderError } from '../../src/errors/ExternalAIProviderError.js';
import { InvalidEmbeddingResponseError } from '../../src/errors/InvalidEmbeddingResponseError.js';
import type { HfInference } from '@huggingface/inference';

describe('EmbeddingProvider (Unit Tests)', () => {
  const DIMENSION = 384;

  describe('MockEmbeddingProvider', () => {
    it('CA-03 & CA-07: should generate a deterministic 384-dimensional vector', async () => {
      const provider = new MockEmbeddingProvider();
      const text = '  El   veloz    murciélago  hindú \n';

      const embedding1 = await provider.generateEmbedding(text);
      const embedding2 = await provider.generateEmbedding('El veloz murciélago hindú');

      expect(embedding1).toHaveLength(DIMENSION);
      expect(embedding2).toHaveLength(DIMENSION);
      // Normalized identical texts must produce identical deterministic vectors
      expect(embedding1).toEqual(embedding2);

      // Different texts should produce different vectors
      const embedding3 = await provider.generateEmbedding('Otra frase completamente distinta');
      expect(embedding1).not.toEqual(embedding3);
    });

    it('CA-07: should support fixture registration and retrieval', async () => {
      const provider = new MockEmbeddingProvider();
      const customFixture = new Array(DIMENSION).fill(0.1234);

      provider.registerFixture('Mi frase fija', customFixture);
      const result = await provider.generateEmbedding('  Mi   frase fija  ');

      expect(result).toHaveLength(DIMENSION);
      expect(result).toEqual(customFixture);
    });

    it('CE-3: should throw EmptyTextError when given empty string or only whitespace', async () => {
      const provider = new MockEmbeddingProvider();

      await expect(provider.generateEmbedding('')).rejects.toThrow(EmptyTextError);
      await expect(provider.generateEmbedding('   ')).rejects.toThrow(EmptyTextError);
      await expect(provider.generateEmbedding('\n\t  \r')).rejects.toThrow(EmptyTextError);
    });
  });

  describe('HuggingFaceEmbeddingProvider', () => {
    const mockAuthString = 'hf_test_credential';
    const valid384Vector = new Array(DIMENSION).fill(0.05);

    it('CA-03: should normalize text and return 384-dim vector on successful response', async () => {
      const mockHfClient = {
        featureExtraction: vi.fn().mockResolvedValue(valid384Vector),
      } as unknown as HfInference;

      const provider = new HuggingFaceEmbeddingProvider(mockAuthString, 'test-model', mockHfClient);
      const result = await provider.generateEmbedding('   Oración   con    espacios   múltiples \n');

      expect(result).toHaveLength(DIMENSION);
      expect(result).toEqual(valid384Vector);
      expect(mockHfClient.featureExtraction).toHaveBeenCalledWith({
        model: 'test-model',
        inputs: 'Oración con espacios múltiples',
      });
    });

    it('RF-4 & CE-5: should tolerate 2D nested arrays of shape 1x384', async () => {
      const nestedVector = [valid384Vector]; // [[ ... 384 floats ... ]]
      const mockHfClient = {
        featureExtraction: vi.fn().mockResolvedValue(nestedVector),
      } as unknown as HfInference;

      const provider = new HuggingFaceEmbeddingProvider(mockAuthString, 'test-model', mockHfClient);
      const result = await provider.generateEmbedding('Texto de prueba');

      expect(result).toHaveLength(DIMENSION);
      expect(result).toEqual(valid384Vector);
    });

    it('CE-3: should throw EmptyTextError without calling API when input is empty or whitespace', async () => {
      const mockHfClient = {
        featureExtraction: vi.fn(),
      } as unknown as HfInference;

      const provider = new HuggingFaceEmbeddingProvider(mockAuthString, 'test-model', mockHfClient);

      await expect(provider.generateEmbedding('')).rejects.toThrow(EmptyTextError);
      await expect(provider.generateEmbedding('    ')).rejects.toThrow(EmptyTextError);
      await expect(provider.generateEmbedding('\t\n ')).rejects.toThrow(EmptyTextError);
      expect(mockHfClient.featureExtraction).not.toHaveBeenCalled();
    });

    it('CE-4: should retry on cold-start (HTTP 503) and succeed if model loads', async () => {
      const coldStartError = {
        status: 503,
        message: 'Model is currently loading',
        estimated_time: 0.05, // 50ms for fast test
      };

      const mockHfClient = {
        featureExtraction: vi
          .fn()
          .mockRejectedValueOnce(coldStartError)
          .mockResolvedValueOnce(valid384Vector),
      } as unknown as HfInference;

      const provider = new HuggingFaceEmbeddingProvider(mockAuthString, 'test-model', mockHfClient);
      const result = await provider.generateEmbedding('Texto durante cold start');

      expect(result).toHaveLength(DIMENSION);
      expect(result).toEqual(valid384Vector);
      expect(mockHfClient.featureExtraction).toHaveBeenCalledTimes(2);
    });

    it('CE-4: should throw ExternalAIProviderError and protect secret token when API fails', async () => {
      const apiError = new Error(`Request failed with token ${mockAuthString} at https://api.huggingface.co`);
      (apiError as unknown as { status: number }).status = 401;

      const mockHfClient = {
        featureExtraction: vi.fn().mockRejectedValue(apiError),
      } as unknown as HfInference;

      const provider = new HuggingFaceEmbeddingProvider(mockAuthString, 'test-model', mockHfClient);

      await expect(provider.generateEmbedding('Texto válido')).rejects.toThrow(ExternalAIProviderError);

      try {
        await provider.generateEmbedding('Texto válido');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ExternalAIProviderError);
        const error = err as ExternalAIProviderError;
        // Verify credential is NOT exposed in error message
        expect(error.message).not.toContain(mockAuthString);
        expect(error.message).toContain('[REDACTED]');
        expect(error.statusCode).toBe(401);
      }
    });

    it('CE-5: should throw InvalidEmbeddingResponseError if response dimension is invalid', async () => {
      const invalidVector = new Array(128).fill(0.1); // Only 128 elements instead of 384
      const mockHfClient = {
        featureExtraction: vi.fn().mockResolvedValue(invalidVector),
      } as unknown as HfInference;

      const provider = new HuggingFaceEmbeddingProvider(mockAuthString, 'test-model', mockHfClient);

      await expect(provider.generateEmbedding('Frase con respuesta inválida')).rejects.toThrow(
        InvalidEmbeddingResponseError
      );
    });
  });
});
