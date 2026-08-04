import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      // 전송 계층(api)을 직접 부르면 경로·쿼리·응답이 전부 unknown이 되어 계약 드리프트
      // (서버는 커서인데 page를 보낸다든가)가 컴파일을 통과한다. src/api/typed.ts를 거쳐야
      // 생성 스키마가 강제된다 — typed.ts 자신만 예외로 아래 override에서 푼다.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/api/client.js', '**/api/client'],
              importNames: ['api'],
              message: 'api 직접 사용 금지 — src/api/typed.ts의 apiGet/apiPost/…를 쓰세요.',
            },
          ],
        },
      ],
    },
  },
  {
    // typed.ts는 이 규칙이 지키려는 경계 그 자체다 — 여기서만 api를 직접 쓴다.
    files: ['src/api/typed.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // 테스트는 전송 계층을 목킹해 최종 URL을 검증하므로 client 모듈을 직접 다룬다.
    files: ['src/**/*.test.{ts,tsx}', 'src/test-utils.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
