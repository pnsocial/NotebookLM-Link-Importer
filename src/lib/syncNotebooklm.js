/**
 * Asks the background worker to refresh NotebookLM data (RPC, else last cache).
 */
export function requestNotebooklmSync() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'REQUEST_NOTEBOOKLM_SYNC' }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          error: chrome.runtime.lastError.message,
          notebooks: [],
        })
        return
      }
      resolve(res ?? { ok: false, notebooks: [] })
    })
  })
}

/**
 * Import URLs into a synced NotebookLM project (batchexecute izAoDd). Runs in the background worker.
 * @param {string} notebookProjectId
 * @param {string[]} urls
 * @returns {Promise<{ ok: true } | { ok: false, reason?: string, hint?: string }>}
 */
/**
 * Create a notebook on NotebookLM (batchexecute CCqFvf). Runs in the background worker.
 * @param {string} title
 * @returns {Promise<{ ok: true, id: string, name: string } | { ok: false, reason?: string, hint?: string }>}
 */
export function requestNotebooklmCreateNotebook(title) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'REQUEST_NOTEBOOKLM_CREATE_NOTEBOOK', title }, (res) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          reason: 'message',
          hint: chrome.runtime.lastError.message,
        })
        return
      }
      resolve(res ?? { ok: false, reason: 'empty' })
    })
  })
}

export function requestNotebooklmImportUrls(notebookProjectId, urls) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'REQUEST_NOTEBOOKLM_IMPORT_URLS', notebookProjectId, urls },
      (res) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            reason: 'message',
            hint: chrome.runtime.lastError.message,
          })
          return
        }
        resolve(res ?? { ok: false, reason: 'empty' })
      },
    )
  })
}
