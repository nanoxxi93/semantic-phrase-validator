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
import { ExternalAIProviderError } from '../errors/ExternalAIProviderError.js';

export interface PhraseServiceOptions {
  embeddingProvider: EmbeddingProvider;
  providers?: Map<string, EmbeddingProvider>;
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
 * Domain service orchestrating phrase validation, persistence, and querying across multiple embedding models.
 * Implements exact text short-circuiting, embedding cache lookups, and cosine similarity comparison.
 */
export class PhraseService {
  private readonly defaultProvider: EmbeddingProvider;
  private readonly providers: Map<string, EmbeddingProvider>;
  private readonly phraseRepository: PhraseRepositoryInterface;
  private readonly embeddingCache?: EmbeddingCache;
  private readonly threshold: number;

  constructor(options: PhraseServiceOptions) {
    this.defaultProvider = options.embeddingProvider;
    this.providers = options.providers ?? new Map();
    if (!this.providers.has(this.defaultProvider.modelIdentifier)) {
      this.providers.set(this.defaultProvider.modelIdentifier, this.defaultProvider);
    }
    this.phraseRepository = options.phraseRepository;
    this.embeddingCache = options.embeddingCache;
    this.threshold = options.threshold ?? 0.80;
  }

  public get activeModel(): string {
    return this.defaultProvider.modelIdentifier;
  }

  /**
   * Resolves the requested provider or falls back to default.
   * Throws ExternalAIProviderError if requested model is unconfigured on the server.
   */
  public getProvider(model?: string): EmbeddingProvider {
    if (!model) {
      return this.defaultProvider;
    }
    const provider = this.providers.get(model);
    if (!provider) {
      if (model === this.defaultProvider.modelIdentifier) {
        return this.defaultProvider;
      }
      throw new ExternalAIProviderError(
        `Embedding provider for model "${model}" is not configured on the server.`,
        503
      );
    }
    return provider;
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
  private async getOrGenerateEmbedding(
    normalizedText: string,
    provider: EmbeddingProvider
  ): Promise<number[]> {
    const cacheKey = `${provider.modelIdentifier}:${normalizedText.toLowerCase()}`;

    if (this.embeddingCache) {
      const cached = await this.embeddingCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const embedding = await provider.generateEmbedding(normalizedText);

    if (this.embeddingCache) {
      await this.embeddingCache.set(cacheKey, embedding);
    }

    return embedding;
  }

  /**
   * Pre-validates a phrase against the existing catalog to detect semantic duplicates.
   *
   * @param text Raw input phrase
   * @param model Optional target embedding model
   * @returns Validation result with isDuplicate flag, similarity score, threshold, and closest phrase
   */
  public async validatePhrase(text: string, model?: string): Promise<PhraseValidationResult> {
    const normalizedText = this.normalizeText(text);
    const provider = this.getProvider(model);

    // Step 1: Exact text short-circuit (0 AI calls) within active model scope
    const exactMatch = await this.phraseRepository.findByExactText(
      normalizedText,
      provider.modelIdentifier
    );
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
    const embedding = await this.getOrGenerateEmbedding(normalizedText, provider);

    // Step 3: Compare against catalog of the requested model
    const catalog = await this.phraseRepository.getAllEmbeddings(
      provider.modelIdentifier
    );
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
      // Defensive check: ignore vectors with mismatched dimensions if any exist
      if (item.embedding.length !== embedding.length) {
        continue;
      }
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
   * @param model Optional target embedding model
   * @returns Persisted phrase entity without embedding vector
   */
  public async createPhrase(
    text: string,
    confirmDuplicate: boolean = false,
    model?: string
  ): Promise<PhraseListItem> {
    const normalizedText = this.normalizeText(text);
    const provider = this.getProvider(model);

    // Step 1: Exact text short-circuit check within target model
    const exactMatch = await this.phraseRepository.findByExactText(
      normalizedText,
      provider.modelIdentifier
    );
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
        embeddingModel: provider.modelIdentifier,
        similarityScore: 1.0,
        similarToId: exactMatch.id,
        validationStatus: 'CONFIRMED_DUPLICATE',
      });
    }

    // Step 2: Semantic check via embedding
    const embedding = await this.getOrGenerateEmbedding(normalizedText, provider);
    const catalog = await this.phraseRepository.getAllEmbeddings(
      provider.modelIdentifier
    );

    if (catalog.length > 0) {
      let highestScore = -1;
      let closestPhrase: SimilarPhraseSummary | null = null;

      for (const item of catalog) {
        if (item.embedding.length !== embedding.length) {
          continue;
        }
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
          embeddingModel: provider.modelIdentifier,
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
      embeddingModel: provider.modelIdentifier,
      similarityScore: null,
      similarToId: null,
      validationStatus: 'UNIQUE',
    });
  }

  /**
   * Retrieves a paginated list of phrases with deterministic ordering and optional status/model filtering.
   * Defaults to filtering by the default model identifier if no specific model is requested.
   *
   * @param page Page number (1-based)
   * @param limit Number of items per page
   * @param status Optional validation status filter
   * @param model Optional embedding model filter
   * @returns Paginated phrase list and metadata
   */
  public async listPhrases(
    page: number = 1,
    limit: number = 10,
    status?: ValidationStatus,
    model?: string
  ): Promise<PaginatedPhrases> {
    const embeddingModel = model ?? this.defaultProvider.modelIdentifier;
    const [items, total] = await Promise.all([
      this.phraseRepository.findAll({ page, limit, status, embeddingModel }),
      this.phraseRepository.countAll(status, embeddingModel),
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
