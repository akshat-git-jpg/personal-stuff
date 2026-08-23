import { useEffect, useState } from 'react'
import { getVideo, putDraft, putSay, restoreSay } from './api'
import type { VideoDoc } from './types'
import { usePrefs } from './hooks/usePrefs'
import { Header } from './components/Header'
import { ToggleRail } from './components/ToggleRail'
import { WriteView } from './components/WriteView'

function getKeyFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('key') ?? ''
}

export function App() {
  const { prefs, setPrefs } = usePrefs()
  const [doc, setDoc] = useState<VideoDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'write' | 'full'>('write')
  const key = getKeyFromUrl()

  useEffect(() => {
    if (!key) return
    getVideo(key)
      .then(setDoc)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [key])

  if (!key) {
    return (
      <div className="app">
        <p style={{ padding: '20px 40px' }}>no ?key= in the URL</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="app">
        <p style={{ padding: '20px 40px' }}>{error}</p>
      </div>
    )
  }
  if (!doc) {
    return (
      <div className="app">
        <p style={{ padding: '20px 40px' }}>Loading…</p>
      </div>
    )
  }

  const writableBeats = doc.beats.filter((b) => b.mode === 'write')
  const writtenCount = writableBeats.filter((b) => (doc.draft[b.num] ?? '').trim().length > 0).length

  const handleDraftSave = async (num: string, text: string) => {
    await putDraft(key, num, text)
    setDoc((prev) => (prev ? { ...prev, draft: { ...prev.draft, [num]: text } } : prev))
  }

  const handleSaySave = async (num: string, lines: string[]) => {
    await putSay(key, num, lines)
    setDoc((prev) => {
      if (!prev) return prev
      const beat = prev.beats.find((b) => b.num === num)
      const original = prev.edits[num]?.original ?? beat?.say ?? []
      return {
        ...prev,
        says: { ...prev.says, [num]: lines },
        edits: { ...prev.edits, [num]: prev.edits[num] ?? { original, at: new Date().toISOString() } },
      }
    })
  }

  const handleSayRestore = async (num: string) => {
    const { lines } = await restoreSay(key, num)
    setDoc((prev) => {
      if (!prev) return prev
      const nextSays = { ...prev.says }
      delete nextSays[num]
      const nextEdits = { ...prev.edits }
      delete nextEdits[num]
      return {
        ...prev,
        says: nextSays,
        edits: nextEdits,
        beats: prev.beats.map((b) => (b.num === num ? { ...b, say: lines } : b)),
      }
    })
  }

  return (
    <div className="app">
      <Header
        title={doc.title}
        beatCount={doc.beats.length}
        writtenCount={writtenCount}
        totalWritable={writableBeats.length}
        tab={tab}
        onTabChange={setTab}
      />
      <ToggleRail prefs={prefs} setPrefs={setPrefs} />
      {tab === 'write' ? (
        <WriteView
          beats={doc.beats}
          prefs={prefs}
          draft={doc.draft}
          edits={doc.edits}
          says={doc.says}
          onDraftSave={handleDraftSave}
          onSaySave={handleSaySave}
          onSayRestore={handleSayRestore}
        />
      ) : (
        <p style={{ padding: '20px 40px' }}>Full script view — coming in plan 233.</p>
      )}
    </div>
  )
}
