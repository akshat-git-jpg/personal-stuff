import { useCallback, useEffect, useState } from 'react'
import {
  getSource,
  getVideo,
  isHosted,
  postFinish,
  putDraft,
  putNotes,
  putSay,
  putSource,
  restoreNotes,
  restoreSay,
} from './api'
import type { SourceDoc, VideoDoc } from './types'
import { mergedLanes, stageNotes } from './lib/lanes'
import { useChromeOffset } from './hooks/useChromeOffset'
import { usePrefs } from './hooks/usePrefs'
import { SaveStatusProvider } from './hooks/useSaveStatus'
import { Header } from './components/Header'
import { ToggleRail, FULL_SCRIPT_CHIPS } from './components/ToggleRail'
import { WriteView } from './components/WriteView'
import { EditView } from './components/EditView'
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

// The whole-file markdown editor is HIDDEN. Notes and spoken lines are edited in
// place in the write view since 2026-08-29, which is what the owner actually does
// day to day, and a second way to change the same file is one more thing to keep
// straight.
//
// It is kept, not deleted, because in-place editing cannot do what it does: move
// a section, delete one, add a block. Reach it with `?edit=1` on the local URL.
// Owner, asked whether to remove it outright: *"Keep it, just hidden."*
const MARKDOWN_EDIT_MODE = new URLSearchParams(window.location.search).get('edit') === '1'

function isFinishedError(err: unknown): boolean {
  return err instanceof Error && /-> 409/.test(err.message)
}

export function App() {
  const { prefs, setPrefs } = usePrefs()
  useChromeOffset()
  const [doc, setDoc] = useState<VideoDoc | null>(null)
  const [loadError, setLoadError] = useState<'notfound' | 'network' | null>(null)
  const [saveBlocked, setSaveBlocked] = useState(false)
  const [tab, setTab] = useState<'write' | 'full'>('write')
  // Edit mode holds the raw markdown and the structural model beside the doc.
  // `source` being non-null IS "we are editing" - there is no separate flag to
  // get out of step with it.
  const [source, setSource] = useState<SourceDoc | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
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

  // Instruction notes, edited in place. The edit is STAGED in the desk's scratch
  // store; `script-plan.md` is untouched until `bin/desk.mjs apply` runs. Owner,
  // 2026-08-29: *"can we do commit in 1 go. i will edit wherever required and
  // tell you once all are reviewed and done."*
  const handleNotesSave = async (num: string, lines: string[]) => {
    await putNotes(key, num, lines)
    setDoc((prev) => {
      if (!prev) return prev
      const beat = prev.beats.find((b) => b.num === num)
      const original = prev.noteEdits?.[num]?.original ?? mergedLanes(beat) ?? []
      return {
        ...prev,
        beats: prev.beats.map((b) => (b.num === num ? stageNotes(b, lines) : b)),
        notes: { ...(prev.notes ?? {}), [num]: lines },
        noteEdits: {
          ...(prev.noteEdits ?? {}),
          [num]: prev.noteEdits?.[num] ?? { original, at: new Date().toISOString() },
        },
      }
    })
  }

  const handleNotesRestore = async (num: string) => {
    const { lines } = await restoreNotes(key, num)
    setDoc((prev) => {
      if (!prev) return prev
      const nextNotes = { ...(prev.notes ?? {}) }
      delete nextNotes[num]
      const nextNoteEdits = { ...(prev.noteEdits ?? {}) }
      delete nextNoteEdits[num]
      return {
        ...prev,
        notes: nextNotes,
        noteEdits: nextNoteEdits,
        beats: prev.beats.map((b) => (b.num === num ? stageNotes(b, lines) : b)),
      }
    })
  }

  // Entering edit mode reads the file fresh, so it always starts from what is on
  // disk rather than from whatever this tab loaded ten minutes ago.
  const handleToggleEdit = async () => {
    if (source) {
      setSource(null)
      setEditError(null)
      fetchDoc()
      return
    }
    setEditBusy(true)
    try {
      setSource(await getSource(key))
      setEditError(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : String(err))
    } finally {
      setEditBusy(false)
    }
  }

  // Every edit-mode action lands here: new markdown in, written to the file,
  // and the server hands back the re-parse. The local copy is only replaced
  // once the write has actually succeeded - a refused save (unparseable, or the
  // file changed underneath us) leaves the page exactly as it was, so nothing
  // he can see is ever out of step with the file.
  const handleApplyEdit = async (nextText: string) => {
    if (!source) return
    setEditBusy(true)
    try {
      const res = await putSource(key, nextText, source.stamp)
      setSource({ text: res.text, stamp: res.stamp, edit: res.edit })
      setDoc(res.doc)
      setEditError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // api.ts throws "<method> <url> -> <status>: <body>"; the body carries the
      // sentence the server wrote for a human, so show that and not the URL.
      const m = msg.match(/->\s*\d+:\s*(.*)$/s)
      let human = m ? m[1] : msg
      try {
        const parsed = JSON.parse(human)
        if (parsed?.error) human = parsed.error
      } catch {
        // not JSON - the raw text is the best we have
      }
      setEditError(human)
    } finally {
      setEditBusy(false)
    }
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
          editing={source !== null}
          onToggleEdit={isHosted || !MARKDOWN_EDIT_MODE ? undefined : handleToggleEdit}
        />
        {!source && (
          <ToggleRail prefs={prefs} setPrefs={setPrefs} chips={tab === 'full' ? FULL_SCRIPT_CHIPS : undefined} />
        )}
        {saveBlocked && <p className="finished-notice">Script finished — ask Kushal to reopen it.</p>}
        {source ? (
          <EditView
            model={source.edit}
            text={source.text}
            busy={editBusy}
            error={editError}
            onApply={handleApplyEdit}
            onDismissError={() => setEditError(null)}
          />
        ) : tab === 'write' ? (
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
              onNotesSave={isHosted ? undefined : handleNotesSave}
              onNotesRestore={isHosted ? undefined : handleNotesRestore}
              noteEdits={doc.noteEdits ?? {}}
              alwaysEditable={!isHosted}
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
