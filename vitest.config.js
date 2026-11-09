import { defineConfig } from 'vitest/config'

// Tests cover the pure lib layer plus Dexie storage (via fake-indexeddb).
export default defineConfig({
  test: { environment: 'node', setupFiles: ['tests/setup.js'] }
})
