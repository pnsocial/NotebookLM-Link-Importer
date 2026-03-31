import { useState, useEffect, useCallback } from 'react'

function isSystemOrInternalUrl(url) {
  if (!url) return true
  const u = url.toLowerCase()
  return (
    u.startsWith('chrome://') ||
    u.startsWith('chrome-extension://') ||
    u.startsWith('edge://') ||
    u.startsWith('about:') ||
    u.startsWith('devtools:') ||
    u.startsWith('view-source:')
  )
}

export function useBrowserTabs() {
  const [tabs, setTabs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    chrome.tabs.query({ currentWindow: true }, (result) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message)
        setTabs([])
        setLoading(false)
        return
      }
      const filtered = result.filter((tab) => tab.url && !isSystemOrInternalUrl(tab.url))
      setTabs(filtered)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { tabs, loading, error, refresh }
}

/**
 * Active tab in the current window (for popup “import this page”).
 */
export function useActiveTabUrl() {
  const [state, setState] = useState({ url: null, title: null, loading: true })

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    chrome.tabs.query({ active: true, currentWindow: true }, (result) => {
      if (chrome.runtime.lastError) {
        setState({ url: null, title: null, loading: false })
        return
      }
      const tab = result[0]
      const url = tab?.url
      if (!url || isSystemOrInternalUrl(url)) {
        setState({ url: null, title: tab?.title ?? null, loading: false })
        return
      }
      setState({ url, title: tab?.title ?? null, loading: false })
    })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...state, refresh }
}
