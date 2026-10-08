import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { navigate } from './nav'
import { Player, type Spot } from './Player'
import { UploadPanel } from './UploadPanel'
import { fmtBytes, fmtTime } from '../shared/rules'
import type { Note, ProjectView, Version } from '../shared/types'

const CENTER: Spot = { x: 0.5, y: 0.5 }

export function ProjectPage({ token }: { token: string }) {
  const [view, setView] = useState<ProjectView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vid, setVid] = useState<string | null>(null)
  const [selected, setSelected] = useState<Note | null>(null)
  const [copied, setCopied] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const load = useCallback(async () => {
    try {
      const v = await api.project(token)
      setView(v)
      setVid((cur) => {
        const done = v.versions.filter((x) => x.status !== 'uploading')
        if (cur && done.some((x) => x.id === cur)) return cur
        return (done.find((x) => x.status === 'ready') ?? done[0])?.id ?? null
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }, [token])

  useEffect(() => {
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  if (error) return <div className="center-screen error">{error}</div>
  if (!view) return <div className="center-screen muted">Loading…</div>

  const { project, owner } = view
  const done = view.versions.filter((v) => v.status !== 'uploading')
  const unfinished = view.versions.filter((v) => v.status === 'uploading')
  const current = done.find((v) => v.id === vid) ?? null
  const finalV = done.find((v) => v.id === project.final_version_id) ?? null

  const selectNote = (n: Note) => {
    setSelected(n)
    const v = videoRef.current
    if (v) {
      v.pause()
      v.currentTime = n.t
    }
  }

  return (
    <div className="page project">
      <header className="topbar">
        <div className="title-block">
          {owner && (
            <a
              className="back"
              href="/"
              onClick={(e) => {
                e.preventDefault()
                navigate('/')
              }}
            >
              ← All projects
            </a>
          )}
          <h1>{project.title}</h1>
        </div>
        {owner && (
          <button
            className="btn ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(`${location.origin}/p/${project.token}`).catch(() => {})
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? 'Link copied' : 'Copy editor link'}
          </button>
        )}
      </header>

      {finalV && (
        <div className="banner final" role="status">
          <b>Final: {finalV.name}.</b>{' '}
          {owner ? 'Uploads are closed.' : 'Please send the full-quality file of this version on Google Drive.'}
        </div>
      )}

      <div className="layout">
        <main className="main-col">
          {current ? (
            current.status === 'ready' ? (
              <>
                <Player
                  key={current.id}
                  src={api.videoUrl(token, current.id)}
                  duration={current.duration}
                  aspect={current.width / current.height}
                  notes={current.notes}
                  videoRef={videoRef}
                  selected={selected}
                  onSelect={selectNote}
                  draftSpot={owner && draft.t !== null ? draft.spot : null}
                  onFrameClick={
                    owner
                      ? (spot) => setDraft((d) => ({ t: d.t ?? videoRef.current?.currentTime ?? 0, spot }))
                      : undefined
                  }
                />
                {owner && (
                  <Composer
                    key={`c-${current.id}`}
                    token={token}
                    version={current}
                    videoRef={videoRef}
                    draft={draft}
                    setDraft={setDraft}
                    onSaved={load}
                  />
                )}
              </>
            ) : (
              <div className="panel removed">
                The video file of <b>{current.name}</b> was removed to save space. Its notes are still here.
              </div>
            )
          ) : (
            <div className="panel empty muted">No video yet. {owner ? 'Send the editor link.' : 'Upload the first version below.'}</div>
          )}
          {!project.final_version_id && <UploadPanel token={token} unfinished={unfinished} onChange={load} />}
        </main>

        <aside className="side-col">
          <section className="panel" aria-label="Versions">
            <h2>Versions</h2>
            {done.length === 0 && <p className="muted small">None yet.</p>}
            <ul className="versions">
              {done.map((v) => (
                <li key={v.id}>
                  <button
                    className={`version${v.id === vid ? ' on' : ''}`}
                    onClick={() => {
                      setVid(v.id)
                      setSelected(null)
                      setDraft(EMPTY)
                    }}
                  >
                    <span className="version-name">{v.name}</span>
                    {v.id === project.final_version_id && <span className="tag final">Final</span>}
                    {v.status === 'removed' && <span className="tag">file removed</span>}
                    <span className="muted small">
                      {new Date(v.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {fmtTime(v.duration)} ·{' '}
                      {fmtBytes(v.size)} · {v.notes.length} {v.notes.length === 1 ? 'note' : 'notes'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {owner && current?.status === 'ready' && current.id !== project.final_version_id && (
              <button
                className="btn final-btn"
                onClick={async () => {
                  const ok = confirm(
                    `Mark "${current.name}" as Final?\n\nThe video files of all other versions will be deleted to save space. Notes stay. Uploads close.`,
                  )
                  if (!ok) return
                  await api.markFinal(token, current.id)
                  load()
                }}
              >
                Mark “{current.name}” as Final
              </button>
            )}
          </section>

          {current && (
            <NotesList
              token={token}
              version={current}
              owner={owner}
              selected={selected}
              onSelect={selectNote}
              onChange={load}
            />
          )}

          {owner && (
            <button
              className="btn danger-link"
              onClick={async () => {
                if (!confirm(`Delete the project "${project.title}"? All versions and notes are deleted.`)) return
                await api.deleteProject(token)
                navigate('/')
              }}
            >
              Delete project
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}

type Draft = { t: number | null; spot: Spot }
const EMPTY: Draft = { t: null, spot: CENTER }

function Composer({
  token,
  version,
  videoRef,
  draft,
  setDraft,
  onSaved,
}: {
  token: string
  version: Version
  videoRef: React.RefObject<HTMLVideoElement | null>
  draft: Draft
  setDraft: React.Dispatch<React.SetStateAction<Draft>>
  onSaved: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t, spot } = draft

  // Pause and lock the time as soon as the owner starts a note.
  const lock = () => {
    const v = videoRef.current
    v?.pause()
    setDraft((d) => (d.t === null ? { ...d, t: v?.currentTime ?? 0 } : d))
  }

  const reset = () => {
    setText('')
    setDraft(EMPTY)
    setError(null)
  }

  async function save() {
    if (!text.trim() || t === null) return
    setBusy(true)
    try {
      await api.addNote(token, version.id, { t, x: spot.x, y: spot.y, text })
      reset()
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel composer">
      <div className="composer-head">
        <span className="mono chip">{t === null ? 'Pause and type to add a note' : `Note at ${fmtTime(t, true)}`}</span>
        {t !== null && (
          <span className="muted small">
            {spot === CENTER ? 'Dot: center. Click the video to point at a spot.' : 'Dot placed. Click again to move it.'}
          </span>
        )}
      </div>
      <textarea
        className="input"
        rows={2}
        aria-label="Note"
        placeholder="Type a note for this moment. Enter saves, Shift+Enter adds a line."
        value={text}
        onFocus={lock}
        onChange={(e) => {
          lock()
          setText(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            save()
          } else if (e.key === 'Escape') reset()
        }}
      />
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn primary" disabled={busy || !text.trim()} onClick={save}>
          Add note
        </button>
        {t !== null && (
          <button className="btn ghost" onClick={reset}>
            Discard
          </button>
        )}
      </div>
    </div>
  )
}

function NotesList({
  token,
  version,
  owner,
  selected,
  onSelect,
  onChange,
}: {
  token: string
  version: Version
  owner: boolean
  selected: Note | null
  onSelect: (n: Note) => void
  onChange: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  return (
    <section className="panel" aria-label="Notes">
      <h2>
        Notes <span className="muted small">on {version.name}</span>
      </h2>
      {version.notes.length === 0 && <p className="muted small">No notes yet.</p>}
      <ol className="notes">
        {version.notes.map((n) => (
          <li key={n.id} className={`note${selected?.id === n.id ? ' on' : ''}`} data-testid="note">
            {editing === n.id ? (
              <div className="note-edit">
                <textarea className="input" rows={3} aria-label="Edit note" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <div className="row">
                  <button
                    className="btn primary"
                    disabled={!draft.trim()}
                    onClick={async () => {
                      await api.updateNote(token, { ...n, text: draft })
                      setEditing(null)
                      onChange()
                    }}
                  >
                    Save
                  </button>
                  <button className="btn ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button className="note-body" onClick={() => version.status === 'ready' && onSelect(n)}>
                  <span className="mono chip">{fmtTime(n.t, true)}</span>
                  <span className="note-text">{n.text}</span>
                </button>
                {owner && (
                  <div className="note-actions">
                    <button
                      className="btn link"
                      onClick={() => {
                        setEditing(n.id)
                        setDraft(n.text)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn link"
                      onClick={async () => {
                        if (!confirm('Delete this note?')) return
                        await api.deleteNote(token, n.id)
                        onChange()
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
