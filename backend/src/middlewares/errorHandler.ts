import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { DuplicatePhraseError } from '../errors/DuplicatePhraseError.js';
import { ExternalAIProviderError } from '../errors/ExternalAIProviderError.js';
import { EmptyTextError } from '../errors/EmptyTextError.js';

/**
 * Global Express error handling middleware conforming to constitutional standard format.
 * Maps domain and transport errors to canonical JSON HTTP responses while obfuscating internal traces.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // 1. Zod input validation failure
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Validation error',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // 2. Empty or whitespace-only text domain error
  if (err instanceof EmptyTextError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: err.message,
        details: null,
      },
    });
    return;
  }

  // 3. Unconfirmed semantic duplicate phrase
  if (err instanceof DuplicatePhraseError) {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_PHRASE_DETECTED',
        message: 'Potential semantic duplicate detected',
        details: {
          similarityScore: err.similarityScore,
          threshold: err.threshold,
          similarPhrase: err.similarPhrase,
        },
      },
    });
    return;
  }

  // 4. External AI provider failure (timeout, network, or service unavailable)
  if (err instanceof ExternalAIProviderError) {
    res.status(503).json({
      success: false,
      error: {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'The AI embedding service is temporarily unavailable. Please try again later.',
        details: null,
      },
    });
    return;
  }

  // 5. Malformed JSON body from express.json parser
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload',
        details: null,
      },
    });
    return;
  }

  // 6. Payload too large from express.json parser
  if ('type' in err && err.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request payload exceeds maximum allowed size of 10kb',
        details: null,
      },
    });
    return;
  }

  // 7. Database connection or query errors
  const isDatabaseError =
    err?.name === 'PostgresError' ||
    err?.name === 'DrizzleError' ||
    (typeof err?.message === 'string' &&
      (err.message.includes('postgres') ||
        err.message.includes('ECONNREFUSED') ||
        err.message.includes('relation')));

  if (isDatabaseError) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
        details: null,
      },
    });
    return;
  }

  // 8. Generic internal server error fallback
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred',
      details: null,
    },
  });
};
