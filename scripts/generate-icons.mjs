/**
 * Writes extension toolbar icons at 16 / 48 / 128 px (Chrome MV3).
 * Single emblem: bookmark ribbon on dark tile (larger glyph vs. older sparkle+folder).
 * Run: npm run generate-icons
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
/** Toolbar icons at repo root — manifest uses `icons/icon*.png` (short path for Chrome on all OS). */
const outDir = join(__dirname, '..', 'icons')

/** One bookmark shape; padding ~8% so the symbol reads larger on the toolbar. */
function iconSvg(size) {
  const pad = Math.max(1, Math.round(size * 0.08))
  const r = Math.max(2, Math.round(size * 0.2))
  const inner = size - pad * 2
  const cx = size / 2
  const bw = inner * 0.52
  const left = cx - bw / 2
  const top = pad + inner * 0.12
  const bottom = pad + inner * 0.88
  const notchY = pad + inner * 0.58
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect x="${pad}" y="${pad}" width="${inner}" height="${inner}" rx="${r}" fill="url(#bg)"/>
  <path fill="#38bdf8" d="M ${left} ${top} L ${left + bw} ${top} L ${left + bw} ${notchY} L ${cx} ${bottom} L ${left} ${notchY} Z"/>
</svg>`
}

await mkdir(outDir, { recursive: true })

for (const s of [16, 48, 128]) {
  const png = await sharp(Buffer.from(iconSvg(s))).png().toBuffer()
  await writeFile(join(outDir, `icon${s}.png`), png)
  console.log('wrote', `icon${s}.png`, png.length, 'bytes')
}
