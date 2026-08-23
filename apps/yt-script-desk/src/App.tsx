import { useCallback, useEffect, useState } from 'react'
import { getVideo, isHosted, postFinish, putDraft, putSay, restoreSay } from './api'
import type { VideoDoc } from './types'
import { usePrefs } from './hooks/usePrefs'
import { SaveStatusProvider } from './hooks/useSaveStatus'
import { Header } from './components/Header'
import { ToggleRail, FULL_SCRIPT_CHIPS } from './components/ToggleRail'
import { WriteView } from './components/WriteView'
import { FullScript } from './components/FullScript'

function getKeyFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('key') ?? ''
}

// Local mode identifies the video with ?key=; hosted mode identifies it with
// the secret token already in the path, and api.ts drops the key argument
// there. So an empty key is only a real problem when we are NOT hosted.
function hasVideoIdentity(key: string): boolean {
  return isHosted || key !== ''
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
  const identified = hasVideoIdentity(key)

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
    if (!identified) return
    fetchDoc()
  }, [identified, fetchDoc])

  if (!identified) {
    return (
      <div className="app">
        <p style={{ padding: '20px 40px' }}>no ?key= in the URL</p>
      </div>
    )
  }

  // A dead or mistyped link resolves to no video at all. Rendering the full
  // chrome around that — tabs, toggles, "Beats 1-0" — reads as a script that
  // loaded and turned out empty, so the maker asks why his script vanished.
  // Say the link is the problem, and show nothing else.
  if (!doc && loadError === 'notfound') {
    return (
      <div className="app">
        <p className="dead-link">This link isn&rsquo;t valid any more. Ask Kushal for a new one.</p>
      </div>
    )
  }

  const writableBeats = doc ? doc.beats.filter((b) => b.mode === 'write') : []
  const writtenCount = doc ? writableBeats.filter((b) => (doc.draft[b.num] ?? '').trim().length > 0).length : 0

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
        edits: {
          ...prev.edits,
          [num]: prev.edits[num] ?? { original, at: new Date().toISOString() },
        },
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
    <SaveStatusProvider>
      <div className="app">
        <Header
          title={doc?.title ?? ''}
          beatCount={doc?.beats.length ?? 0}
          writtenCount={writtenCount}
          totalWritable={writableBeats.length}
          tab={tab}
          onTabChange={setTab}
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
          <FullScript
            doc={doc}
            loadError={loadError}
            beatLabels={prefs.beatLabels}
            onRetry={fetchDoc}
            onFinish={handleFinish}
          />
        )}
      </div>
    </SaveStatusProvider>
  )
}
