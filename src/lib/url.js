/**
 * Validates a single URL line (http/https) for manual entry in the Links tab.
 */
export const HTTP_URL_REGEX = /^https?:\/\/[^\s]+$/i

export function isValidUrlLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (!HTTP_URL_REGEX.test(trimmed)) return false
  try {
    const u = new URL(trimmed)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function parseUrlLines(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
}

export function partitionValidUrls(lines) {
  const valid = []
  const invalid = []
  for (const line of lines) {
    if (isValidUrlLine(line)) valid.push(line.trim())
    else invalid.push(line)
  }
  return { valid, invalid }
}
