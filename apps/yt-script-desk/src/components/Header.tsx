import { BadgeCheck, Check, CloudOff, Eye, Loader, Pencil } from 'lucide-react'
import type { Approval } from '../types'
import { useOverallSave } from '../hooks/useSaveStatus'
type HeaderProps = {
  title: string
  beatCount: number
  writtenCount: number
  totalWritable: number
  tab: 'write' | 'full'
  onTabChange: (tab: 'write' | 'full') => void
  // Edit mode is LOCAL ONLY. On the hosted link these are undefined and no
  // button renders - the freelancer must never be able to rewrite the plan he
  // was sent, and the hosted Worker has no file to write anyway.
  editing?: boolean
  onToggleEdit?: () => void
  // Approval is LOCAL ONLY, on exactly the same terms as edit mode: undefined here on
  // the hosted link, so no button renders and the freelancer cannot sign off his own
  // brief. The real control is that the hosted Worker has no /api/approve route at all
  // — this only keeps the UI honest.
  approval?: Approval
  onApprove?: () => void
  onUnapprove?: () => void
  approveBusy?: boolean
}

// The publish gate in `bin/desk.mjs` reads exactly this state, so the wording here and
// the refusal there have to agree: approved means "this text, signed off", and any edit
// afterwards drops it back to unapproved rather than leaving a stale yes standing.
function ApproveButton({
  approval,
  onApprove,
  onUnapprove,
  busy,
}: {
  approval?: Approval
  onApprove?: () => void
  onUnapprove?: () => void
  busy?: boolean
}) {
  if (!onApprove) return null
  const state = approval?.state ?? 'none'

  if (state === 'ok') {
    const at = approval && 'at' in approval && approval.at ? new Date(approval.at) : null
    return (
      <button
        type="button"
        className="approve-toggle approve-toggle-on"
        aria-pressed={true}
        disabled={busy}
        onClick={onUnapprove}
        title={at ? `Approved ${at.toLocaleString()} — click to withdraw` : 'Click to withdraw'}
      >
        <BadgeCheck size={14} /> Approved
      </button>
    )
  }

  return (
    <button
      type="button"
      className={state === 'stale' ? 'approve-toggle approve-toggle-stale' : 'approve-toggle'}
      aria-pressed={false}
      disabled={busy}
      onClick={onApprove}
      title={
        state === 'stale'
          ? 'The plan changed after you approved it. Re-read it and approve again.'
          : 'Sign this plan off so it can be published'
      }
    >
      <BadgeCheck size={14} /> {state === 'stale' ? 'Re-approve' : 'Approve'}
    </button>
  )
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

export function Header({
  title,
  beatCount,
  writtenCount,
  totalWritable,
  tab,
  onTabChange,
  editing,
  onToggleEdit,
  approval,
  onApprove,
  onUnapprove,
  approveBusy,
}: HeaderProps) {
  const pct = totalWritable === 0 ? 0 : Math.round((writtenCount / totalWritable) * 100)
  const subtitle = editing
    ? 'Editing script-plan.md'
    : tab === 'full'
      ? `Full script · ${beatCount} beats`
      : `Beats 1–${beatCount} · voiceover script`

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
        {onToggleEdit && (
          <button
            type="button"
            className={editing ? 'edit-toggle edit-toggle-on' : 'edit-toggle'}
            aria-pressed={editing}
            onClick={onToggleEdit}
          >
            {editing ? <Eye size={14} /> : <Pencil size={14} />}
            {editing ? 'Done' : 'Edit'}
          </button>
        )}
        <ApproveButton
          approval={approval}
          onApprove={onApprove}
          onUnapprove={onUnapprove}
          busy={approveBusy}
        />
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
