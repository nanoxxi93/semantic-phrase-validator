import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { PhraseController } from '../controllers/phraseController.js';
import { contentTypeValidator } from '../middlewares/contentTypeValidator.js';

export interface PhraseRoutesOptions {
  phraseController: PhraseController;
  inferenceLimiter: RequestHandler;
  readLimiter: RequestHandler;
}

/**
 * Creates and configures the Express router for phrase validation and catalog operations.
 * Binds content type validation and rate limiting middlewares.
 */
export function createPhraseRoutes(options: PhraseRoutesOptions): Router {
  const router = Router();
  const { phraseController, inferenceLimiter, readLimiter } = options;

  // POST /api/phrases/validate - Pre-validation endpoint
  router.post(
    '/validate',
    contentTypeValidator,
    inferenceLimiter,
    phraseController.validate
  );

  // POST /api/phrases - Phrase creation endpoint
  router.post(
    '/',
    contentTypeValidator,
    inferenceLimiter,
    phraseController.create
  );

  // GET /api/phrases - Paginated catalog query endpoint
  router.get(
    '/',
    readLimiter,
    phraseController.list
  );

  return router;
}
