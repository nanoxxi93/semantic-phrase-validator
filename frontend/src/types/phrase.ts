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
  createdAt: string | Date;
}
