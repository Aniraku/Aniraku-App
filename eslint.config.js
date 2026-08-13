import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'node_modules', 'android/**', 'public/seo.js'] },
  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        location: 'readonly',
        history: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        matchMedia: 'readonly',
        Image: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        HTMLElement: 'readonly',
        HTMLMediaElement: 'readonly',
        MediaSource: 'readonly',
        DOMException: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        PopStateEvent: 'readonly',
        Node: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        crypto: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        VITE_API_URL: 'readonly',
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: '18.3' },
    },
    rules: {
      // JSX element names (components defined in the same file) count as
      // usage for no-unused-vars — without this, locally-defined components
      // render "never used" even though they appear in the markup.
      'react/jsx-uses-vars': 'error',
      // SEC-01 guard: undeclared variables in middleware.js crash every
      // crawler request (500) while real browsers still get 200. This rule
      // must stay an error so that class of regression can never ship.
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': 'warn',
      'no-useless-assignment': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Rules from react-hooks v7 recommended that this pre-existing
      // codebase (written against v4-era patterns) does not pass; keep them
      // off rather than block the whole tree. They are aspirational.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
]
