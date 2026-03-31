import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        fullpage: resolve(__dirname, 'src/fullpage/index.html'),
      },
    },
  },
})
