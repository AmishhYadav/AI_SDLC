// Source: https://docs.nestjs.com/recipes/swc (testing section)
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    exclude: ['dist/**', 'node_modules/**'],
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
