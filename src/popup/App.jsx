import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AudioWaveform,
  Folder,
  Bot,
  Globe,
  Plus,
  Sparkles,
  SquarePlus,
} from 'lucide-react'
import { Button } from '../components/ui/Button.jsx'
import { Tabs } from '../components/ui/Tabs.jsx'
import { NotebookDropdown } from '../components/ui/Dropdown.jsx'
import { useActiveTabUrl, useBrowserTabs } from '../hooks/useTabs.js'
import { useLastNotebookId } from '../hooks/useStorage.js'
import { queryActiveTab, suggestedNotebookTitleFromTab } from '../lib/notebookName.js'
import { appendSources, loadNotebooks } from '../lib/notebookStorage.js'
import { isNotebooklmProjectId } from '../lib/notebooklmProjectId.js'
import {
  requestNotebooklmCreateNotebook,
  requestNotebooklmImportUrls,
  requestNotebooklmSync,
} from '../lib/syncNotebooklm.js'
import { isValidUrlLine, parseUrlLines, partitionValidUrls } from '../lib/url.js'
import { openFullPageInTab } from '../lib/fullpageUrl.js'
import { openNotebooklmSiteInNewTab } from '../lib/notebooklmSite.js'

const ICONS = [Folder, Bot, Sparkles]

function iconForIndex(i) {
  const Icon = ICONS[i % ICONS.length]
  return <Icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
}

function TabFavicon({ favIconUrl }) {
  const [failed, setFailed] = useState(false)
  if (!favIconUrl || failed) {
    return (
      <span
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-gray-100"
        aria-hidden
      >
        <Globe className="h-3 w-3 text-gray-400" />
      </span>
    )
  }
  return (
    <img
      src={favIconUrl}
      alt=""
      className="h-4 w-4 shrink-0 rounded-sm object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function toUiNotebooks(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((item, i) => {
    const id = String(item.id ?? i)
    const name = String(item.name ?? 'Notebook')
    const emoji = typeof item.emoji === 'string' && item.emoji.trim() ? item.emoji.trim() : undefined
    return {
      id,
      name,
      ...(emoji ? { emoji } : {}),
      icon: emoji ? null : iconForIndex(i),
    }
  })
}

/**
 * @param {{ variant?: 'popup' | 'tab' }} props
 */
export function App({ variant = 'popup' }) {
  const isTab = variant === 'tab'
  const { tabs, loading: tabsLoading, error: tabsError, refresh } = useBrowserTabs()
  const { url: activeTabUrl, loading: activeTabLoading } = useActiveTabUrl()
  const { notebookId: storedId, setNotebookId: persistNotebookId, ready: storageReady } =
    useLastNotebookId()

  const [notebooks, setNotebooks] = useState([])
  const [notebooksLoading, setNotebooksLoading] = useState(true)

  const [selectedNotebookId, setSelectedNotebookId] = useState(null)
  const [sourceTab, setSourceTab] = useState('links')
  const [linksText, setLinksText] = useState('')
  const [selectedTabIds, setSelectedTabIds] = useState(() => new Set())
  const [importing, setImporting] = useState(false)
  const [creatingNotebook, setCreatingNotebook] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)
  const [syncHint, setSyncHint] = useState(null)

  const currentPageImportable = useMemo(
    () => !!(activeTabUrl && isValidUrlLine(activeTabUrl)),
    [activeTabUrl],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setSyncHint(null)
      setNotebooksLoading(true)
      try {
        const cachedList = await loadNotebooks()
        if (cancelled) return
        setNotebooks(toUiNotebooks(cachedList))
        if (cachedList.length > 0) {
          setNotebooksLoading(false)
        }

        const syncRes = await requestNotebooklmSync()
        if (cancelled) return
        if (syncRes?.ok && syncRes.from === 'rpc' && syncRes.syncedAt) {
          setSyncHint(`NotebookLM synced (${new Date(syncRes.syncedAt).toLocaleString()})`)
        } else if (syncRes?.ok && syncRes.from === 'cache' && syncRes.syncedAt) {
          const extra = syncRes.hint ? ` — ${syncRes.hint}` : ''
          setSyncHint(`NotebookLM (cached ${new Date(syncRes.syncedAt).toLocaleString()})${extra}`)
        } else if (syncRes?.hint) {
          setSyncHint(syncRes.hint)
        } else if (syncRes?.ok === false && !syncRes?.hint) {
          setSyncHint('Sign in to Google and use NotebookLM in this browser to sync your list.')
        }
        const list = await loadNotebooks()
        if (cancelled) return
        setNotebooks(toUiNotebooks(list))
      } catch (e) {
        if (!cancelled) {
          setStatusMessage(e?.message ?? 'Could not load notebooks from storage.')
        }
      } finally {
        if (!cancelled) setNotebooksLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    if (!notebooks.length) {
      setSelectedNotebookId(null)
      persistNotebookId(null)
      return
    }
    const exists = notebooks.some((n) => n.id === storedId)
    if (storedId && exists) {
      setSelectedNotebookId(storedId)
    } else {
      setSelectedNotebookId(notebooks[0].id)
      persistNotebookId(notebooks[0].id)
    }
  }, [storageReady, notebooks, storedId, persistNotebookId])

  const onSelectNotebook = useCallback(
    (id) => {
      setSelectedNotebookId(id)
      persistNotebookId(id)
    },
    [persistNotebookId],
  )

  const handleCreateNotebook = useCallback(async () => {
    if (creatingNotebook) return
    setCreatingNotebook(true)
    setStatusMessage(null)
    try {
      let name = 'Untitled notebook'
      /** @type {string | null} */
      let pageUrlToImport = null
      if (!isTab) {
        const { url, title } = await queryActiveTab()
        name = suggestedNotebookTitleFromTab(url, title)
        if (url && isValidUrlLine(url)) {
          pageUrlToImport = url.trim()
        }
      }
      const titleForGoogle = name.slice(0, 100)

      const rpc = await requestNotebooklmCreateNotebook(titleForGoogle)

      if (rpc?.ok && rpc?.id) {
        let importFailed = false
        if (pageUrlToImport) {
          const importRpc = await requestNotebooklmImportUrls(rpc.id, [pageUrlToImport])
          if (importRpc.ok) {
            await appendSources(rpc.id, [pageUrlToImport])
          } else {
            importFailed = true
            setStatusMessage(
              `Notebook created. Could not add current page: ${importRpc.hint ?? importRpc.reason ?? 'unknown error'}.`,
            )
          }
        }

        await requestNotebooklmSync()
        const merged = await loadNotebooks()
        setNotebooks(toUiNotebooks(merged))
        onSelectNotebook(rpc.id)

        if (pageUrlToImport && !importFailed) {
          setStatusMessage('Notebook created and current page added to NotebookLM.')
        } else if (!pageUrlToImport) {
          setStatusMessage('Notebook created in NotebookLM.')
        }
        return
      }

      setStatusMessage(
        rpc?.hint ?? rpc?.reason ?? 'Could not create notebook in NotebookLM.',
      )
    } catch (e) {
      setStatusMessage(e?.message ?? 'Could not create notebook.')
    } finally {
      setCreatingNotebook(false)
    }
  }, [creatingNotebook, isTab, onSelectNotebook])

  const importUrls = useCallback(async (urls) => {
    if (!selectedNotebookId) {
      setStatusMessage('Choose a notebook first.')
      return
    }
    if (urls.length === 0) {
      setStatusMessage('No valid URL to import.')
      return
    }
    setImporting(true)
    setStatusMessage(null)
    try {
      if (!isNotebooklmProjectId(selectedNotebookId)) {
        setStatusMessage('Select a NotebookLM notebook from the list (sync first if empty).')
        return
      }
      const rpc = await requestNotebooklmImportUrls(selectedNotebookId, urls)
      if (!rpc.ok) {
        setStatusMessage(rpc.hint ?? rpc.reason ?? 'Could not import to NotebookLM.')
        return
      }
      const { added } = await appendSources(selectedNotebookId, urls)
      setStatusMessage(
        added === 0
          ? 'Nothing new to import (URLs were already added).'
          : `Imported to NotebookLM: ${added} URL(s).`,
      )
    } catch (e) {
      setStatusMessage(e?.message ?? 'Could not save sources.')
    } finally {
      setImporting(false)
    }
  }, [selectedNotebookId])

  const toggleTabId = useCallback((tabId) => {
    setSelectedTabIds((prev) => {
      const next = new Set(prev)
      if (next.has(tabId)) next.delete(tabId)
      else next.add(tabId)
      return next
    })
  }, [])

  const selectAllTabs = useCallback(() => {
    setSelectedTabIds(new Set(tabs.map((t) => t.id)))
  }, [tabs])

  const clearTabSelection = useCallback(() => {
    setSelectedTabIds(new Set())
  }, [])

  const linksLines = useMemo(() => parseUrlLines(linksText), [linksText])
  const { valid: validLinks, invalid: invalidLinks } = useMemo(
    () => partitionValidUrls(linksLines),
    [linksLines],
  )

  const urlsToImport = useMemo(() => {
    if (sourceTab === 'links') {
      return validLinks
    }
    const set = new Set()
    for (const tab of tabs) {
      if (selectedTabIds.has(tab.id) && tab.url) set.add(tab.url)
    }
    return [...set]
  }, [sourceTab, validLinks, tabs, selectedTabIds])

  const handleImport = useCallback(async () => {
    if (!selectedNotebookId) {
      setStatusMessage('Choose a notebook first.')
      return
    }
    if (urlsToImport.length === 0) {
      setStatusMessage(
        sourceTab === 'links'
          ? 'Add at least one valid URL (http/https).'
          : 'Select at least one tab.',
      )
      return
    }
    await importUrls(urlsToImport)
  }, [selectedNotebookId, urlsToImport, sourceTab, importUrls])

  const handleAddCurrentTabToNotebook = useCallback(() => {
    if (!activeTabUrl) {
      setStatusMessage('This page cannot be imported (restricted or internal URL).')
      return
    }
    if (!isValidUrlLine(activeTabUrl)) {
      setStatusMessage('Current tab URL is not a valid http(s) address to import.')
      return
    }
    importUrls([activeTabUrl.trim()])
  }, [activeTabUrl, importUrls])

  const handleCancel = useCallback(() => {
    window.close()
  }, [])

  if (!isTab) {
    return (
      <div className="flex w-[380px] flex-col bg-white p-4 text-[#374151]">
        <header className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-base font-semibold tracking-tight text-gray-900">
            Import to NotebookLM
          </h1>
          <button
            type="button"
            onClick={() => openNotebooklmSiteInNewTab()}
            className="shrink-0 rounded-md p-1 text-gray-900 transition-colors hover:bg-gray-100"
            title="Open NotebookLM"
            aria-label="Open NotebookLM in a new tab"
          >
            <AudioWaveform className="h-5 w-5 shrink-0" aria-hidden />
          </button>
        </header>

        <div className="mb-3 min-w-0">
          {notebooksLoading ? (
            <p className="rounded-xl border border-[#E5E7EB] px-3 py-2.5 text-xs text-gray-500">
              Loading notebooks…
            </p>
          ) : (
            <NotebookDropdown
              notebooks={notebooks}
              value={selectedNotebookId}
              onChange={onSelectNotebook}
              emptyLabel="No notebooks"
            />
          )}
        </div>

        {syncHint && (
          <p className="mb-3 text-[11px] leading-snug text-gray-500">{syncHint}</p>
        )}

        <Button
          type="button"
          variant="primary"
          className="mb-2 w-full rounded-xl py-2.5 text-sm font-semibold"
          disabled={importing || activeTabLoading || !currentPageImportable || !selectedNotebookId}
          onClick={handleAddCurrentTabToNotebook}
        >
          {importing ? 'Adding…' : 'Add to Notebook'}
        </Button>

        {activeTabLoading ? (
          <p className="mb-2 text-center text-[11px] text-gray-500">Reading current tab…</p>
        ) : !currentPageImportable ? (
          <p className="mb-2 text-center text-[11px] text-amber-800">
            Open an http(s) page to import it.
          </p>
        ) : null}

        <Button
          type="button"
          variant="muted"
          className="mb-8 w-full gap-1.5 rounded-xl py-2.5 text-sm font-medium"
          disabled={creatingNotebook || notebooksLoading}
          onClick={handleCreateNotebook}
          title="Create a NotebookLM notebook using this page’s title and add this page’s URL as a source"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {creatingNotebook ? 'Creating…' : 'Create New Notebook'}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 rounded-xl py-2.5 text-sm font-medium"
          onClick={() => openFullPageInTab()}
        >
          <SquarePlus className="h-4 w-4 shrink-0" aria-hidden />
          Bulk Import
        </Button>

        {statusMessage && (
          <p className="mt-3 text-center text-[11px] leading-snug text-gray-600">{statusMessage}</p>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl bg-white px-6 py-8 text-[#374151] shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-2 border-b border-[#E5E7EB] pb-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-gray-700" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900">
              NotebookLM Link Importer
            </h1>
            <p className="text-xs text-gray-500">
              Bulk import — links or browser tabs
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openNotebooklmSiteInNewTab()}
          className="shrink-0 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          title="Open NotebookLM"
          aria-label="Open NotebookLM in a new tab"
        >
          <AudioWaveform className="h-5 w-5" aria-hidden />
        </button>
      </header>

      <section className="mb-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">1. Choose notebook</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            {notebooksLoading ? (
              <p className="rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-xs text-gray-500">
                Loading notebooks…
              </p>
            ) : (
              <NotebookDropdown
                notebooks={notebooks}
                value={selectedNotebookId}
                onChange={onSelectNotebook}
                emptyLabel="No notebooks"
              />
            )}
          </div>
          <span className="shrink-0 text-xs font-medium text-gray-400">or</span>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-1 px-2.5 text-xs"
            disabled={creatingNotebook || notebooksLoading}
            onClick={handleCreateNotebook}
            title="Create a notebook in NotebookLM (popup uses the active tab title)"
          >
            <Plus className="h-3.5 w-3.5" />
            {creatingNotebook ? 'Creating…' : 'Create new Notebook'}
          </Button>
        </div>
        {syncHint && (
          <p className="mt-1.5 text-[11px] leading-snug text-gray-500">{syncHint}</p>
        )}
      </section>

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">2. Add sources</span>
          <Tabs
            value={sourceTab}
            onChange={setSourceTab}
            tabs={[
              { id: 'links', label: 'Links' },
              { id: 'tabs', label: 'Browser Tabs' },
            ]}
          />
        </div>

        {sourceTab === 'links' && (
          <div>
            <textarea
              value={linksText}
              onChange={(e) => setLinksText(e.target.value)}
              placeholder={`Paste one URL per line\nhttps://example.com/article\nhttps://example.org/guide\nhttps://news.example.org/story`}
              rows={14}
              className="w-full resize-none rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-3 py-2.5 text-xs leading-relaxed text-[#374151] placeholder:text-gray-400 focus:border-[#E5E7EB] focus:bg-white focus:outline-none focus:ring-1 focus:ring-gray-200"
            />
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
              <span>{validLinks.length} valid</span>
              {invalidLinks.length > 0 && (
                <span className="text-amber-700">{invalidLinks.length} invalid line(s)</span>
              )}
            </div>
          </div>
        )}

        {sourceTab === 'tabs' && (
          <div className="rounded-lg border border-[#E5E7EB] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-2 py-1.5">
              <button
                type="button"
                onClick={selectAllTabs}
                className="text-[11px] font-medium text-gray-600 hover:text-gray-900"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearTabSelection}
                className="text-[11px] font-medium text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={refresh}
                className="text-[11px] font-medium text-gray-600 hover:text-gray-900"
              >
                Refresh
              </button>
            </div>
            <div className="max-h-96 overflow-auto">
              {tabsLoading && (
                <p className="px-3 py-4 text-xs text-gray-500">Loading tabs…</p>
              )}
              {tabsError && (
                <p className="px-3 py-4 text-xs text-red-600">{tabsError}</p>
              )}
              {!tabsLoading && !tabsError && tabs.length === 0 && (
                <p className="px-3 py-4 text-xs text-gray-500">No tabs in this window.</p>
              )}
              {!tabsLoading &&
                !tabsError &&
                tabs.map((tab) => (
                  <label
                    key={tab.id}
                    className="flex cursor-pointer items-start gap-2 border-b border-[#F3F4F6] px-3 py-2 last:border-0 hover:bg-gray-50/80"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[#E5E7EB] text-gray-900 focus:ring-gray-300"
                      checked={selectedTabIds.has(tab.id)}
                      onChange={() => toggleTabId(tab.id)}
                    />
                    <TabFavicon
                      key={`${tab.id}-${tab.favIconUrl ?? ''}`}
                      favIconUrl={tab.favIconUrl}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-xs font-medium text-[#374151]">
                        {tab.title || tab.url}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-gray-500">
                        {tab.url}
                      </span>
                    </span>
                  </label>
                ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <span className="mb-2 block text-xs font-medium text-gray-600">3. Actions</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="primary"
            className="flex-1"
            disabled={importing || urlsToImport.length === 0}
            onClick={handleImport}
          >
            {importing
              ? 'Importing…'
              : urlsToImport.length > 0
                ? `Import (${urlsToImport.length})`
                : 'Import'}
          </Button>
          <Button type="button" variant="secondary" className="flex-1" onClick={handleCancel}>
            Close
          </Button>
        </div>
        {statusMessage && (
          <p className="mt-2 text-center text-[11px] text-gray-600">{statusMessage}</p>
        )}
      </section>
    </div>
  )
}
