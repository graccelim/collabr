import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Plan resolution reads BETA_FREE_PRO at call time; tests set it per-case.
    // Dummy Stripe key satisfies lib/stripe's module-load constructor; no
    // network calls are made in unit tests.
    env: { BETA_FREE_PRO: 'true', STRIPE_SECRET_KEY: 'sk_test_dummy' },
  },
})
