import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Copy toolbar PNGs to dist/icons/ so manifest paths stay short (icons/…) — better cross-OS unzip / Load unpacked. */
function copyExtensionIconsToDist() {
  return {
    name: 'copy-extension-icons',
    closeBundle() {
      const srcDir = join(__dirname, 'icons')
      const destDir = join(__dirname, 'dist', 'icons')
      if (!existsSync(srcDir)) return
      mkdirSync(destDir, { recursive: true })
      for (const f of readdirSync(srcDir)) {
        if (f.endsWith('.png')) copyFileSync(join(srcDir, f), join(destDir, f))
      }
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), crx({ manifest }), copyExtensionIconsToDist()],
  build: {
    rollupOptions: {
      input: {
        fullpage: resolve(__dirname, 'src/fullpage/index.html'),
      },
    },
  },
})
