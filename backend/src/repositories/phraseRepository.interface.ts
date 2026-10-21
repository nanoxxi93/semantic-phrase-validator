export type ValidationStatus = 'UNIQUE' | 'CONFIRMED_DUPLICATE';

export interface SimilarPhraseSummary {
  id: string;
  text: string;
}

export interface PhraseListItem {
  id: string;
  text: string;
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
}

export interface FindAllOptions {
  page: number;
  limit: number;
  status?: ValidationStatus;
}

export interface CreatePhraseData {
  text: string;
  embedding: number[];
  similarityScore: number | null;
  similarToId: string | null;
  validationStatus: ValidationStatus;
}

export interface PhraseRepositoryInterface {
  create(data: CreatePhraseData): Promise<PhraseListItem>;
  findAll(options: FindAllOptions): Promise<PhraseListItem[]>;
  countAll(status?: ValidationStatus): Promise<number>;
  getAllEmbeddings(): Promise<PhraseWithEmbedding[]>;
  findByExactText(normalizedText: string): Promise<PhraseWithEmbedding | null>;
}
