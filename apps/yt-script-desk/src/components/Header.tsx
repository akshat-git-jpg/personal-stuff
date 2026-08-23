type HeaderProps = {
  title: string
  beatCount: number
  writtenCount: number
  totalWritable: number
  tab: 'write' | 'full'
  onTabChange: (tab: 'write' | 'full') => void
  fullScriptWords?: number
}

export function Header({
  title,
  beatCount,
  writtenCount,
  totalWritable,
  tab,
  onTabChange,
  fullScriptWords = 0,
}: HeaderProps) {
  const pct = totalWritable === 0 ? 0 : Math.round((writtenCount / totalWritable) * 100)
  const readMinutes = Math.max(1, Math.round(fullScriptWords / 150))
  const subtitle =
    tab === 'full' ? `Full script · ${beatCount} beats · about ${readMinutes} min read aloud` : `Beats 1–${beatCount} · voiceover script`

  return (
    <header className="header">
      <div>
        <div className="header-title">{title}</div>
        <div className="header-subtitle">{subtitle}</div>
      </div>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'write'}
          className="tab"
          onClick={() => onTabChange('write')}
        >
          Write
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'full'}
          className="tab"
          onClick={() => onTabChange('full')}
        >
          Full script
        </button>
      </div>

      <div className="progress">
        <span>
          {writtenCount} of {totalWritable} written
        </span>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </header>
  )
}
