/**
 * @param {unknown} v Raw emoji field from NotebookLM RPC (tuple index 3, etc.)
 * @returns {string|undefined}
 */
export function normalizeRpcEmoji(v) {
  if (v == null) return undefined
  if (typeof v === 'string') {
    const s = v.trim()
    if (s.length === 0 || s.length > 32) return undefined
    return s
  }
  return undefined
}

/**
 * Avoid showing emoji twice when `name` already starts with the same emoji.
 * @param {string} name
 * @param {string|undefined} emoji
 */
export function notebookListTitle(name, emoji) {
  if (!emoji) return name
  const n = name.trim()
  if (n.startsWith(emoji)) {
    const rest = n.slice(emoji.length).trim()
    return rest || name
  }
  return name
}
