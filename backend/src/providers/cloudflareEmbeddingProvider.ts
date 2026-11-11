import type { EmbeddingProvider } from './embeddingProvider.interface.js';
import { EmptyTextError } from '../errors/EmptyTextError.js';
import { ExternalAIProviderError } from '../errors/ExternalAIProviderError.js';
import { InvalidEmbeddingResponseError } from '../errors/InvalidEmbeddingResponseError.js';

export interface CloudflareEmbeddingProviderOptions {
  model?: string;
  gatewayId?: string;
  fetchClient?: typeof fetch;
}

export class CloudflareEmbeddingProvider implements EmbeddingProvider {
  public readonly modelIdentifier: string;
  private readonly accountId: string;
  private readonly apiToken: string;
  private readonly gatewayId?: string;
  private readonly fetchClient: typeof fetch;
  public static readonly EXPECTED_DIMENSION = 1024;
  private static readonly MAX_RETRIES = 2;
  private static readonly TIMEOUT_MS = 8000;

  constructor(
    accountId: string,
    apiToken: string,
    options?: CloudflareEmbeddingProviderOptions | string,
    fetchClient?: typeof fetch
  ) {
    this.accountId = accountId;
    this.apiToken = apiToken;

    if (typeof options === 'string') {
      this.modelIdentifier = options;
      this.fetchClient = fetchClient ?? fetch;
    } else {
      this.modelIdentifier = options?.model ?? '@cf/baai/bge-m3';
      this.gatewayId = options?.gatewayId;
      this.fetchClient = fetchClient ?? options?.fetchClient ?? fetch;
    }
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    const normalized = this.normalizeText(text);
    if (normalized.length === 0) {
      throw new EmptyTextError();
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
    };

    if (this.gatewayId && this.gatewayId.trim().length > 0) {
      headers['cf-aig-gateway-id'] = this.gatewayId.trim();
    }

    const payload = {
      model: this.modelIdentifier,
      input: {
        text: [normalized],
      },
    };

    let attempts = 0;
    while (attempts <= CloudflareEmbeddingProvider.MAX_RETRIES) {
      try {
        const response = await this.fetchClient(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(CloudflareEmbeddingProvider.TIMEOUT_MS),
        });

        if (!response.ok) {
          const status = response.status;
          let errorMessage = `Cloudflare Workers AI responded with status ${status}`;

          try {
            const errorBody = (await response.json()) as {
              errors?: Array<{ message?: string; code?: number }>;
            };
            if (errorBody?.errors && errorBody.errors.length > 0 && errorBody.errors[0]?.message) {
              errorMessage = errorBody.errors[0].message;
            }
          } catch {
            // Ignore JSON parse errors on non-OK responses
          }

          // Do not retry client auth/not found errors (401, 403, 404)
          const isRetryable = status === 429 || status >= 500;
          if (isRetryable && attempts < CloudflareEmbeddingProvider.MAX_RETRIES) {
            attempts++;
            await this.delay(200 * attempts);
            continue;
          }

          throw new ExternalAIProviderError(errorMessage, status);
        }

        const data = await response.json();
        return this.parseAndValidateResponse(data);
      } catch (err: unknown) {
        if (err instanceof EmptyTextError || err instanceof InvalidEmbeddingResponseError) {
          throw err;
        }

        if (err instanceof ExternalAIProviderError) {
          throw err;
        }

        attempts++;
        if (attempts <= CloudflareEmbeddingProvider.MAX_RETRIES) {
          await this.delay(200 * attempts);
          continue;
        }

        const rawMessage =
          (err as Error)?.message || 'Unknown network error while contacting Cloudflare Workers AI';
        throw new ExternalAIProviderError(rawMessage);
      }
    }

    throw new ExternalAIProviderError(
      'Failed to generate embedding from Cloudflare Workers AI after retries.'
    );
  }

  private normalizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  private parseAndValidateResponse(response: unknown): number[] {
    const cfResult = (response as { result?: { data?: unknown } })?.result;
    if (!cfResult || !cfResult.data) {
      throw new InvalidEmbeddingResponseError(
        'Malformed Cloudflare Workers AI response: missing result.data field.'
      );
    }

    let rawVector: unknown = cfResult.data;

    // Tolerant unpacking: Handle 2D tensor [[...]] from batched input
    if (Array.isArray(rawVector) && rawVector.length >= 1 && Array.isArray(rawVector[0])) {
      rawVector = rawVector[0];
    }

    if (!Array.isArray(rawVector) || rawVector.length !== CloudflareEmbeddingProvider.EXPECTED_DIMENSION) {
      throw new InvalidEmbeddingResponseError(
        `Expected ${CloudflareEmbeddingProvider.EXPECTED_DIMENSION} numbers from Cloudflare Workers AI, but received ${
          Array.isArray(rawVector) ? rawVector.length : typeof rawVector
        }.`
      );
    }

    for (let i = 0; i < rawVector.length; i++) {
      if (typeof rawVector[i] !== 'number' || Number.isNaN(rawVector[i])) {
        throw new InvalidEmbeddingResponseError(
          'Embedding vector from Cloudflare Workers AI contains non-numeric values.'
        );
      }
    }

    return rawVector as number[];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
