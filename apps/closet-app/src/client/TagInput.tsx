import { useState } from 'react'
import type { Tag } from './types'

/** Mirrors the Worker's `normaliseTag` exactly, so the chip shown matches the row stored. */
function normalise(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * TagInput — chips plus autocomplete over the shared vocabulary.
 * Purely local: the parent form holds the tag list and posts it on Save.
 */
export default function TagInput({
  tags,
  allTags,
  onChange,
}: {
  tags: string[]
  allTags: Tag[]
  onChange: (tags: string[]) => void
}) {
  const [typed, setTyped] = useState('')

  function addTag(raw: string) {
    const name = normalise(raw)
    if (!name || tags.includes(name)) return
    onChange([...tags, name])
    setTyped('')
  }

  function removeTag(name: string) {
    onChange(tags.filter((t) => t !== name))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(typed)
    }
  }

  const normalisedTyped = normalise(typed)
  const suggestions = allTags
    .map((t) => t.name)
    .filter((name) => normalisedTyped.length > 0 && name.includes(normalisedTyped) && !tags.includes(name))
    .slice(0, 6)

  return (
    <div>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {tags.map((name) => (
            <span key={name} className="chip inline-flex items-center gap-1.5">
              {name}
              <button type="button" className="text-xs" onClick={() => removeTag(name)} aria-label={`Remove tag ${name}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text" className="field"
        placeholder="Add a tag, then Enter"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={onKeyDown}
      />

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((name) => (
            <button key={name} type="button" className="chip" onClick={() => addTag(name)}>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
