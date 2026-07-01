import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  // Phase 3 additions (D-16):
  CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS must be a non-empty comma-separated list'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  THROTTLER_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;
