import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** The layers, and what each may not reach into. Presentation and domain rules stay apart. */
const noServerInClient = {
  group: ['**/server/**', '../server/*', '../../server/*'],
  message: 'Client code must not import server code. Put shared rules in shared/.',
};
const noClientInServer = {
  group: ['@/*', '**/src/**'],
  message: 'Server and shared code must not import client code (and must not use the @/ alias).',
};

export default tseslint.config(
  {
    ignores: [
      'dist',
      '.data',
      '.vercel',
      'coverage',
      'design/explorations',
      'server/db/migrations.generated.ts',
      'public/sw.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'no-restricted-imports': ['error', { patterns: [noServerInClient] }],
    },
  },
  {
    files: ['server/**/*.ts', 'shared/**/*.ts', 'api/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noClientInServer] }],
    },
  },
  {
    files: ['shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            noClientInServer,
            { group: ['**/server/**', '../server/*'], message: 'shared/ must not import server code.' },
            {
              group: ['node:*', 'pg', 'hono', 'hono/*', 'drizzle-orm', 'drizzle-orm/*'],
              message: 'shared/ runs in the browser too.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**', 'tests/**', 'e2e/**', '*.config.*'],
    rules: { 'no-console': 'off' },
  },
  prettier,
);
