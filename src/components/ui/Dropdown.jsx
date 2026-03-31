import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { notebookListTitle } from '../../lib/notebookDisplay.js'
import { Input } from './Input.jsx'

export function NotebookDropdown({
  notebooks,
  value,
  onChange,
  searchPlaceholder = 'Search notebooks…',
  emptyLabel = 'No notebooks',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  const selected = useMemo(
    () => notebooks.find((n) => n.id === value) ?? null,
    [notebooks, value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notebooks
    return notebooks.filter((n) => {
      const label = notebookListTitle(n.name, n.emoji)
      const hay = `${label} ${n.name} ${n.emoji ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [notebooks, query])

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  return (
    <div className="relative w-full" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-left text-sm text-[#374151] hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-200"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selected?.emoji ? (
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none"
              aria-hidden
            >
              {selected.emoji}
            </span>
          ) : (
            selected?.icon
          )}
          <span className="truncate font-medium">
            {selected
              ? notebookListTitle(selected.name, selected.emoji)
              : emptyLabel}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-lg"
          role="listbox"
        >
          <div className="border-b border-[#E5E7EB] p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="border-0 bg-gray-50 pl-9 ring-0 focus:ring-0"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-48 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-500">No matches</li>
            ) : (
              filtered.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === n.id}
                    onClick={() => {
                      onChange(n.id)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                      value === n.id ? 'bg-gray-50 font-medium' : ''
                    }`}
                  >
                    {n.emoji ? (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none"
                        aria-hidden
                      >
                        {n.emoji}
                      </span>
                    ) : (
                      n.icon
                    )}
                    <span className="truncate text-[#374151]">
                      {notebookListTitle(n.name, n.emoji)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
