import type { EmbeddingProvider } from '../providers/embeddingProvider.interface.js';
import type {
  PhraseRepositoryInterface,
  PhraseListItem,
  SimilarPhraseSummary,
  ValidationStatus,
} from '../repositories/phraseRepository.interface.js';
import type { EmbeddingCache } from '../cache/embeddingCache.interface.js';
import { calculateCosineSimilarity } from '../utils/cosineSimilarity.js';
import { DuplicatePhraseError } from '../errors/DuplicatePhraseError.js';
import { EmptyTextError } from '../errors/EmptyTextError.js';

export interface PhraseServiceOptions {
  embeddingProvider: EmbeddingProvider;
  phraseRepository: PhraseRepositoryInterface;
  embeddingCache?: EmbeddingCache;
  threshold?: number;
}

export interface PhraseValidationResult {
  isDuplicate: boolean;
  similarityScore: number | null;
  threshold: number;
  similarPhrase: SimilarPhraseSummary | null;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedPhrases {
  items: PhraseListItem[];
  pagination: PaginationMetadata;
}

/**
 * Domain service orchestrating phrase validation, persistence, and querying.
 * Implements exact text short-circuiting, embedding cache lookups, and cosine similarity comparison.
 */
export class PhraseService {
  private readonly embeddingProvider: EmbeddingProvider;
  private readonly phraseRepository: PhraseRepositoryInterface;
  private readonly embeddingCache?: EmbeddingCache;
  private readonly threshold: number;

  constructor(options: PhraseServiceOptions) {
    this.embeddingProvider = options.embeddingProvider;
    this.phraseRepository = options.phraseRepository;
    this.embeddingCache = options.embeddingCache;
    this.threshold = options.threshold ?? 0.80;
  }

  /**
   * Normalizes phrase text by trimming leading/trailing whitespace and collapsing internal whitespace.
   */
  private normalizeText(text: string): string {
    if (!text || text.trim().length === 0) {
      throw new EmptyTextError();
    }
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Retrieves embedding from cache if available; otherwise generates it via provider and saves to cache.
   */
  private async getOrGenerateEmbedding(normalizedText: string): Promise<number[]> {
    const cacheKey = normalizedText.toLowerCase();

    if (this.embeddingCache) {
      const cached = await this.embeddingCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const embedding = await this.embeddingProvider.generateEmbedding(normalizedText);

    if (this.embeddingCache) {
      await this.embeddingCache.set(cacheKey, embedding);
    }

    return embedding;
  }

  /**
   * Pre-validates a phrase against the existing catalog to detect semantic duplicates.
   *
   * @param text Raw input phrase
   * @returns Validation result with isDuplicate flag, similarity score, threshold, and closest phrase
   */
  public async validatePhrase(text: string): Promise<PhraseValidationResult> {
    const normalizedText = this.normalizeText(text);

    // Step 1: Exact text short-circuit (0 AI calls)
    const exactMatch = await this.phraseRepository.findByExactText(normalizedText);
    if (exactMatch) {
      return {
        isDuplicate: true,
        similarityScore: 1.0,
        threshold: this.threshold,
        similarPhrase: {
          id: exactMatch.id,
          text: exactMatch.text,
        },
      };
    }

    // Step 2: Get or generate embedding
    const embedding = await this.getOrGenerateEmbedding(normalizedText);

    // Step 3: Compare against catalog
    const catalog = await this.phraseRepository.getAllEmbeddings();
    if (catalog.length === 0) {
      return {
        isDuplicate: false,
        similarityScore: null,
        threshold: this.threshold,
        similarPhrase: null,
      };
    }

    let highestScore = -1;
    let closestPhrase: SimilarPhraseSummary | null = null;

    for (const item of catalog) {
      const score = calculateCosineSimilarity(embedding, item.embedding);
      if (score > highestScore) {
        highestScore = score;
        closestPhrase = {
          id: item.id,
          text: item.text,
        };
      }
    }

    const isDuplicate = highestScore >= this.threshold;

    return {
      isDuplicate,
      similarityScore: highestScore >= 0 ? highestScore : null,
      threshold: this.threshold,
      similarPhrase: closestPhrase,
    };
  }

  /**
   * Persists a phrase as UNIQUE or CONFIRMED_DUPLICATE.
   * Throws DuplicatePhraseError if semantic duplicate is detected and confirmDuplicate is false.
   *
   * @param text Raw input phrase
   * @param confirmDuplicate Whether the user confirmed saving a detected duplicate
   * @returns Persisted phrase entity without embedding vector
   */
  public async createPhrase(
    text: string,
    confirmDuplicate: boolean = false
  ): Promise<PhraseListItem> {
    const normalizedText = this.normalizeText(text);

    // Step 1: Exact text short-circuit check
    const exactMatch = await this.phraseRepository.findByExactText(normalizedText);
    if (exactMatch) {
      if (!confirmDuplicate) {
        throw new DuplicatePhraseError({
          similarityScore: 1.0,
          threshold: this.threshold,
          similarPhrase: {
            id: exactMatch.id,
            text: exactMatch.text,
          },
        });
      }

      // Confirmed exact duplicate: reuse exactMatch.embedding directly (0 AI calls)
      return await this.phraseRepository.create({
        text: normalizedText,
        embedding: exactMatch.embedding,
        similarityScore: 1.0,
        similarToId: exactMatch.id,
        validationStatus: 'CONFIRMED_DUPLICATE',
      });
    }

    // Step 2: Semantic check via embedding
    const embedding = await this.getOrGenerateEmbedding(normalizedText);
    const catalog = await this.phraseRepository.getAllEmbeddings();

    if (catalog.length > 0) {
      let highestScore = -1;
      let closestPhrase: SimilarPhraseSummary | null = null;

      for (const item of catalog) {
        const score = calculateCosineSimilarity(embedding, item.embedding);
        if (score > highestScore) {
          highestScore = score;
          closestPhrase = {
            id: item.id,
            text: item.text,
          };
        }
      }

      const isDuplicate = highestScore >= this.threshold;

      if (isDuplicate) {
        if (!confirmDuplicate) {
          throw new DuplicatePhraseError({
            similarityScore: highestScore,
            threshold: this.threshold,
            similarPhrase: closestPhrase!,
          });
        }

        return await this.phraseRepository.create({
          text: normalizedText,
          embedding,
          similarityScore: highestScore,
          similarToId: closestPhrase!.id,
          validationStatus: 'CONFIRMED_DUPLICATE',
        });
      }
    }

    // Non-duplicate or empty catalog: persist as UNIQUE
    return await this.phraseRepository.create({
      text: normalizedText,
      embedding,
      similarityScore: null,
      similarToId: null,
      validationStatus: 'UNIQUE',
    });
  }

  /**
   * Retrieves a paginated list of phrases with deterministic ordering and optional status filtering.
   *
   * @param page Page number (1-based)
   * @param limit Number of items per page
   * @param status Optional validation status filter
   * @returns Paginated phrase list and metadata
   */
  public async listPhrases(
    page: number = 1,
    limit: number = 10,
    status?: ValidationStatus
  ): Promise<PaginatedPhrases> {
    const [items, total] = await Promise.all([
      this.phraseRepository.findAll({ page, limit, status }),
      this.phraseRepository.countAll(status),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}
