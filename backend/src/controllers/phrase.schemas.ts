import { z } from 'zod';

/**
 * Allowed embedding model identifiers permitted for validation, persistence, and catalog filtering.
 */
export const ALLOWED_MODELS = [
  '@cf/baai/bge-m3',
  'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];

/**
 * Zod validation schema for POST /api/phrases/validate.
 * Sanitizes input text via trim(), enforces length boundaries [1, 280],
 * and validates optional target model against ALLOWED_MODELS.
 */
export const validatePhraseSchema = z.object({
  text: z
    .string({
      required_error: 'Phrase text is required',
      invalid_type_error: 'Phrase text must be a string',
    })
    .trim()
    .min(1, 'Phrase cannot be empty')
    .max(280, 'Phrase cannot exceed 280 characters'),
  model: z
    .enum(ALLOWED_MODELS, {
      errorMap: () => ({ message: `Model must be one of: ${ALLOWED_MODELS.join(', ')}` }),
    })
    .optional(),
});

/**
 * Zod validation schema for POST /api/phrases.
 * Sanitizes input text, accepts optional confirmDuplicate boolean flag,
 * and validates optional target model against ALLOWED_MODELS.
 */
export const createPhraseSchema = z.object({
  text: z
    .string({
      required_error: 'Phrase text is required',
      invalid_type_error: 'Phrase text must be a string',
    })
    .trim()
    .min(1, 'Phrase cannot be empty')
    .max(280, 'Phrase cannot exceed 280 characters'),
  confirmDuplicate: z.boolean().optional().default(false),
  model: z
    .enum(ALLOWED_MODELS, {
      errorMap: () => ({ message: `Model must be one of: ${ALLOWED_MODELS.join(', ')}` }),
    })
    .optional(),
});

/**
 * Zod validation schema for GET /api/phrases query parameters.
 * Validates integer page, bounded limit (max 100), optional status filter,
 * and restricts model filtering strictly to authorized models.
 */
export const listPhrasesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(['UNIQUE', 'CONFIRMED_DUPLICATE']).optional(),
  model: z
    .enum(ALLOWED_MODELS, {
      errorMap: () => ({ message: `Model must be one of: ${ALLOWED_MODELS.join(', ')}` }),
    })
    .optional(),
});

export type ValidatePhraseInput = z.infer<typeof validatePhraseSchema>;
export type CreatePhraseInput = z.infer<typeof createPhraseSchema>;
export type ListPhrasesQueryInput = z.infer<typeof listPhrasesQuerySchema>;
