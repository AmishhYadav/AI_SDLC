// Source: https://docs.nestjs.com/recipes/swc (testing section)
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    exclude: ['dist/**', 'node_modules/**'],
    // Env vars required by AppConfigModule (Zod schema validates at module load time via ConfigModule.forRoot).
    // These must be set here (not in test files) because ESM imports are hoisted before top-level code.
    env: {
      DATABASE_URL: 'postgresql://mock:mock@localhost:5432/mock',
      CORS_ORIGINS: 'http://localhost:3001',
      // Phase 4: explicit stub mode — no live Entra tenant required for any test in this suite
      AUTH_MODE: 'stub',
    },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
