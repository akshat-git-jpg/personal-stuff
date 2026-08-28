import type { Prefs } from '../hooks/usePrefs'

type ToggleRailProps = {
  prefs: Prefs
  setPrefs: (update: Partial<Prefs>) => void
  chips?: Array<{ key: keyof Prefs; label: string }>
}

// `Instructions` is the MASTER: it shows or hides the whole right column, and
// the three after it only choose what goes inside it. They used to sit in one
// flat row, so switching the master off left them looking live while clicking
// them did nothing. The divider and the disabled state below are what say so.
const MASTER: { key: keyof Prefs; label: string } = { key: 'instructions', label: 'Instructions' }

// Every label here MUST equal the block header rendered in the right column
// (WriteView's LANES). Same words in both places — owner's rule 2026-08-23.
const CHIPS: Array<{ key: keyof Prefs; label: string }> = [
  { key: 'whatToCover', label: 'What to cover' },
  { key: 'videoNotes', label: 'Video notes' },
  { key: 'generalNotes', label: 'General notes' },
]

export const FULL_SCRIPT_CHIPS: Array<{ key: keyof Prefs; label: string }> = [{ key: 'beatLabels', label: 'Beat labels' }]

function Chip({
  prefs,
  setPrefs,
  chipKey,
  label,
  disabled = false,
  master = false,
}: {
  prefs: Prefs
  setPrefs: (update: Partial<Prefs>) => void
  chipKey: keyof Prefs
  label: string
  disabled?: boolean
  master?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={prefs[chipKey]}
      disabled={disabled}
      title={disabled ? 'Turn Instructions on to choose what it shows.' : undefined}
      className={master ? 'chip chip-master' : 'chip'}
      onClick={() => setPrefs({ [chipKey]: !prefs[chipKey] })}
    >
      <span className="chip-switch">
        <span className="chip-knob" />
      </span>
      {label}
    </button>
  )
}

export function ToggleRail({ prefs, setPrefs, chips }: ToggleRailProps) {
  // The full script view passes its own single chip and has no master.
  if (chips) {
    return (
      <div className="toggle-rail">
        <span className="toggle-rail-label">Show me</span>
        {chips.map(({ key, label }) => (
          <Chip key={key} prefs={prefs} setPrefs={setPrefs} chipKey={key} label={label} />
        ))}
      </div>
    )
  }

  const off = !prefs[MASTER.key]
  return (
    <div className="toggle-rail toggle-rail-stacked">
      <div className="toggle-row">
        <span className="toggle-rail-label">Show me</span>
        <Chip prefs={prefs} setPrefs={setPrefs} chipKey={MASTER.key} label={MASTER.label} master />
      </div>
      <div className="toggle-row toggle-row-lanes">
        {CHIPS.map(({ key, label }) => (
          <Chip key={key} prefs={prefs} setPrefs={setPrefs} chipKey={key} label={label} disabled={off} />
        ))}
      </div>
    </div>
  )
}
