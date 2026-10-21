import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '../../src/db/index.js';
import { phrases } from '../../src/db/schema.js';
import { env } from '../../src/config/env.js';
import { assertSafeTestDatabase } from '../helpers/assertSafeTestDatabase.js';

describe('Database Integration Tests (PostgreSQL 17)', () => {
  beforeAll(() => {
    assertSafeTestDatabase(env.DATABASE_URL, env.NODE_ENV);
  });

  beforeEach(async () => {
    await db.delete(phrases);
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Production Database Protection Guard', () => {
    it('should throw when NODE_ENV is production', () => {
      expect(() => {
        assertSafeTestDatabase('postgresql://user:pass@localhost:5432/db', 'production');
      }).toThrow('PRODUCTION');
    });

    it('should throw when database name is explicitly production or prod', () => {
      expect(() => {
        assertSafeTestDatabase('postgresql://user:pass@ep-cool-db.neon.tech/production', 'development');
      }).toThrow('production');

      expect(() => {
        assertSafeTestDatabase('postgresql://postgres:pass@db.xyz.supabase.co:5432/prod_database', 'test');
      }).toThrow('production names');
    });

    it('should allow cloud dev databases (Neon branches, Supabase dev tiers) when not in production', () => {
      expect(() => {
        assertSafeTestDatabase('postgresql://user:pass@ep-branch-dev-123.neon.tech/neondb', 'development');
      }).not.toThrow();

      expect(() => {
        assertSafeTestDatabase('postgresql://postgres:pass@db.dev.supabase.co:5432/postgres', 'test');
      }).not.toThrow();

      expect(() => {
        assertSafeTestDatabase('postgresql://postgres:postgrespassword@localhost:5432/semantic_phrases', 'development');
      }).not.toThrow();
    });
  });

  it('CE-7: should persist the first phrase with similarToId = null, similarityScore = null, and validationStatus = UNIQUE in an empty catalog', async () => {
    const dummyEmbedding = new Array(384).fill(0.01);

    const [inserted] = await db
      .insert(phrases)
      .values({
        text: 'Primera frase en catálogo vacío',
        embedding: dummyEmbedding,
        similarityScore: null,
        similarToId: null,
        validationStatus: 'UNIQUE',
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.id).toBeDefined();
    expect(inserted.text).toBe('Primera frase en catálogo vacío');
    expect(inserted.embedding).toHaveLength(384);
    expect(inserted.similarityScore).toBeNull();
    expect(inserted.similarToId).toBeNull();
    expect(inserted.validationStatus).toBe('UNIQUE');
    expect(inserted.createdAt).toBeInstanceOf(Date);
  });

  it('CA-04: should persist and accurately retrieve phrase with metadata and numeric similarityScore', async () => {
    const dummyEmbedding = new Array(384).fill(0.02);

    const [original] = await db
      .insert(phrases)
      .values({
        text: 'Frase original registrada',
        embedding: dummyEmbedding,
        similarityScore: null,
        similarToId: null,
        validationStatus: 'UNIQUE',
      })
      .returning();

    const [duplicate] = await db
      .insert(phrases)
      .values({
        text: 'Frase duplicada confirmada',
        embedding: dummyEmbedding,
        similarityScore: '0.8542',
        similarToId: original.id,
        validationStatus: 'CONFIRMED_DUPLICATE',
      })
      .returning();

    const [found] = await db.select().from(phrases).where(eq(phrases.id, duplicate.id));

    expect(found).toBeDefined();
    expect(found.text).toBe('Frase duplicada confirmada');
    expect(found.embedding).toHaveLength(384);
    expect(found.similarityScore).toBe('0.8542');
    expect(found.similarToId).toBe(original.id);
    expect(found.validationStatus).toBe('CONFIRMED_DUPLICATE');
  });

  it('CA-06: should set similarToId to NULL (ON DELETE SET NULL) when the referenced phrase is deleted', async () => {
    const dummyEmbedding = new Array(384).fill(0.03);

    const [phraseA] = await db
      .insert(phrases)
      .values({
        text: 'Frase A a eliminar',
        embedding: dummyEmbedding,
        similarityScore: null,
        similarToId: null,
        validationStatus: 'UNIQUE',
      })
      .returning();

    const [phraseB] = await db
      .insert(phrases)
      .values({
        text: 'Frase B que referencia a Frase A',
        embedding: dummyEmbedding,
        similarityScore: '0.9123',
        similarToId: phraseA.id,
        validationStatus: 'CONFIRMED_DUPLICATE',
      })
      .returning();

    expect(phraseB.similarToId).toBe(phraseA.id);

    await db.delete(phrases).where(eq(phrases.id, phraseA.id));

    const [updatedPhraseB] = await db.select().from(phrases).where(eq(phrases.id, phraseB.id));

    expect(updatedPhraseB).toBeDefined();
    expect(updatedPhraseB.similarToId).toBeNull();
    expect(updatedPhraseB.text).toBe('Frase B que referencia a Frase A');
  });

  it('CE-6: should reject insertion when similarToId references a non-existent UUID', async () => {
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
    const dummyEmbedding = new Array(384).fill(0.04);

    await expect(
      db.insert(phrases).values({
        text: 'Frase con FK inválida',
        embedding: dummyEmbedding,
        similarityScore: '0.5000',
        similarToId: nonExistentUuid,
        validationStatus: 'CONFIRMED_DUPLICATE',
      })
    ).rejects.toThrow();
  });
});
