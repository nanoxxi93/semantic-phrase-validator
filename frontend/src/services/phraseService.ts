import { request } from './api.js';
import type {
  PhraseValidationResult,
  PaginatedPhrases,
  HealthCheckData,
  ActiveModelInfo,
} from '../types/api.js';
import type { PhraseListItem, ValidationStatus } from '../types/phrase.js';

export const phraseService = {
  /**
   * Pre-validates a phrase for semantic duplicate without persisting.
   * Calls POST /api/phrases/validate with optional target model.
   */
  async validatePhrase(text: string, model?: string): Promise<PhraseValidationResult> {
    return request<PhraseValidationResult>('/phrases/validate', {
      method: 'POST',
      body: JSON.stringify({ text, model }),
    });
  },

  /**
   * Persists a phrase as UNIQUE or CONFIRMED_DUPLICATE.
   * Calls POST /api/phrases with optional target model.
   */
  async createPhrase(
    text: string,
    confirmDuplicate: boolean = false,
    model?: string
  ): Promise<PhraseListItem> {
    return request<PhraseListItem>('/phrases', {
      method: 'POST',
      body: JSON.stringify({ text, confirmDuplicate, model }),
    });
  },

  /**
   * Retrieves paginated list of catalog phrases with optional status and model filter.
   * Calls GET /api/phrases?page={page}&limit={limit}&status={status}&model={model}
   */
  async listPhrases(
    page: number = 1,
    limit: number = 10,
    status?: ValidationStatus,
    model?: string
  ): Promise<PaginatedPhrases> {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (status) {
      params.append('status', status);
    }

    if (model) {
      params.append('model', model);
    }

    return request<PaginatedPhrases>(`/phrases?${params.toString()}`);
  },

  /**
   * Retrieves active model configuration and threshold from the backend.
   * Calls GET /api/model
   */
  async getActiveModel(): Promise<ActiveModelInfo> {
    return request<ActiveModelInfo>('/model');
  },

  /**
   * Ultralightweight health check probe for mitigating backend cold starts.
   * Calls GET /api/health
   */
  async checkHealth(): Promise<HealthCheckData> {
    return request<HealthCheckData>('/health');
  },
};
