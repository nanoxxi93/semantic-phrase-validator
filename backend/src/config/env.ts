import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const candidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend', '.env'),
  path.resolve(process.cwd(), '..', '.env'),
];

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  HF_TOKEN: z.string().min(1, 'HF_TOKEN is required'),
  HF_MODEL: z.string().default('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SIMILARITY_THRESHOLD: z.coerce.number().gt(0).lte(1).default(0.80),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  EMBEDDING_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_INFERENCE_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_READ_MAX: z.coerce.number().int().positive().default(100),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(rawEnv);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }

  return parsed.data;
}

export const env = validateEnv();
