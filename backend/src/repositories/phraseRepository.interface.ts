export type ValidationStatus = 'UNIQUE' | 'CONFIRMED_DUPLICATE';

export interface SimilarPhraseSummary {
  id: string;
  text: string;
}

export interface PhraseListItem {
  id: string;
  text: string;
  embeddingModel: string;
  validationStatus: ValidationStatus;
  similarityScore: number | null;
  similarToId: string | null;
  similarPhrase: SimilarPhraseSummary | null;
  createdAt: Date;
}

export interface PhraseWithEmbedding {
  id: string;
  text: string;
  embedding: number[];
  embeddingModel: string;
}

export interface FindAllOptions {
  page: number;
  limit: number;
  status?: ValidationStatus;
  embeddingModel?: string;
}

export interface CreatePhraseData {
  text: string;
  embedding: number[];
  embeddingModel: string;
  similarityScore: number | null;
  similarToId: string | null;
  validationStatus: ValidationStatus;
}

export interface PhraseRepositoryInterface {
  create(data: CreatePhraseData): Promise<PhraseListItem>;
  findAll(options: FindAllOptions): Promise<PhraseListItem[]>;
  countAll(status?: ValidationStatus, embeddingModel?: string): Promise<number>;
  getAllEmbeddings(embeddingModel?: string): Promise<PhraseWithEmbedding[]>;
  findByExactText(normalizedText: string, embeddingModel?: string): Promise<PhraseWithEmbedding | null>;
}
