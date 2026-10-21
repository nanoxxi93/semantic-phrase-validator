import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhraseService } from '../../src/services/phraseService.js';
import { MockEmbeddingProvider } from '../../src/providers/mockEmbeddingProvider.js';
import { InMemoryEmbeddingCache } from '../../src/cache/inMemoryEmbeddingCache.js';
import type {
  PhraseRepositoryInterface,
  PhraseListItem,
  PhraseWithEmbedding,
} from '../../src/repositories/phraseRepository.interface.js';
import { DuplicatePhraseError } from '../../src/errors/DuplicatePhraseError.js';
import { EmptyTextError } from '../../src/errors/EmptyTextError.js';

describe('PhraseService Unit Tests', () => {
  let phraseService: PhraseService;
  let mockProvider: MockEmbeddingProvider;
  let cache: InMemoryEmbeddingCache;
  let mockRepository: PhraseRepositoryInterface;

  let existingPhrases: PhraseWithEmbedding[];
  let createdItems: PhraseListItem[];

  beforeEach(() => {
    mockProvider = new MockEmbeddingProvider();
    cache = new InMemoryEmbeddingCache();
    existingPhrases = [];
    createdItems = [];

    mockRepository = {
      create: vi.fn(async (data) => {
        const item: PhraseListItem = {
          id: 'uuid-' + (createdItems.length + 1),
          text: data.text,
          validationStatus: data.validationStatus,
          similarityScore: data.similarityScore,
          similarToId: data.similarToId,
          similarPhrase: data.similarToId
            ? { id: data.similarToId, text: 'Frase existente' }
            : null,
          createdAt: new Date(),
        };
        createdItems.push(item);
        existingPhrases.push({
          id: item.id,
          text: item.text,
          embedding: data.embedding,
        });
        return item;
      }),
      findAll: vi.fn(async () => createdItems),
      countAll: vi.fn(async () => createdItems.length),
      getAllEmbeddings: vi.fn(async () => existingPhrases),
      findByExactText: vi.fn(async (normalizedText: string) => {
        const clean = normalizedText.trim().toLowerCase().replace(/\s+/g, ' ');
        return existingPhrases.find((p) => p.text.toLowerCase() === clean) ?? null;
      }),
    };

    phraseService = new PhraseService({
      embeddingProvider: mockProvider,
      phraseRepository: mockRepository,
      embeddingCache: cache,
      threshold: 0.80,
    });
  });

  describe('validatePhrase', () => {
    it('should throw EmptyTextError when text is empty or only whitespace', async () => {
      await expect(phraseService.validatePhrase('')).rejects.toThrow(EmptyTextError);
      await expect(phraseService.validatePhrase('   \n\t  ')).rejects.toThrow(EmptyTextError);
    });

    it('should short-circuit with score 1.0000 on exact text match with 0 provider calls', async () => {
      const dummyVec = new Array(384).fill(0.1);
      existingPhrases.push({
        id: 'existing-1',
        text: 'comprar leche fresca',
        embedding: dummyVec,
      });

      const providerSpy = vi.spyOn(mockProvider, 'generateEmbedding');

      const result = await phraseService.validatePhrase('  Comprar   LECHE Fresca  ');

      expect(providerSpy).not.toHaveBeenCalled();
      expect(result.isDuplicate).toBe(true);
      expect(result.similarityScore).toBe(1.0);
      expect(result.threshold).toBe(0.80);
      expect(result.similarPhrase).toEqual({
        id: 'existing-1',
        text: 'comprar leche fresca',
      });
    });

    it('should return isDuplicate = false, score = null when catalog is empty', async () => {
      const result = await phraseService.validatePhrase('Primera frase del sistema');

      expect(result.isDuplicate).toBe(false);
      expect(result.similarityScore).toBeNull();
      expect(result.similarPhrase).toBeNull();
      expect(result.threshold).toBe(0.80);
    });

    it('should reuse cached vector when available without calling provider', async () => {
      const dummyVec = new Array(384).fill(0.2);
      cache.set('frase en cache', dummyVec);

      const providerSpy = vi.spyOn(mockProvider, 'generateEmbedding');

      await phraseService.validatePhrase('frase en cache');

      expect(providerSpy).not.toHaveBeenCalled();
    });

    it('should return informative score and closest phrase when similarity is below threshold', async () => {
      // Setup fixture vectors with known cosine similarity ~ 0.50
      const vec1 = new Array(384).fill(0);
      vec1[0] = 1;
      const vec2 = new Array(384).fill(0);
      vec2[0] = 1;
      vec2[1] = 1; // cosine = 1 / sqrt(2) ≈ 0.7071 < 0.80

      mockProvider.registerFixture('frase existente', vec1);
      mockProvider.registerFixture('frase entrante', vec2);

      existingPhrases.push({
        id: 'id-1',
        text: 'frase existente',
        embedding: vec1,
      });

      const result = await phraseService.validatePhrase('frase entrante');

      expect(result.isDuplicate).toBe(false);
      expect(result.similarityScore).toBe(0.7071);
      expect(result.similarPhrase).toEqual({
        id: 'id-1',
        text: 'frase existente',
      });
    });

    it('should detect duplicate when similarity score >= threshold', async () => {
      const vec = new Array(384).fill(0.1);
      mockProvider.registerFixture('frase original', vec);
      mockProvider.registerFixture('frase parabola', vec); // identical fixture => similarity 1.0000

      existingPhrases.push({
        id: 'id-1',
        text: 'frase original',
        embedding: vec,
      });

      const result = await phraseService.validatePhrase('frase parabola');

      expect(result.isDuplicate).toBe(true);
      expect(result.similarityScore).toBe(1.0);
      expect(result.similarPhrase).toEqual({
        id: 'id-1',
        text: 'frase original',
      });
    });
  });

  describe('createPhrase', () => {
    it('should throw DuplicatePhraseError when exact match found and confirmDuplicate is false', async () => {
      const vec = new Array(384).fill(0.1);
      existingPhrases.push({
        id: 'id-exact',
        text: 'pagar recibo de luz',
        embedding: vec,
      });

      await expect(
        phraseService.createPhrase('Pagar Recibo De Luz', false)
      ).rejects.toThrow(DuplicatePhraseError);
    });

    it('should persist exact duplicate reusing vector when confirmDuplicate is true', async () => {
      const vec = new Array(384).fill(0.1);
      existingPhrases.push({
        id: 'id-exact',
        text: 'pagar recibo de luz',
        embedding: vec,
      });

      const providerSpy = vi.spyOn(mockProvider, 'generateEmbedding');

      const created = await phraseService.createPhrase('Pagar Recibo De Luz', true);

      expect(providerSpy).not.toHaveBeenCalled();
      expect(created.validationStatus).toBe('CONFIRMED_DUPLICATE');
      expect(created.similarityScore).toBe(1.0);
      expect(created.similarToId).toBe('id-exact');
    });

    it('should throw DuplicatePhraseError when semantic similarity exceeds threshold without confirmation', async () => {
      const vec = new Array(384).fill(0.1);
      existingPhrases.push({
        id: 'id-similar',
        text: 'comprar pan fresco',
        embedding: vec,
      });

      mockProvider.registerFixture('adquirir pan del dia', vec); // similarity 1.0

      await expect(
        phraseService.createPhrase('adquirir pan del dia', false)
      ).rejects.toThrow(DuplicatePhraseError);
    });

    it('should persist semantic duplicate with score and similarToId when confirmDuplicate is true', async () => {
      const vec = new Array(384).fill(0.1);
      existingPhrases.push({
        id: 'id-similar',
        text: 'comprar pan fresco',
        embedding: vec,
      });

      mockProvider.registerFixture('adquirir pan del dia', vec);

      const created = await phraseService.createPhrase('adquirir pan del dia', true);

      expect(created.validationStatus).toBe('CONFIRMED_DUPLICATE');
      expect(created.similarToId).toBe('id-similar');
      expect(created.similarityScore).toBe(1.0);
    });

    it('should persist as UNIQUE with null score and null similarToId when no duplicate detected', async () => {
      const created = await phraseService.createPhrase('Frase completamente única');

      expect(created.validationStatus).toBe('UNIQUE');
      expect(created.similarityScore).toBeNull();
      expect(created.similarToId).toBeNull();
    });
  });

  describe('listPhrases', () => {
    it('should return paginated list and metadata', async () => {
      const result = await phraseService.listPhrases(1, 10);

      expect(result.items).toBeDefined();
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      });
    });
  });
});
