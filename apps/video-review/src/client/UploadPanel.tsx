import { useRef, useState } from 'react'
import { api } from './api'
import { probe, sendParts, type Progress } from './upload'
import { MB_PER_MINUTE, checkFile, fmtBytes } from '../shared/rules'
import type { Version } from '../shared/types'

type Props = { token: string; unfinished: Version[]; onChange: () => void }

type Run = { vid: string; file: File; progress: Progress; state: 'sending' | 'stopped'; error?: string }

export function UploadPanel({ token, unfinished, onChange }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const [checking, setChecking] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const abort = useRef<AbortController | null>(null)
  const picker = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined) {
    setFile(f ?? null)
    setProblems([])
    if (!f) return
    setName((n) => n || f.name.replace(/\.[^.]+$/, '').slice(0, 80))
    setChecking(true)
    setProblems(checkFile(await probe(f)))
    setChecking(false)
  }

  async function send(vid: string, f: File) {
    const ctl = new AbortController()
    abort.current = ctl
    const base: Run = { vid, file: f, progress: { sent: 0, total: f.size }, state: 'sending' }
    setRun(base)
    try {
      await sendParts(token, vid, f, (progress) => setRun((r) => (r ? { ...r, progress } : r)), ctl.signal)
      setRun(null)
      setFile(null)
      setName('')
      if (picker.current) picker.current.value = ''
      onChange()
    } catch (e) {
      const err = e as Error
      const reason =
        err.name === 'AbortError'
          ? 'Upload paused.'
          : err instanceof TypeError
            ? 'Upload stopped: the internet connection dropped. Press Resume when it is back.'
            : `Upload stopped: ${err.message}`
      setRun((r) => ({ ...(r ?? base), state: 'stopped', error: reason }))
      onChange()
    }
  }

  async function start() {
    if (!file) return
    const facts = await probe(file)
    try {
      const { version_id } = await api.startUpload(token, { name, ...facts })
      await send(version_id, file)
    } catch (e) {
      setProblems([(e as Error).message])
    }
  }

  async function resumeWith(v: Version, f: File | undefined) {
    if (!f) return
    if (f.size !== v.size) {
      setRun({ vid: v.id, file: f, progress: { sent: 0, total: v.size }, state: 'stopped', error: 'This is not the same file. Pick the file you started with.' })
      return
    }
    await send(v.id, f)
  }

  const pct = run ? Math.floor((run.progress.sent / run.progress.total) * 100) : 0

  return (
    <section className="panel upload" aria-label="Upload a new version">
      <h2>Upload a new version</h2>
      <details className="export-help">
        <summary>Export settings (read before you export)</summary>
        <ul>
          <li>Format: <b>MP4 (H.264)</b>, audio AAC</li>
          <li>Size: <b>1280 × 720</b> (or 720 × 1280 for a vertical video)</li>
          <li>Bitrate: <b>1.5 Mbps</b></li>
          <li>Limit: {MB_PER_MINUTE} MB per minute of video (a 30-minute video can be up to 360 MB)</li>
          <li>Send the full-quality file only after the owner marks a version Final, on Google Drive.</li>
        </ul>
      </details>

      {run ? (
        <div className="progress-box">
          <div className="muted small">
            {run.file.name} · {fmtBytes(run.progress.sent)} of {fmtBytes(run.progress.total)}
          </div>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
          {run.state === 'sending' ? (
            <button className="btn ghost" onClick={() => abort.current?.abort()}>
              Pause
            </button>
          ) : (
            <>
              <div className="error">{run.error}</div>
              <div className="row">
                <button className="btn primary" onClick={() => send(run.vid, run.file)}>
                  Resume
                </button>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    await api.cancelUpload(token, run.vid).catch(() => {})
                    setRun(null)
                    onChange()
                  }}
                >
                  Cancel upload
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {unfinished.map((v) => (
            <div key={v.id} className="unfinished">
              <span>
                Unfinished upload: <b>{v.name}</b> ({fmtBytes(v.size)}). Pick the same file to continue.
              </span>
              <div className="row">
                <label className="btn primary file-btn">
                  Resume
                  <input type="file" accept="video/mp4" hidden onChange={(e) => resumeWith(v, e.target.files?.[0])} />
                </label>
                <button
                  className="btn ghost"
                  onClick={async () => {
                    await api.cancelUpload(token, v.id).catch(() => {})
                    onChange()
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
          <div className="upload-form">
            <input
              ref={picker}
              type="file"
              accept="video/mp4"
              aria-label="Video file"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <input
              className="input"
              placeholder="Version name, for example: v2 intro fixed"
              aria-label="Version name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {checking && <div className="muted small">Checking the file…</div>}
            {problems.map((p) => (
              <div key={p} className="error">
                {p}
              </div>
            ))}
            {file && !checking && problems.length === 0 && (
              <div className="muted small">
                OK: {fmtBytes(file.size)}. Ready to upload.
              </div>
            )}
            <button className="btn primary" disabled={!file || checking || problems.length > 0 || !name.trim()} onClick={start}>
              Upload
            </button>
          </div>
        </>
      )}
      <p className="muted small">Tip: keep this tab open while it uploads. If the internet drops, press Resume.</p>
    </section>
  )
}
