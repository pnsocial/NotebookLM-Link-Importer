const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

/** True if `id` is a NotebookLM Google project UUID (synced notebook). */
export function isNotebooklmProjectId(id) {
  return typeof id === 'string' && UUID_RE.test(id)
}

export function isUuidShape(s) {
  return typeof s === 'string' && UUID_RE.test(s)
}
