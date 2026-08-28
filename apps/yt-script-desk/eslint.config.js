import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // A leading underscore means "this argument exists for its TYPE, not its
      // value". `vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ...)`
      // has to declare both so `fetchMock.mock.calls[0][0]` is typed at all —
      // deleting them to satisfy the rule breaks `tsc`. This is the rule option
      // that exists for exactly that case; it narrows nothing else.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
])
