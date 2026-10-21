import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { healthController } from './controllers/healthController.js';
import phraseRoutes from './routes/phraseRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

export interface AppOptions {
  phraseRouter?: express.Router;
}

/**
 * Application factory creating an Express instance.
 * Keeps app.ts clean and decoupled by mounting self-contained module routers.
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

  // 6. Mount modular phrase router
  app.use('/api/phrases', options?.phraseRouter ?? phraseRoutes);

  // 7. Centralized error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
