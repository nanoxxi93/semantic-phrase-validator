import { Router } from 'express';
import type { RequestHandler } from 'express';
import { db } from '../db/index.js';
import { env } from '../config/env.js';
import { PhraseRepository } from '../repositories/phraseRepository.js';
import { HuggingFaceEmbeddingProvider } from '../providers/huggingFaceEmbeddingProvider.js';
import { InMemoryEmbeddingCache } from '../cache/inMemoryEmbeddingCache.js';
import { PhraseService } from '../services/phraseService.js';
import { PhraseController } from '../controllers/phraseController.js';
import { contentTypeValidator } from '../middlewares/contentTypeValidator.js';
import { inferenceLimiter, readLimiter } from '../middlewares/rateLimiter.js';

// 1. Dependency chain assembly using shared database singleton
export const phraseRepository = new PhraseRepository(db);

export const embeddingProvider = new HuggingFaceEmbeddingProvider(
  env.HF_TOKEN,
  env.HF_MODEL
);

export const embeddingCache = new InMemoryEmbeddingCache({
  maxCapacity: 1000,
  defaultTtlSeconds: env.EMBEDDING_CACHE_TTL_SECONDS,
});

export const phraseService = new PhraseService({
  embeddingProvider,
  phraseRepository,
  embeddingCache,
  threshold: env.SIMILARITY_THRESHOLD,
});

export const phraseController = new PhraseController(phraseService);

/**
 * Factory helper for creating router instances with optional custom services in tests.
 */
export function createPhraseRouter(
  service: PhraseService = phraseService,
  options?: { disableRateLimit?: boolean }
): Router {
  const router = Router();
  const controller = new PhraseController(service);

  const passthrough: RequestHandler = (_req, _res, next) => next();
  const activeInferenceLimiter = options?.disableRateLimit ? passthrough : inferenceLimiter;
  const activeReadLimiter = options?.disableRateLimit ? passthrough : readLimiter;

  // POST /api/phrases/validate - Pre-validation endpoint
  router.post(
    '/validate',
    contentTypeValidator,
    activeInferenceLimiter,
    controller.validate
  );

  // POST /api/phrases - Phrase creation endpoint
  router.post(
    '/',
    contentTypeValidator,
    activeInferenceLimiter,
    controller.create
  );

  // GET /api/phrases - Paginated catalog query endpoint
  router.get(
    '/',
    activeReadLimiter,
    controller.list
  );

  return router;
}

// 2. Default router instance with assembled dependencies
const defaultRouter = createPhraseRouter(phraseService);

export default defaultRouter;
