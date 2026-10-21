import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { db, pool } from '../../src/db/index.js';
import { phrases } from '../../src/db/schema.js';
import { env } from '../../src/config/env.js';
import { PhraseRepository } from '../../src/repositories/phraseRepository.js';
import { assertSafeTestDatabase } from '../helpers/assertSafeTestDatabase.js';

describe('PhraseRepository Integration Tests', () => {
  let repository: PhraseRepository;

  beforeAll(() => {
    assertSafeTestDatabase(env.DATABASE_URL, env.NODE_ENV);
    repository = new PhraseRepository(db);
  });

  beforeEach(async () => {
    await db.delete(phrases);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should create a unique phrase with numeric similarityScore = null and no similarPhrase', async () => {
    const dummyEmbedding = new Array(384).fill(0.05);

    const created = await repository.create({
      text: 'Frase única de prueba',
      embedding: dummyEmbedding,
      similarityScore: null,
      similarToId: null,
      validationStatus: 'UNIQUE',
    });

    expect(created.id).toBeDefined();
    expect(created.text).toBe('Frase única de prueba');
    expect(created.validationStatus).toBe('UNIQUE');
    expect(created.similarityScore).toBeNull();
    expect(created.similarToId).toBeNull();
    expect(created.similarPhrase).toBeNull();
    expect(created.createdAt).toBeInstanceOf(Date);
    // Verifies embedding is not exposed in PhraseListItem
    expect((created as any).embedding).toBeUndefined();
  });

  it('should create a confirmed duplicate and populate similarPhrase summary with numeric score', async () => {
    const dummyEmbedding = new Array(384).fill(0.06);

    const original = await repository.create({
      text: 'Frase original base',
      embedding: dummyEmbedding,
      similarityScore: null,
      similarToId: null,
      validationStatus: 'UNIQUE',
    });

    const duplicate = await repository.create({
      text: 'Frase paráfrasis confirmada',
      embedding: dummyEmbedding,
      similarityScore: 0.8875,
      similarToId: original.id,
      validationStatus: 'CONFIRMED_DUPLICATE',
    });

    expect(duplicate.validationStatus).toBe('CONFIRMED_DUPLICATE');
    expect(typeof duplicate.similarityScore).toBe('number');
    expect(duplicate.similarityScore).toBe(0.8875);
    expect(duplicate.similarToId).toBe(original.id);
    expect(duplicate.similarPhrase).toEqual({
      id: original.id,
      text: original.text,
    });
  });

  it('should list phrases paginated with determinism and without embedding vectors', async () => {
    const dummyEmbedding = new Array(384).fill(0.01);

    for (let i = 1; i <= 5; i++) {
      await repository.create({
        text: `Frase ${i}`,
        embedding: dummyEmbedding,
        similarityScore: null,
        similarToId: null,
        validationStatus: 'UNIQUE',
      });
    }

    const page1 = await repository.findAll({ page: 1, limit: 3 });
    const page2 = await repository.findAll({ page: 2, limit: 3 });
    const totalCount = await repository.countAll();

    expect(totalCount).toBe(5);
    expect(page1).toHaveLength(3);
    expect(page2).toHaveLength(2);

    // Verify ordering: newest first (Frase 5 on top of page 1)
    expect(page1[0].text).toBe('Frase 5');
    expect(page1[1].text).toBe('Frase 4');
    expect(page1[2].text).toBe('Frase 3');
    expect(page2[0].text).toBe('Frase 2');
    expect(page2[1].text).toBe('Frase 1');

    // Verify no embedding vector in items
    for (const item of [...page1, ...page2]) {
      expect((item as any).embedding).toBeUndefined();
    }
  });

  it('should filter phrases by validationStatus in findAll and countAll', async () => {
    const dummyEmbedding = new Array(384).fill(0.02);

    await repository.create({
      text: 'Frase única 1',
      embedding: dummyEmbedding,
      similarityScore: null,
      similarToId: null,
      validationStatus: 'UNIQUE',
    });

    await repository.create({
      text: 'Frase única 2',
      embedding: dummyEmbedding,
      similarityScore: null,
      similarToId: null,
      validationStatus: 'UNIQUE',
    });

    await repository.create({
      text: 'Frase duplicada',
      embedding: dummyEmbedding,
      similarityScore: 0.9,
      similarToId: null,
      validationStatus: 'CONFIRMED_DUPLICATE',
    });

    const uniqueCount = await repository.countAll('UNIQUE');
    const duplicateCount = await repository.countAll('CONFIRMED_DUPLICATE');
    const uniqueList = await repository.findAll({ page: 1, limit: 10, status: 'UNIQUE' });

    expect(uniqueCount).toBe(2);
    expect(duplicateCount).toBe(1);
    expect(uniqueList).toHaveLength(2);
    expect(uniqueList.every((item) => item.validationStatus === 'UNIQUE')).toBe(true);
  });

  it('should retrieve all embeddings with id, text and vector', async () => {
    const dummyEmbedding = new Array(384).fill(0.07);

    await repository.create({
      text: 'Frase para vector',
      embedding: dummyEmbedding,
      similarityScore: null,
      similarToId: null,
      validationStatus: 'UNIQUE',
    });

    const allEmbeddings = await repository.getAllEmbeddings();

    expect(allEmbeddings).toHaveLength(1);
    expect(allEmbeddings[0].text).toBe('Frase para vector');
    expect(allEmbeddings[0].embedding).toHaveLength(384);
  });

  it('should find phrase by exact text case-insensitively and return its embedding', async () => {
    const dummyEmbedding = new Array(384).fill(0.08);

    await repository.create({
      text: 'Comprar Leche Fresca',
      embedding: dummyEmbedding,
      similarityScore: null,
      similarToId: null,
      validationStatus: 'UNIQUE',
    });

    const found = await repository.findByExactText('  comprar leche fresca  ');
    expect(found).toBeDefined();
    expect(found?.text).toBe('Comprar Leche Fresca');
    expect(found?.embedding).toHaveLength(384);

    const notFound = await repository.findByExactText('Inexistente');
    expect(notFound).toBeNull();
  });
});
