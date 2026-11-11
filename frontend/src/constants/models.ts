export interface SupportedModel {
  id: string;
  name: string;
  shortLabel: string;
  provider: 'cloudflare' | 'huggingface';
  dimension: number;
}

export const AVAILABLE_MODELS: readonly SupportedModel[] = [
  {
    id: '@cf/baai/bge-m3',
    name: 'Cloudflare BGE-M3 (1024d)',
    shortLabel: 'BGE-M3 · 1024d',
    provider: 'cloudflare',
    dimension: 1024,
  },
  {
    id: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    name: 'Hugging Face MiniLM-L12-v2 (384d)',
    shortLabel: 'MiniLM · 384d',
    provider: 'huggingface',
    dimension: 384,
  },
] as const;

export const DEFAULT_MODEL_ID = '@cf/baai/bge-m3';

/**
 * Returns metadata for a given model identifier, with a safe fallback for unknown historical models.
 */
export function getModelMeta(modelId: string | null | undefined): SupportedModel {
  const found = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (found) {
    return found;
  }
  return {
    id: modelId ?? 'unknown',
    name: modelId ? `Modelo: ${modelId}` : 'Modelo no especificado',
    shortLabel: modelId ? (modelId.includes('/') ? modelId.split('/').pop()! : modelId) : 'Desconocido',
    provider: 'cloudflare',
    dimension: 0,
  };
}
