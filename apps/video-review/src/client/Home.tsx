import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { HttpError, api } from './api'
import { navigate } from './nav'
import { Login } from './Login'
import { GB, fmtBytes } from '../shared/rules'
import type { HomeView } from '../shared/types'

export function Home() {
  const [data, setData] = useState<HomeView | null>(null)
  const [needLogin, setNeedLogin] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setData(await api.home())
      setNeedLogin(false)
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) setNeedLogin(true)
      else setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (needLogin) return <Login onDone={load} />
  if (error) return <div className="center-screen error">{error}</div>
  if (!data) return <div className="center-screen muted">Loading…</div>

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const p = await api.createProject(title)
      navigate(`/p/${p.token}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const pct = Math.min(100, (data.used_bytes / (10 * GB)) * 100)
  return (
    <div className="page home">
      <header className="topbar">
        <h1>Video Review</h1>
        <button
          className="btn ghost"
          onClick={async () => {
            await api.logout()
            setNeedLogin(true)
          }}
        >
          Lock
        </button>
      </header>

      <form className="panel new-project" onSubmit={create}>
        <input
          className="input"
          placeholder="New project: video title"
          aria-label="Video title"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button className="btn primary" disabled={busy || !title.trim()}>
          Create project
        </button>
      </form>

      <section className="projects" aria-label="Projects">
        {data.projects.length === 0 && <p className="muted">No projects yet. Create one, then send its link to the editor.</p>}
        {data.projects.map((p) => (
          <a
            key={p.id}
            className="project-row"
            href={`/p/${p.token}`}
            onClick={(e) => {
              e.preventDefault()
              navigate(`/p/${p.token}`)
            }}
          >
            <span className="project-title">{p.title}</span>
            {p.final_version_id && <span className="tag final">Final</span>}
            <span className="muted small">
              {p.versions} {p.versions === 1 ? 'version' : 'versions'}
              {p.last_upload ? ` · last upload ${new Date(p.last_upload).toLocaleDateString()}` : ''}
            </span>
          </a>
        ))}
      </section>

      <footer className="storage" aria-label="Storage">
        <div className="storage-bar">
          <div style={{ width: `${pct}%` }} />
        </div>
        <span className="muted small">
          {fmtBytes(data.used_bytes)} of 10 GB free storage used. New uploads stop at {fmtBytes(data.stop_bytes)}.
        </span>
      </footer>
    </div>
  )
}
