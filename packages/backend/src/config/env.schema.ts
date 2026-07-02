import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    // Phase 3 additions (D-16):
    CORS_ORIGINS: z.string().min(1, 'CORS_ORIGINS must be a non-empty comma-separated list'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    THROTTLER_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    THROTTLER_LIMIT: z.coerce.number().int().positive().default(100),
    // Phase 4 additions (D-05): auth mode + Entra ID configuration
    AUTH_MODE: z.enum(['stub', 'entra']).default('stub'),
    ENTRA_TENANT_ID: z.string().min(1, 'ENTRA_TENANT_ID must be non-empty').optional(),
    ENTRA_AUDIENCE: z.string().min(1, 'ENTRA_AUDIENCE must be non-empty').optional(),
  })
  .superRefine((data, ctx) => {
    // Production guard: stub mode must not run in production (T-04-01)
    if (data.NODE_ENV === 'production' && data.AUTH_MODE === 'stub') {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message: 'AUTH_MODE cannot be "stub" in production — set AUTH_MODE=entra',
      });
    }

    // Entra guard: AUTH_MODE=entra requires ENTRA_TENANT_ID and ENTRA_AUDIENCE
    if (data.AUTH_MODE === 'entra') {
      const required: Array<'ENTRA_TENANT_ID' | 'ENTRA_AUDIENCE'> = [
        'ENTRA_TENANT_ID',
        'ENTRA_AUDIENCE',
      ];
      for (const key of required) {
        if (!data[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when AUTH_MODE is "entra"`,
          });
        }
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
