import { Check, CloudOff, Loader } from 'lucide-react'
import { useOverallSave } from '../hooks/useSaveStatus'
type HeaderProps = {
  title: string
  beatCount: number
  writtenCount: number
  totalWritable: number
  tab: 'write' | 'full'
  onTabChange: (tab: 'write' | 'full') => void
}

// The one place that answers "is my work safe?". Per-box footers could only
// answer it for one beat at a time, so with 15 boxes the honest answer took a
// scroll. Owner asked for a green tick at the top on 2026-08-23.
function SaveBadge() {
  const overall = useOverallSave()

  if (overall === 'failed') {
    return (
      <span className="save-badge save-badge-failed" role="status">
        <CloudOff size={14} /> Not saved
      </span>
    )
  }
  if (overall === 'pending') {
    return (
      <span className="save-badge save-badge-pending" role="status">
        <Loader size={14} /> Saving
      </span>
    )
  }
  return (
    <span className="save-badge save-badge-saved" role="status">
      <Check size={14} /> All saved
    </span>
  )
}

export function Header({ title, beatCount, writtenCount, totalWritable, tab, onTabChange }: HeaderProps) {
  const pct = totalWritable === 0 ? 0 : Math.round((writtenCount / totalWritable) * 100)
  const subtitle = tab === 'full' ? `Full script · ${beatCount} beats` : `Beats 1–${beatCount} · voiceover script`

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
        <SaveBadge />
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
