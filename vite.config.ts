import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// `base: './'` keeps every asset URL relative, so the built `dist/` folder works
// from any path on any static host. Routing is hash-based for the same reason.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
