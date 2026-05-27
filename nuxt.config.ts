// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-26',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
  ],

  // Use Nuxt 4 directory structure (app/ directory). Plan keeps source at root via srcDir override.
  srcDir: '.',
  serverDir: 'server',

  runtimeConfig: {
    sessionTtlDays: Number(process.env.SESSION_TTL_DAYS ?? 7),
    storageDir: process.env.STORAGE_DIR ?? './storage/uploads',
    public: {},
  },

  typescript: {
    typeCheck: true,
    strict: true,
  },
})
