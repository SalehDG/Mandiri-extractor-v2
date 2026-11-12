
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/Mandiri-extractor-v2/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    clearMocks: true,
  },
})
