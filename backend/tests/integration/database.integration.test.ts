import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, pool } from '../../src/db/index.js';
import { phrases } from '../../src/db/schema.js';
import { env } from '../../src/config/env.js';

/**
 * Asserts that the target environment is safe for running integration tests.
 * Standard industry practice: blocks tests if NODE_ENV is set to 'production'
 * or if the connection string explicitly targets a production database name.
 */
export function assertSafeTestDatabase(databaseUrl: string, nodeEnv: string): void {
  if (nodeEnv === 'production') {
    throw new Error(
      'CRITICAL SAFETY CHECK: Running destructive integration tests in a PRODUCTION environment (NODE_ENV=production) is strictly forbidden.'
    );
  }

  // Guard against accidental connection to databases explicitly named 'production' or 'prod'
  const urlPath = databaseUrl.split('/').pop()?.split('?')[0]?.toLowerCase() || '';
  if (urlPath === 'production' || urlPath === 'prod' || urlPath.startsWith('production_') || urlPath.startsWith('prod_')) {
    throw new Error(
      `CRITICAL SAFETY CHECK: DATABASE_URL targets a database named "${urlPath}". Running tests on databases with production names is forbidden.`
    );
  }
}

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

  it('CE-7: should persist the first phrase with similar_to_id = null, similarity_score = null, and validation_status = UNIQUE in an empty catalog', async () => {
    const dummyEmbedding = new Array(384).fill(0.01);

    const [inserted] = await db
      .insert(phrases)
      .values({
        text: 'Primera frase en catálogo vacío',
        embedding: dummyEmbedding,
        similarity_score: null,
        similar_to_id: null,
        validation_status: 'UNIQUE',
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.id).toBeDefined();
    expect(inserted.text).toBe('Primera frase en catálogo vacío');
    expect(inserted.embedding).toHaveLength(384);
    expect(inserted.similarity_score).toBeNull();
    expect(inserted.similar_to_id).toBeNull();
    expect(inserted.validation_status).toBe('UNIQUE');
    expect(inserted.created_at).toBeInstanceOf(Date);
  });

  it('CA-04: should persist and accurately retrieve phrase with metadata and numeric similarity_score', async () => {
    const dummyEmbedding = new Array(384).fill(0.02);

    const [original] = await db
      .insert(phrases)
      .values({
        text: 'Frase original registrada',
        embedding: dummyEmbedding,
        similarity_score: null,
        similar_to_id: null,
        validation_status: 'UNIQUE',
      })
      .returning();

    const [duplicate] = await db
      .insert(phrases)
      .values({
        text: 'Frase duplicada confirmada',
        embedding: dummyEmbedding,
        similarity_score: '0.8542',
        similar_to_id: original.id,
        validation_status: 'CONFIRMED_DUPLICATE',
      })
      .returning();

    const [found] = await db.select().from(phrases).where(eq(phrases.id, duplicate.id));

    expect(found).toBeDefined();
    expect(found.text).toBe('Frase duplicada confirmada');
    expect(found.embedding).toHaveLength(384);
    expect(found.similarity_score).toBe('0.8542');
    expect(found.similar_to_id).toBe(original.id);
    expect(found.validation_status).toBe('CONFIRMED_DUPLICATE');
  });

  it('CA-06: should set similar_to_id to NULL (ON DELETE SET NULL) when the referenced phrase is deleted', async () => {
    const dummyEmbedding = new Array(384).fill(0.03);

    const [phraseA] = await db
      .insert(phrases)
      .values({
        text: 'Frase A a eliminar',
        embedding: dummyEmbedding,
        similarity_score: null,
        similar_to_id: null,
        validation_status: 'UNIQUE',
      })
      .returning();

    const [phraseB] = await db
      .insert(phrases)
      .values({
        text: 'Frase B que referencia a Frase A',
        embedding: dummyEmbedding,
        similarity_score: '0.9123',
        similar_to_id: phraseA.id,
        validation_status: 'CONFIRMED_DUPLICATE',
      })
      .returning();

    expect(phraseB.similar_to_id).toBe(phraseA.id);

    await db.delete(phrases).where(eq(phrases.id, phraseA.id));

    const [updatedPhraseB] = await db.select().from(phrases).where(eq(phrases.id, phraseB.id));

    expect(updatedPhraseB).toBeDefined();
    expect(updatedPhraseB.similar_to_id).toBeNull();
    expect(updatedPhraseB.text).toBe('Frase B que referencia a Frase A');
  });

  it('CE-6: should reject insertion when similar_to_id references a non-existent UUID', async () => {
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
    const dummyEmbedding = new Array(384).fill(0.04);

    await expect(
      db.insert(phrases).values({
        text: 'Frase con FK inválida',
        embedding: dummyEmbedding,
        similarity_score: '0.5000',
        similar_to_id: nonExistentUuid,
        validation_status: 'CONFIRMED_DUPLICATE',
      })
    ).rejects.toThrow();
  });
});
