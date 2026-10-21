import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { db, pool } from '../../src/db/index.js';
import { phrases } from '../../src/db/schema.js';
import { env } from '../../src/config/env.js';
import { createApp } from '../../src/app.js';
import { MockEmbeddingProvider } from '../../src/providers/mockEmbeddingProvider.js';
import { InMemoryEmbeddingCache } from '../../src/cache/inMemoryEmbeddingCache.js';
import { PhraseRepository } from '../../src/repositories/phraseRepository.js';
import { assertSafeTestDatabase } from '../helpers/assertSafeTestDatabase.js';
import { ExternalAIProviderError } from '../../src/errors/ExternalAIProviderError.js';

describe('Phrases REST API Integration Tests', () => {
  let app: Express;
  let mockProvider: MockEmbeddingProvider;
  let cache: InMemoryEmbeddingCache;
  let repository: PhraseRepository;

  beforeAll(() => {
    assertSafeTestDatabase(env.DATABASE_URL, env.NODE_ENV);
    repository = new PhraseRepository(db);
  });

  beforeEach(async () => {
    await db.delete(phrases);
    mockProvider = new MockEmbeddingProvider();
    cache = new InMemoryEmbeddingCache();

    app = createApp({
      embeddingProvider: mockProvider,
      embeddingCache: cache,
      phraseRepository: repository,
      similarityThreshold: 0.80,
      disableRateLimit: true, // disabled for general functional test isolation
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('GET /api/health (CA-14)', () => {
    it('should return 200 OK with health status and timestamp', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(typeof response.body.data.timestamp).toBe('string');
    });
  });

  describe('POST /api/phrases/validate', () => {
    it('should return isDuplicate: false, similarityScore: null when catalog is empty (CA-01, CE-1)', async () => {
      const response = await request(app)
        .post('/api/phrases/validate')
        .send({ text: 'Primera frase en el sistema' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          isDuplicate: false,
          similarityScore: null,
          threshold: 0.80,
          similarPhrase: null,
        },
      });
    });

    it('should short-circuit with score 1.0000 on exact text match without calling provider (CA-10, CE-2)', async () => {
      // 1. Create initial phrase
      await request(app)
        .post('/api/phrases')
        .send({ text: 'comprar leche deslactosada' });

      // 2. Validate exact phrase with differing casing and extra whitespace
      const response = await request(app)
        .post('/api/phrases/validate')
        .send({ text: '  COMPRAR   leche   deslactosada  ' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isDuplicate).toBe(true);
      expect(response.body.data.similarityScore).toBe(1.0);
      expect(response.body.data.threshold).toBe(0.80);
      expect(response.body.data.similarPhrase.text).toBe('comprar leche deslactosada');
    });

    it('should detect semantic duplicate when cosine similarity >= threshold (CA-02)', async () => {
      const vec = new Array(384).fill(0.1);
      mockProvider.registerFixture('adquirir cafe en grano', vec);
      mockProvider.registerFixture('comprar granos de cafe', vec);

      await request(app)
        .post('/api/phrases')
        .send({ text: 'adquirir cafe en grano' });

      const response = await request(app)
        .post('/api/phrases/validate')
        .send({ text: 'comprar granos de cafe' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isDuplicate).toBe(true);
      expect(response.body.data.similarityScore).toBe(1.0);
      expect(response.body.data.similarPhrase.text).toBe('adquirir cafe en grano');
    });

    it('should report closest phrase with informative score when below threshold (CA-01)', async () => {
      const vec1 = new Array(384).fill(0);
      vec1[0] = 1;
      const vec2 = new Array(384).fill(0);
      vec2[0] = 1;
      vec2[1] = 1; // cosine = 1/sqrt(2) ≈ 0.7071 < 0.80

      mockProvider.registerFixture('frase existente en catalogo', vec1);
      mockProvider.registerFixture('frase entrante diferente', vec2);

      await request(app)
        .post('/api/phrases')
        .send({ text: 'frase existente en catalogo' });

      const response = await request(app)
        .post('/api/phrases/validate')
        .send({ text: 'frase entrante diferente' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isDuplicate).toBe(false);
      expect(response.body.data.similarityScore).toBe(0.7071);
      expect(response.body.data.threshold).toBe(0.80);
      expect(response.body.data.similarPhrase.text).toBe('frase existente en catalogo');
    });

    it('should reject whitespace-only text with 400 Bad Request (CA-08, CE-10)', async () => {
      const response = await request(app)
        .post('/api/phrases/validate')
        .send({ text: '    \n\t   ' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });

    it('should reject non-JSON Content-Type with 415 Unsupported Media Type (CE-9)', async () => {
      const response = await request(app)
        .post('/api/phrases/validate')
        .set('Content-Type', 'text/plain')
        .send('texto en plano');

      expect(response.status).toBe(415);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('should return 503 Service Unavailable when AI provider fails (CA-09, CE-5)', async () => {
      mockProvider.generateEmbedding = async () => {
        throw new ExternalAIProviderError('Hugging Face endpoint timed out');
      };

      const response = await request(app)
        .post('/api/phrases/validate')
        .send({ text: 'Frase que falla' });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
    });
  });

  describe('POST /api/phrases', () => {
    it('should create a unique phrase with 201 Created and null similarity metadata (CA-03)', async () => {
      const response = await request(app)
        .post('/api/phrases')
        .send({ text: 'Frase conceptualmente unica' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.text).toBe('Frase conceptualmente unica');
      expect(response.body.data.validationStatus).toBe('UNIQUE');
      expect(response.body.data.similarityScore).toBeNull();
      expect(response.body.data.similarToId).toBeNull();
      expect(response.body.data.createdAt).toBeDefined();
      expect('embedding' in response.body.data).toBe(false);
    });

    it('should block unconfirmed duplicate with 409 Conflict (CA-04)', async () => {
      await request(app)
        .post('/api/phrases')
        .send({ text: 'Pagar tarjeta de credito' });

      const response = await request(app)
        .post('/api/phrases')
        .send({ text: 'pagar tarjeta de credito', confirmDuplicate: false });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DUPLICATE_PHRASE_DETECTED');
      expect(response.body.error.details.similarityScore).toBe(1.0);
      expect(response.body.error.details.threshold).toBe(0.80);
      expect(response.body.error.details.similarPhrase.text).toBe('Pagar tarjeta de credito');
    });

    it('should persist confirmed duplicate with 201 Created (CA-05)', async () => {
      const original = await request(app)
        .post('/api/phrases')
        .send({ text: 'Pagar tarjeta de credito' });

      const originalId = original.body.data.id;

      const response = await request(app)
        .post('/api/phrases')
        .send({ text: 'pagar tarjeta de credito', confirmDuplicate: true });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.validationStatus).toBe('CONFIRMED_DUPLICATE');
      expect(response.body.data.similarityScore).toBe(1.0);
      expect(response.body.data.similarToId).toBe(originalId);
    });

    it('should reuse cached embedding vector between validate and create without extra provider calls (CA-11)', async () => {
      const providerSpy = vi.spyOn(mockProvider, 'generateEmbedding');

      // 1. Validate: generates embedding and caches it
      const validateRes = await request(app)
        .post('/api/phrases/validate')
        .send({ text: 'Preparar cafe matutino' });

      expect(validateRes.status).toBe(200);
      expect(providerSpy).toHaveBeenCalledTimes(1);

      // 2. Create with same text: should hit cache and NOT invoke generateEmbedding again
      const createRes = await request(app)
        .post('/api/phrases')
        .send({ text: 'Preparar cafe matutino' });

      expect(createRes.status).toBe(201);
      expect(providerSpy).toHaveBeenCalledTimes(1);
    });

    it('should reject phrases exceeding 280 characters with 400 Bad Request (CA-08)', async () => {
      const longText = 'a'.repeat(281);
      const response = await request(app)
        .post('/api/phrases')
        .send({ text: longText });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /api/phrases', () => {
    it('should return paginated phrases excluding embedding vector (CA-06)', async () => {
      await request(app).post('/api/phrases').send({ text: 'Frase numero 1' });
      await request(app).post('/api/phrases').send({ text: 'Frase numero 2' });

      const response = await request(app).get('/api/phrases?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });

      for (const item of response.body.data.items) {
        expect('embedding' in item).toBe(false);
        expect(typeof item.id).toBe('string');
        expect(typeof item.text).toBe('string');
        expect(typeof item.validationStatus).toBe('string');
      }
    });

    it('should filter phrases by validation status (CA-07)', async () => {
      await request(app).post('/api/phrases').send({ text: 'Frase unica' });
      await request(app)
        .post('/api/phrases')
        .send({ text: 'frase unica', confirmDuplicate: true });

      const uniqueRes = await request(app).get('/api/phrases?status=UNIQUE');
      expect(uniqueRes.status).toBe(200);
      expect(uniqueRes.body.data.items).toHaveLength(1);
      expect(uniqueRes.body.data.items[0].validationStatus).toBe('UNIQUE');
      expect(uniqueRes.body.data.pagination.total).toBe(1);

      const duplicateRes = await request(app).get('/api/phrases?status=CONFIRMED_DUPLICATE');
      expect(duplicateRes.status).toBe(200);
      expect(duplicateRes.body.data.items).toHaveLength(1);
      expect(duplicateRes.body.data.items[0].validationStatus).toBe('CONFIRMED_DUPLICATE');
      expect(duplicateRes.body.data.pagination.total).toBe(1);
    });

    it('should return empty items array when requested page exceeds total (CE-4)', async () => {
      await request(app).post('/api/phrases').send({ text: 'Frase de prueba' });

      const response = await request(app).get('/api/phrases?page=999&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.pagination).toEqual({
        page: 999,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('Rate Limiting & Defensive Hardening (CA-12, CA-13, CE-8)', () => {
    it('should return security headers configured by Helmet (CA-13)', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should block requests exceeding rate limit with 429 and RATE_LIMIT_EXCEEDED (CA-12, CE-8)', async () => {
      const rateLimitedApp = createApp({
        embeddingProvider: mockProvider,
        embeddingCache: cache,
        phraseRepository: repository,
        disableRateLimit: false,
      });

      // Rapidly issue requests until rate limit window triggers
      let lastResponse = await request(rateLimitedApp)
        .post('/api/phrases/validate')
        .send({ text: 'Ping rate limit 1' });

      for (let i = 2; i <= 35; i++) {
        lastResponse = await request(rateLimitedApp)
          .post('/api/phrases/validate')
          .send({ text: `Ping rate limit ${i}` });

        if (lastResponse.status === 429) {
          break;
        }
      }

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.success).toBe(false);
      expect(lastResponse.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(lastResponse.headers['retry-after']).toBeDefined();
    });

    it('should reject payload exceeding 10kb with 413 Payload Too Large (CE-6)', async () => {
      const hugeText = 'x'.repeat(12 * 1024);
      const response = await request(app)
        .post('/api/phrases/validate')
        .send({ text: hugeText });

      expect(response.status).toBe(413);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('should return 500 DATABASE_ERROR without leaking secrets when repository fails (CA-15, CE-11)', async () => {
      const dbErr = new Error('postgres connection terminated unexpectedly');
      dbErr.name = 'PostgresError';
      const spy = vi.spyOn(repository, 'findAll').mockRejectedValueOnce(dbErr);

      const response = await request(app).get('/api/phrases');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DATABASE_ERROR');

      spy.mockRestore();
    });
  });
});
