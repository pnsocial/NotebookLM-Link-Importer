import { useState, useEffect, useCallback } from 'react'

const LAST_NOTEBOOK_KEY = 'urc:lastNotebookId'

export function useLastNotebookId() {
  const [notebookId, setNotebookIdState] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    chrome.storage.local.get([LAST_NOTEBOOK_KEY], (result) => {
      setNotebookIdState(result[LAST_NOTEBOOK_KEY] ?? null)
      setReady(true)
    })
  }, [])

  const setNotebookId = useCallback((id) => {
    setNotebookIdState(id)
    if (id == null) {
      chrome.storage.local.remove(LAST_NOTEBOOK_KEY)
    } else {
      chrome.storage.local.set({ [LAST_NOTEBOOK_KEY]: id })
    }
  }, [])

  return { notebookId, setNotebookId, ready }
}
