import { HfInference } from '@huggingface/inference';
import type { EmbeddingProvider } from './embeddingProvider.interface.js';
import { EmptyTextError } from '../errors/EmptyTextError.js';
import { ExternalAIProviderError } from '../errors/ExternalAIProviderError.js';
import { InvalidEmbeddingResponseError } from '../errors/InvalidEmbeddingResponseError.js';

export class HuggingFaceEmbeddingProvider implements EmbeddingProvider {
  private readonly hf: HfInference;
  private readonly model: string;
  private static readonly EXPECTED_DIMENSION = 384;
  private static readonly MAX_RETRIES = 2;

  constructor(
    token: string,
    model: string = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    client?: HfInference
  ) {
    this.hf = client ?? new HfInference(token);
    this.model = model;
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    const normalized = this.normalizeText(text);
    if (normalized.length === 0) {
      throw new EmptyTextError();
    }

    let attempts = 0;
    while (attempts <= HuggingFaceEmbeddingProvider.MAX_RETRIES) {
      try {
        const response = await this.hf.featureExtraction({
          model: this.model,
          inputs: normalized,
        });

        return this.parseAndValidateResponse(response);
      } catch (err: unknown) {
        attempts++;
        const isColdStart = this.isColdStartError(err);

        if (isColdStart && attempts <= HuggingFaceEmbeddingProvider.MAX_RETRIES) {
          const delayMs = this.extractEstimatedTime(err) || 500;
          await this.delay(delayMs);
          continue;
        }

        if (err instanceof EmptyTextError || err instanceof InvalidEmbeddingResponseError) {
          throw err;
        }

        const statusCode =
          (err as { status?: number; statusCode?: number })?.status ||
          (err as { status?: number; statusCode?: number })?.statusCode;
        const rawMessage =
          (err as Error)?.message || 'Unknown error occurred while contacting Hugging Face Inference API';

        throw new ExternalAIProviderError(rawMessage, statusCode);
      }
    }

    throw new ExternalAIProviderError('Failed to generate embedding after retries.');
  }

  private normalizeText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  private parseAndValidateResponse(response: unknown): number[] {
    let rawVector: unknown = response;

    // Tolerant unpacking: Handle 2D tensor of shape 1 x 384 ([[...]])
    if (Array.isArray(rawVector) && rawVector.length === 1 && Array.isArray(rawVector[0])) {
      rawVector = rawVector[0];
    }

    if (!Array.isArray(rawVector) || rawVector.length !== HuggingFaceEmbeddingProvider.EXPECTED_DIMENSION) {
      throw new InvalidEmbeddingResponseError(
        `Expected 384 numbers from model, but received ${Array.isArray(rawVector) ? rawVector.length : typeof rawVector}.`
      );
    }

    for (let i = 0; i < rawVector.length; i++) {
      if (typeof rawVector[i] !== 'number' || Number.isNaN(rawVector[i])) {
        throw new InvalidEmbeddingResponseError('Embedding vector contains non-numeric values.');
      }
    }

    return rawVector as number[];
  }

  private isColdStartError(err: unknown): boolean {
    const status = (err as { status?: number })?.status;
    const message = (err as Error)?.message?.toLowerCase() || '';
    return status === 503 || message.includes('loading') || message.includes('currently loading');
  }

  private extractEstimatedTime(err: unknown): number | null {
    const estimated = (err as { estimated_time?: number })?.estimated_time;
    if (typeof estimated === 'number' && estimated > 0) {
      return Math.min(Math.round(estimated * 1000), 10000);
    }
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
