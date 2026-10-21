import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { db } from './db/index.js';
import { PhraseRepository } from './repositories/phraseRepository.js';
import type { PhraseRepositoryInterface } from './repositories/phraseRepository.interface.js';
import { HuggingFaceEmbeddingProvider } from './providers/huggingFaceEmbeddingProvider.js';
import type { EmbeddingProvider } from './providers/embeddingProvider.interface.js';
import { InMemoryEmbeddingCache } from './cache/inMemoryEmbeddingCache.js';
import type { EmbeddingCache } from './cache/embeddingCache.interface.js';
import { PhraseService } from './services/phraseService.js';
import { PhraseController } from './controllers/phraseController.js';
import { healthController } from './controllers/healthController.js';
import { createPhraseRoutes } from './routes/phraseRoutes.js';
import { createInferenceLimiter, createReadLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorHandler.js';

export interface AppOptions {
  embeddingProvider?: EmbeddingProvider;
  embeddingCache?: EmbeddingCache;
  phraseRepository?: PhraseRepositoryInterface;
  similarityThreshold?: number;
  disableRateLimit?: boolean;
}

/**
 * Application factory creating an Express instance with dependency injection support.
 * Facilitates test isolation using MockEmbeddingProvider and in-memory caches without network calls.
 */
export function createApp(options?: AppOptions): express.Express {
  const app = express();

  // 1. Trust proxy configuration for Fly.io reverse proxy
  app.set('trust proxy', env.TRUST_PROXY);

  // 2. Defensive HTTP headers with Helmet
  app.use(helmet());

  // 3. CORS configuration restricting access to whitelisted origins
  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    })
  );

  // 4. Strict JSON body parser with 10kb denial-of-service safeguard
  app.use(express.json({ limit: '10kb' }));

  // 5. Ultralightweight health check endpoint (exempt from rate limiting and DB)
  app.get('/api/health', healthController);

  // 6. Rate limiter middleware instances (configurable/bypassable in tests)
  const inferenceLimiter = createInferenceLimiter({ disabled: options?.disableRateLimit });
  const readLimiter = createReadLimiter({ disabled: options?.disableRateLimit });

  // 7. Domain service and repository wiring with dependency injection
  const repository = options?.phraseRepository ?? new PhraseRepository(db);
  const provider =
    options?.embeddingProvider ??
    new HuggingFaceEmbeddingProvider(env.HF_TOKEN, env.HF_MODEL);
  const cache =
    options?.embeddingCache ??
    new InMemoryEmbeddingCache({
      maxCapacity: 1000,
      defaultTtlSeconds: env.EMBEDDING_CACHE_TTL_SECONDS,
    });
  const threshold = options?.similarityThreshold ?? env.SIMILARITY_THRESHOLD;

  const phraseService = new PhraseService({
    embeddingProvider: provider,
    phraseRepository: repository,
    embeddingCache: cache,
    threshold,
  });

  const phraseController = new PhraseController(phraseService);

  // 8. Mount phrase API routes
  const phraseRoutes = createPhraseRoutes({
    phraseController,
    inferenceLimiter,
    readLimiter,
  });
  app.use('/api/phrases', phraseRoutes);

  // 9. Centralized error handling middleware
  app.use(errorHandler);

  return app;
}
