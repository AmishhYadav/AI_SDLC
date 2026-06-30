// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Ban process.env access in all TS files — access only via AppConfigService (INFRA-03)
    files: ['**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Access process.env only through AppConfigService (packages/backend/src/config/). See INFRA-03.',
        },
      ],
    },
  },
  {
    // Escape hatch: config module is the only place allowed to read process.env directly
    files: ['packages/backend/src/config/**/*.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  prettierConfig, // MUST be last among rule objects — disables rules that conflict with Prettier
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/*.js',
      '.planning/**',
    ],
  },
);
