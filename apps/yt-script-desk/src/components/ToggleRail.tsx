import type { Prefs } from '../hooks/usePrefs'

type ToggleRailProps = {
  prefs: Prefs
  setPrefs: (update: Partial<Prefs>) => void
}

const CHIPS: Array<{ key: keyof Prefs; label: string }> = [
  { key: 'notesTrack', label: 'Notes track' },
  { key: 'showRecording', label: 'Recording notes' },
  { key: 'showFacts', label: 'Facts' },
  { key: 'showEdit', label: 'Edit notes' },
]

export function ToggleRail({ prefs, setPrefs }: ToggleRailProps) {
  return (
    <div className="toggle-rail">
      <span className="toggle-rail-label">Show me</span>
      {CHIPS.map(({ key, label }) => (
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
