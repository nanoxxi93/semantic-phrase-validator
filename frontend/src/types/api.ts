import type { PhraseListItem, SimilarPhraseSummary } from './phrase.js';

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
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

export interface HealthCheckData {
  status: string;
  timestamp: string;
}
