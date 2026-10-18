import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/gemini-photo-restorer/' : './',
  plugins: [react()],
  // @ts-expect-error vitest config field
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
