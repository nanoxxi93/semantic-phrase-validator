import { z } from 'zod';

/**
 * Zod validation schema for POST /api/phrases/validate.
 * Sanitizes input text via trim() and enforces length boundaries [1, 280].
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
});

/**
 * Zod validation schema for POST /api/phrases.
 * Sanitizes input text and accepts optional confirmDuplicate boolean flag.
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
});

/**
 * Zod validation schema for GET /api/phrases query parameters.
 * Validates integer page, bounded limit (max 100), and optional validation status filter.
 */
export const listPhrasesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.enum(['UNIQUE', 'CONFIRMED_DUPLICATE']).optional(),
});

export type ValidatePhraseInput = z.infer<typeof validatePhraseSchema>;
export type CreatePhraseInput = z.infer<typeof createPhraseSchema>;
export type ListPhrasesQueryInput = z.infer<typeof listPhrasesQuerySchema>;
