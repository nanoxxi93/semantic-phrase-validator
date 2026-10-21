import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

export interface CustomRateLimiterOptions {
  windowMs?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * Creates a rate limiter middleware for AI inference and phrase write endpoints.
 * Returns HTTP 429 RATE_LIMIT_EXCEEDED when quota is exhausted.
 */
export function createInferenceLimiter(options?: CustomRateLimiterOptions): RequestHandler {
  if (options?.disabled) {
    return (_req, _res, next) => next();
  }

  return rateLimit({
    windowMs: options?.windowMs ?? env.RATE_LIMIT_WINDOW_MS,
    limit: options?.max ?? env.RATE_LIMIT_INFERENCE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, opts) => {
      res.status(opts.statusCode).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          details: null,
        },
      });
    },
  });
}

/**
 * Creates a rate limiter middleware for read-only catalog query endpoints.
 * Returns HTTP 429 RATE_LIMIT_EXCEEDED when quota is exhausted.
 */
export function createReadLimiter(options?: CustomRateLimiterOptions): RequestHandler {
  if (options?.disabled) {
    return (_req, _res, next) => next();
  }

  return rateLimit({
    windowMs: options?.windowMs ?? env.RATE_LIMIT_WINDOW_MS,
    limit: options?.max ?? env.RATE_LIMIT_READ_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, opts) => {
      res.status(opts.statusCode).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          details: null,
        },
      });
    },
  });
}

export const inferenceLimiter = createInferenceLimiter();
export const readLimiter = createReadLimiter();
