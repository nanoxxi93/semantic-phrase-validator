import { request } from './api.js';
import type {
  PhraseValidationResult,
  PaginatedPhrases,
  HealthCheckData,
} from '../types/api.js';
import type { PhraseListItem, ValidationStatus } from '../types/phrase.js';

export const phraseService = {
  /**
   * Pre-validates a phrase for semantic duplicate without persisting.
   * Calls POST /api/phrases/validate
   */
  async validatePhrase(text: string): Promise<PhraseValidationResult> {
    return request<PhraseValidationResult>('/phrases/validate', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  /**
   * Persists a phrase as UNIQUE or CONFIRMED_DUPLICATE.
   * Calls POST /api/phrases
   */
  async createPhrase(
    text: string,
    confirmDuplicate: boolean = false
  ): Promise<PhraseListItem> {
    return request<PhraseListItem>('/phrases', {
      method: 'POST',
      body: JSON.stringify({ text, confirmDuplicate }),
    });
  },

  /**
   * Retrieves paginated list of catalog phrases.
   * Calls GET /api/phrases?page={page}&limit={limit}&status={status}
   */
  async listPhrases(
    page: number = 1,
    limit: number = 10,
    status?: ValidationStatus
  ): Promise<PaginatedPhrases> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (status) {
      params.append('status', status);
    }

    return request<PaginatedPhrases>(`/phrases?${params.toString()}`);
  },

  /**
   * Ultralightweight health check probe for mitigating backend cold starts.
   * Calls GET /api/health
   */
  async checkHealth(): Promise<HealthCheckData> {
    return request<HealthCheckData>('/health');
  },
};
