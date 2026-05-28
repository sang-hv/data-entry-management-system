// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    name: 'app/ignores',
    ignores: [
      '.kiro/**',
      '.nuxt/**',
      '.output/**',
      'node_modules/**',
      'prisma/migrations/**',
    ],
  },
  {
    name: 'app/rules',
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
    },
  },
)
