import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import tseslint from 'typescript-eslint';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'describe',
          property: 'only',
          message: '커밋된 테스트에서 only를 사용하지 않습니다.',
        },
        { object: 'it', property: 'only', message: '커밋된 테스트에서 only를 사용하지 않습니다.' },
        {
          object: 'test',
          property: 'only',
          message: '커밋된 테스트에서 only를 사용하지 않습니다.',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
  globalIgnores([
    '.next/**',
    'coverage/**',
    'node_modules/**',
    'out/**',
    'build/**',
    'playwright-report/**',
    'supabase/.branches/**',
    'supabase/.temp/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
