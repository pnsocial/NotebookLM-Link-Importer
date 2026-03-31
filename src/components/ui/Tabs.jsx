export function Tabs({ value, onChange, tabs, className = '' }) {
  return (
    <div
      className={`inline-flex flex-wrap justify-end gap-0.5 rounded-lg border border-[#E5E7EB] bg-gray-50/80 p-0.5 ${className}`}
      role="tablist"
    >
      {tabs.map((t) => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-white text-[#374151] shadow-sm border border-[#E5E7EB]'
                : 'text-gray-500 hover:text-[#374151]'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
