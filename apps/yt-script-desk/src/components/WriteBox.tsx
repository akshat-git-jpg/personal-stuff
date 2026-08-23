import { useEffect, useRef, useState } from 'react'

type SaveState = 'saved' | 'saving' | 'retrying'

type WriteBoxProps = {
  value: string
  onSave: (text: string) => Promise<void> | void
}

const DEBOUNCE_MS = 600
const RETRY_MS = 5000

// No word target, no word limit — owner decision. Just a plain count.
export function WriteBox({ value, onSave }: WriteBoxProps) {
  const [text, setText] = useState(value)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setText(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
    }
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
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (retryRef.current) clearTimeout(retryRef.current)
    debounceRef.current = setTimeout(() => doSave(next), DEBOUNCE_MS)
  }

  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length

  const footerText = saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Not saved — retrying'

  return (
    <div className="write-box">
      <textarea
        className="write-box-textarea"
        value={text}
        placeholder="Write what you saw…"
        onChange={(e) => handleChange(e.target.value)}
      />
      <div className="write-box-footer">
        <span>{wordCount} words</span>
        <span>{footerText}</span>
      </div>
    </div>
  )
}
