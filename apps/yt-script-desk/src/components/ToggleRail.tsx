import type { Prefs } from '../hooks/usePrefs'

type ToggleRailProps = {
  prefs: Prefs
  setPrefs: (update: Partial<Prefs>) => void
  chips?: Array<{ key: keyof Prefs; label: string }>
}

const CHIPS: Array<{ key: keyof Prefs; label: string }> = [
  { key: 'notesTrack', label: 'Notes track' },
  { key: 'showRecording', label: 'Recording notes' },
  { key: 'showFacts', label: 'Facts' },
  { key: 'showEdit', label: 'Edit notes' },
]

export const FULL_SCRIPT_CHIPS: Array<{ key: keyof Prefs; label: string }> = [{ key: 'beatLabels', label: 'Beat labels' }]

export function ToggleRail({ prefs, setPrefs, chips = CHIPS }: ToggleRailProps) {
  return (
    <div className="toggle-rail">
      <span className="toggle-rail-label">Show me</span>
      {chips.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="switch"
          aria-checked={prefs[key]}
          className="chip"
          onClick={() => setPrefs({ [key]: !prefs[key] })}
        >
          <span className="chip-switch">
            <span className="chip-knob" />
          </span>
          {label}
        </button>
      ))}
    </div>
  )
}
