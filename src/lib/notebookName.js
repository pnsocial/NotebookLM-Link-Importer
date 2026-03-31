const MAX_NOTEBOOK_NAME = 120

function isInternalBrowserUrl(url) {
  if (!url || typeof url !== 'string') return true
  const u = url.toLowerCase()
  return (
    u.startsWith('chrome://') ||
    u.startsWith('chrome-extension://') ||
    u.startsWith('edge://') ||
    u.startsWith('about:') ||
    u.startsWith('devtools:') ||
    u.startsWith('view-source:') ||
    u.startsWith('moz-extension://')
  )
}

/** Strip site suffix (e.g. "Title | Site") and cap length for storage/UI. */
export function normalizePageTitle(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw.replace(/\s+/g, ' ').trim()
  const pipe = s.indexOf('|')
  if (pipe > 0) s = s.slice(0, pipe).trim()
  if (s.length > MAX_NOTEBOOK_NAME) {
    s = `${s.slice(0, MAX_NOTEBOOK_NAME - 1).trim()}…`
  }
  return s
}

/**
 * Suggested title for a new NotebookLM notebook from the active tab (popup: user’s web page).
 * Full-page UI uses "Untitled notebook" — active tab is usually this extension.
 * @param {string | null} pageUrl
 * @param {string | null} pageTitle
 */
export function suggestedNotebookTitleFromTab(pageUrl, pageTitle) {
  if (isInternalBrowserUrl(pageUrl)) {
    return 'Untitled notebook'
  }
  const fromTitle = normalizePageTitle(pageTitle ?? '')
  if (fromTitle) return fromTitle
  try {
    const u = new URL(pageUrl)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const h = u.hostname.replace(/^www\./, '')
      if (h) return h
    }
  } catch {
    /* ignore */
  }
  return 'Untitled notebook'
}

export function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (result) => {
      if (chrome.runtime.lastError) {
        resolve({ url: null, title: null })
        return
      }
      const tab = result[0]
      resolve({ url: tab?.url ?? null, title: tab?.title ?? null })
    })
  })
}
