import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
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
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // ── TypeScript ─────────────────────────────────────────────────────────
      // Downgrade any→warn: many hooks/db layers use `any` legitimately (Dexie, Supabase generics)
      '@typescript-eslint/no-explicit-any': 'warn',

      // ── React Hooks v7 strict rules ────────────────────────────────────────
      // These new rules flag common-but-intentional patterns (form init from props,
      // search debounce resets). Downgrade to warn until each can be properly refactored.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',

      // ── React Refresh ──────────────────────────────────────────────────────
      // Context files export both the context and the hook — this is fine
      'react-refresh/only-export-components': 'warn',
    },
  },
])
