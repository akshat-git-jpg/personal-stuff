/**
 * SortSheet — the ordering control.
 *
 * A pill showing the CURRENT ordering, which opens a bottom sheet of options
 * with a tick on the active one. That is the pattern shopping and listing apps
 * use, and it beats a bare <select> here for two reasons: the current sort
 * stays readable on the pill, and an unstyled select renders white-on-dark,
 * which is this repo's recurring UI defect (LESSONS 2026-07-31).
 */
export function SortPill<T extends string>({
  value,
  options,
  onOpen,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onOpen: () => void
}) {
  const current = options.find((o) => o.value === value)?.label ?? ''
  return (
    <button
      type="button"
      className="chip shrink-0 whitespace-nowrap"
      onClick={onOpen}
      aria-label={`Sort by ${current}. Change sorting.`}
    >
      <span aria-hidden="true" style={{ color: 'var(--muted)' }}>
        ⇅{' '}
      </span>
      {current}
    </button>
  )
}

export function SortSheet<T extends string>({
  value,
  options,
  onPick,
  onClose,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onPick: (value: T) => void
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        style={{ background: 'var(--surface)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sort by"
      >
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-base font-semibold">Sort by</h2>
        </div>

        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              className="flex w-full items-center justify-between px-4 py-3.5 text-left text-sm"
              style={{
                borderTop: '1px solid var(--border)',
                color: active ? 'var(--accent)' : 'var(--text)',
                background: 'transparent',
              }}
              onClick={() => onPick(o.value)}
              aria-current={active}
            >
              {o.label}
              {/* A tick, not a radio dot — it reads at a glance on a small screen. */}
              <span aria-hidden="true">{active ? '✓' : ''}</span>
            </button>
          )
        })}

        <div className="p-4">
          <button type="button" className="btn-ghost w-full" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
