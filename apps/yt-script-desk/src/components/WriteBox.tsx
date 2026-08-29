import { useEffect, useId, useRef, useState } from 'react'
import { useSaveReporter } from '../hooks/useSaveStatus'
import { useAutoGrow } from '../hooks/useAutoGrow'
import type { SaveState } from '../hooks/useSaveStatus'

type WriteBoxProps = {
  value: string
  onSave: (text: string) => Promise<void> | void
}

const DEBOUNCE_MS = 600
const RETRY_MS = 5000

// No word target, no word limit, and no count either — owner decision
// 2026-08-23: a length number on screen is pressure, and he does not want one
// anywhere in the desk. The footer says only whether the text is saved.
export function WriteBox({ value, onSave }: WriteBoxProps) {
  const [text, setText] = useState(value)
  const [prevValue, setPrevValue] = useState(value)
  const [saveState, setSaveStateRaw] = useState<SaveState>('saved')
  const id = useId()
  const report = useSaveReporter()

  // Every state change is announced upward, so the header badge can speak for
  // the whole page instead of the reader hunting through 15 little footers.
  const setSaveState = (next: SaveState) => {
    setSaveStateRaw(next)
    report(id, next)
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  // A prop change (a fresh load, not the user's own keystroke) resets the
  // local draft — done during render, not an effect, so it can't cascade.
  if (value !== prevValue) {
    setPrevValue(value)
    setText(value)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
      report(id, 'saved')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const doSave = (t: string) => {
    setSaveState('saving')
    Promise.resolve(onSave(t))
      .then(() => setSaveState('saved'))
      .catch(() => {
        setSaveState('retrying')
        retryRef.current = setTimeout(() => doSave(t), RETRY_MS)
      })
  }

  const handleChange = (next: string) => {
    setText(next)
    // Unsaved the instant a key is pressed. Waiting for the debounce to fire
    // meant the box claimed 'Saved' while the text was still only local.
    setSaveState('dirty')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (retryRef.current) clearTimeout(retryRef.current)
    debounceRef.current = setTimeout(() => doSave(next), DEBOUNCE_MS)
  }

  // Grows with what he types, so a long section never becomes a peephole. Same
  // reason as the spoken card and the notes block — see useAutoGrow.
  useAutoGrow(areaRef, text)

  const footerText = saveState === 'saved' ? 'Saved' : saveState === 'retrying' ? 'Not saved — retrying' : 'Saving…'

  return (
    <div className="write-box">
      <textarea
        ref={areaRef}
        className="write-box-textarea"
        value={text}
        placeholder="Write what you saw…"
        onChange={(e) => handleChange(e.target.value)}
      />
      <div className="write-box-footer">
        <span>{footerText}</span>
      </div>
    </div>
  )
}
