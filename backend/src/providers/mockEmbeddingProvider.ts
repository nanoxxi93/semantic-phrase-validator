import type { EmbeddingProvider } from './embeddingProvider.interface.js';
import { EmptyTextError } from '../errors/EmptyTextError.js';
import { InvalidVectorDimensionError } from '../errors/InvalidVectorDimensionError.js';

export interface MockEmbeddingProviderOptions {
  dimension?: number;
  modelIdentifier?: string;
}

export class MockEmbeddingProvider implements EmbeddingProvider {
  public readonly modelIdentifier: string;
  private readonly dimension: number;
  private readonly fixtures: Map<string, number[]> = new Map();

  constructor(options?: MockEmbeddingProviderOptions) {
    this.dimension = options?.dimension ?? 384;
    this.modelIdentifier =
      options?.modelIdentifier ?? 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
  }

  public registerFixture(text: string, vector: number[]): void {
    if (vector.length !== this.dimension) {
      throw new InvalidVectorDimensionError(vector.length, this.dimension, this.dimension);
    }
    const normalized = text.trim().replace(/\s+/g, ' ');
    this.fixtures.set(normalized, vector);
  }

  public async generateEmbedding(text: string): Promise<number[]> {
    const normalized = text.trim().replace(/\s+/g, ' ');
    if (normalized.length === 0) {
      throw new EmptyTextError();
    }

    if (this.fixtures.has(normalized)) {
      return [...(this.fixtures.get(normalized)!)];
    }

    return this.generateDeterministicVector(normalized);
  }

  private generateDeterministicVector(text: string): number[] {
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    }

    const vector: number[] = new Array(this.dimension);
    let normSq = 0;

    for (let i = 0; i < this.dimension; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const val = (seed / 4294967295) * 2 - 1;
      vector[i] = val;
      normSq += val * val;
    }

    const norm = Math.sqrt(normSq) || 1;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = Math.round((vector[i] / norm + Number.EPSILON) * 10000) / 10000;
    }

    return vector;
  }
}
