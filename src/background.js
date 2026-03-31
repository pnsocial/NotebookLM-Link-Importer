import {
  createNotebookOnNotebooklm,
  importUrlsToNotebooklmProject,
  listNotebooksFromNotebooklm,
} from './lib/notebooklmRpc.js'

const SYNC_STORAGE_KEY = 'urc:notebooklm_sync'

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'REQUEST_NOTEBOOKLM_SYNC') {
    ;(async () => {
      try {
        const rpcResult = await listNotebooksFromNotebooklm()

        if (rpcResult.ok) {
          const payload = {
            notebooks: rpcResult.notebooks.map((n) => {
              const row = { id: String(n.id), name: String(n.name) }
              if (typeof n.emoji === 'string' && n.emoji.trim()) row.emoji = n.emoji.trim()
              return row
            }),
            syncedAt: Date.now(),
            source: 'rpc',
          }
          await chrome.storage.local.set({ [SYNC_STORAGE_KEY]: payload })
          sendResponse({
            ok: true,
            notebooks: payload.notebooks,
            from: 'rpc',
            syncedAt: payload.syncedAt,
          })
          return
        }

        const stored = await chrome.storage.local.get([SYNC_STORAGE_KEY])
        const sync = stored[SYNC_STORAGE_KEY]
        if (sync?.notebooks?.length) {
          sendResponse({
            ok: true,
            notebooks: sync.notebooks,
            from: 'cache',
            syncedAt: sync.syncedAt,
            hint: rpcResult.hint,
          })
          return
        }

        sendResponse({
          ok: false,
          notebooks: [],
          from: 'none',
          hint: rpcResult.hint ?? 'Could not sync NotebookLM.',
        })
      } catch (e) {
        sendResponse({ ok: false, error: String(e?.message ?? e), notebooks: [] })
      }
    })()
    return true
  }

  if (msg?.type === 'REQUEST_NOTEBOOKLM_CREATE_NOTEBOOK') {
    const title = typeof msg?.title === 'string' ? msg.title : ''
    ;(async () => {
      try {
        const result = await createNotebookOnNotebooklm(title.trim() || 'Untitled notebook')
        sendResponse(result)
      } catch (e) {
        sendResponse({
          ok: false,
          reason: 'error',
          hint: String(e?.message ?? e),
        })
      }
    })()
    return true
  }

  if (msg?.type === 'REQUEST_NOTEBOOKLM_IMPORT_URLS') {
    const projectId = msg?.notebookProjectId
    const urls = Array.isArray(msg?.urls) ? msg.urls : []
    ;(async () => {
      try {
        const result = await importUrlsToNotebooklmProject(projectId, urls)
        sendResponse(result)
      } catch (e) {
        sendResponse({
          ok: false,
          reason: 'error',
          hint: String(e?.message ?? e),
        })
      }
    })()
    return true
  }

  return false
})
