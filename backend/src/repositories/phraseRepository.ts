import { eq, desc, count, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/index.js';
import { phrases } from '../db/schema.js';
import type {
  PhraseRepositoryInterface,
  CreatePhraseData,
  FindAllOptions,
  PhraseListItem,
  PhraseWithEmbedding,
  ValidationStatus,
  SimilarPhraseSummary,
} from './phraseRepository.interface.js';

export class PhraseRepository implements PhraseRepositoryInterface {
  constructor(private readonly database = db) {}

  async create(data: CreatePhraseData): Promise<PhraseListItem> {
    const [inserted] = await this.database
      .insert(phrases)
      .values({
        text: data.text,
        embedding: data.embedding,
        similarityScore: data.similarityScore !== null ? data.similarityScore.toFixed(4) : null,
        similarToId: data.similarToId,
        validationStatus: data.validationStatus,
      })
      .returning();

    let similarPhrase: SimilarPhraseSummary | null = null;
    if (inserted.similarToId) {
      const [similar] = await this.database
        .select({ id: phrases.id, text: phrases.text })
        .from(phrases)
        .where(eq(phrases.id, inserted.similarToId));
      if (similar) {
        similarPhrase = similar;
      }
    }

    return {
      id: inserted.id,
      text: inserted.text,
      validationStatus: inserted.validationStatus,
      similarityScore: inserted.similarityScore !== null ? Number(inserted.similarityScore) : null,
      similarToId: inserted.similarToId,
      similarPhrase,
      createdAt: inserted.createdAt,
    };
  }

  async findAll(options: FindAllOptions): Promise<PhraseListItem[]> {
    const { page, limit, status } = options;
    const offset = (page - 1) * limit;
    const similarPhrases = alias(phrases, 'similar_phrase');
    const whereClause = status ? eq(phrases.validationStatus, status) : undefined;

    const rows = await this.database
      .select({
        id: phrases.id,
        text: phrases.text,
        validationStatus: phrases.validationStatus,
        similarityScore: phrases.similarityScore,
        similarToId: phrases.similarToId,
        createdAt: phrases.createdAt,
        similarPhraseId: similarPhrases.id,
        similarPhraseText: similarPhrases.text,
      })
      .from(phrases)
      .leftJoin(similarPhrases, eq(phrases.similarToId, similarPhrases.id))
      .where(whereClause)
      .orderBy(desc(phrases.createdAt), desc(phrases.id))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({
      id: r.id,
      text: r.text,
      validationStatus: r.validationStatus,
      similarityScore: r.similarityScore !== null ? Number(r.similarityScore) : null,
      similarToId: r.similarToId,
      similarPhrase: r.similarPhraseId ? { id: r.similarPhraseId, text: r.similarPhraseText! } : null,
      createdAt: r.createdAt,
    }));
  }

  async countAll(status?: ValidationStatus): Promise<number> {
    const whereClause = status ? eq(phrases.validationStatus, status) : undefined;

    const [result] = await this.database
      .select({ total: count() })
      .from(phrases)
      .where(whereClause);

    return Number(result?.total ?? 0);
  }

  async getAllEmbeddings(): Promise<PhraseWithEmbedding[]> {
    const rows = await this.database
      .select({
        id: phrases.id,
        text: phrases.text,
        embedding: phrases.embedding,
      })
      .from(phrases);

    return rows;
  }

  async findByExactText(normalizedText: string): Promise<PhraseWithEmbedding | null> {
    const cleanText = normalizedText.trim().replace(/\s+/g, ' ');

    const [found] = await this.database
      .select({
        id: phrases.id,
        text: phrases.text,
        embedding: phrases.embedding,
      })
      .from(phrases)
      .where(sql`LOWER(${phrases.text}) = LOWER(${cleanText})`)
      .limit(1);

    return found ?? null;
  }
}
