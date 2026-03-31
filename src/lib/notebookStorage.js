const NOTEBOOKLM_SYNC_KEY = 'urc:notebooklm_sync'
const SOURCES_KEY = 'urc:notebookSources'

function normalizeSourceEntry(e) {
  if (typeof e === 'string') return { url: e, addedAt: 0 }
  return { url: e.url, addedAt: e.addedAt ?? 0 }
}

function mapNotebook(n) {
  const row = {
    id: String(n.id ?? ''),
    name: String(n.name ?? 'Notebook'),
  }
  if (typeof n.emoji === 'string' && n.emoji.trim()) {
    row.emoji = n.emoji.trim()
  }
  return row
}

function mergeById(list) {
  const m = new Map()
  for (const n of list) {
    const id = String(n.id)
    if (!m.has(id)) m.set(id, mapNotebook(n))
  }
  return [...m.values()]
}

/**
 * Notebooks from last NotebookLM sync (Google account). Empty if not signed in or not synced yet.
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export function loadNotebooks() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([NOTEBOOKLM_SYNC_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
        return
      }
      const sync = result[NOTEBOOKLM_SYNC_KEY]
      const list = Array.isArray(sync?.notebooks) ? sync.notebooks.map(mapNotebook) : []
      resolve(mergeById(list))
    })
  })
}

/**
 * Appends unique URLs to a notebook's sources (extension-side cache after successful import).
 * @returns {Promise<{ added: number, totalInNotebook: number }>}
 */
export function appendSources(notebookId, urls) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([SOURCES_KEY], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError)
        return
      }
      const bag =
        result[SOURCES_KEY] && typeof result[SOURCES_KEY] === 'object'
          ? { ...result[SOURCES_KEY] }
          : {}
      const prev = Array.isArray(bag[notebookId]) ? bag[notebookId].map(normalizeSourceEntry) : []
      const seen = new Set(prev.map((p) => p.url))
      const now = Date.now()
      let added = 0
      const next = [...prev]
      for (const url of urls) {
        if (!seen.has(url)) {
          seen.add(url)
          next.push({ url, addedAt: now })
          added++
        }
      }
      bag[notebookId] = next
      chrome.storage.local.set({ [SOURCES_KEY]: bag }, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
        else resolve({ added, totalInNotebook: next.length })
      })
    })
  })
}
