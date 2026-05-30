// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-26',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxtjs/i18n',
  ],

  css: ['~/assets/css/main.css'],

  i18n: {
    defaultLocale: 'vi',
    strategy: 'no_prefix',
    locales: [
      { code: 'vi', name: 'Tiếng Việt', file: 'vi.json' },
    ],
    vueI18n: 'i18n.config.ts',
    bundle: {
      optimizeTranslationDirective: false,
    },
  },

  // Use Nuxt 4 directory structure (app/ directory). Plan keeps source at root via srcDir override.
  srcDir: '.',
  serverDir: 'server',

  runtimeConfig: {
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
    storageDir: process.env.STORAGE_DIR ?? './storage/uploads',
    public: {},
  },

  typescript: {
    typeCheck: false,
    strict: true,
  },
})
