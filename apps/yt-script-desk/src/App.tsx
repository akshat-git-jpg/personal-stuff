import { useCallback, useEffect, useState } from 'react'
import { getVideo, postFinish, putDraft, putSay, restoreSay } from './api'
import type { VideoDoc } from './types'
import { usePrefs } from './hooks/usePrefs'
import { Header } from './components/Header'
import { ToggleRail, FULL_SCRIPT_CHIPS } from './components/ToggleRail'
import { WriteView } from './components/WriteView'
import { FullScript, fullScriptStats } from './components/FullScript'

function getKeyFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('key') ?? ''
}

function isFinishedError(err: unknown): boolean {
  return err instanceof Error && /-> 409/.test(err.message)
}

export function App() {
  const { prefs, setPrefs } = usePrefs()
  const [doc, setDoc] = useState<VideoDoc | null>(null)
  const [loadError, setLoadError] = useState<'notfound' | 'network' | null>(null)
  const [saveBlocked, setSaveBlocked] = useState(false)
  const [tab, setTab] = useState<'write' | 'full'>('write')
  const key = getKeyFromUrl()

  const fetchDoc = useCallback(() => {
    getVideo(key)
      .then((d) => {
        setDoc(d)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        setLoadError(/-> 404/.test(msg) ? 'notfound' : 'network')
      })
  }, [key])

  useEffect(() => {
    if (!key) return
    fetchDoc()
  }, [key, fetchDoc])

  if (!key) {
    return (
      <div className="app">
        <p style={{ padding: '20px 40px' }}>no ?key= in the URL</p>
      </div>
    )
  }

  const writableBeats = doc ? doc.beats.filter((b) => b.mode === 'write') : []
  const writtenCount = doc ? writableBeats.filter((b) => (doc.draft[b.num] ?? '').trim().length > 0).length : 0
  const fullScriptWords = doc ? fullScriptStats(doc).totalWords : 0

  const handleDraftSave = async (num: string, text: string) => {
    try {
      await putDraft(key, num, text)
    } catch (err) {
      if (isFinishedError(err)) return setSaveBlocked(true)
      throw err
    }
    setDoc((prev) => (prev ? { ...prev, draft: { ...prev.draft, [num]: text } } : prev))
  }

  const handleSaySave = async (num: string, lines: string[]) => {
    try {
      await putSay(key, num, lines)
    } catch (err) {
      if (isFinishedError(err)) return setSaveBlocked(true)
      throw err
    }
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

  const handleFinish = async () => {
    await postFinish(key)
    setDoc((prev) => (prev ? { ...prev, finished: true } : prev))
  }

  return (
    <div className="app">
      <Header
        title={doc?.title ?? ''}
        beatCount={doc?.beats.length ?? 0}
        writtenCount={writtenCount}
        totalWritable={writableBeats.length}
        tab={tab}
        onTabChange={setTab}
        fullScriptWords={fullScriptWords}
      />
      <ToggleRail prefs={prefs} setPrefs={setPrefs} chips={tab === 'full' ? FULL_SCRIPT_CHIPS : undefined} />
      {saveBlocked && <p className="finished-notice">Script finished — ask Kushal to reopen it.</p>}
      {tab === 'write' ? (
        !doc ? (
          <p style={{ padding: '20px 40px' }}>{loadError ? 'Could not load the script.' : 'Loading…'}</p>
        ) : (
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
        )
      ) : (
        <FullScript doc={doc} loadError={loadError} beatLabels={prefs.beatLabels} onRetry={fetchDoc} onFinish={handleFinish} />
      )}
    </div>
  )
}
