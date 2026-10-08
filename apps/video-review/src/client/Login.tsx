import { useState, type FormEvent } from 'react'
import { api } from './api'

export function Login({ onDone }: { onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.login(pin)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <form className="panel login" onSubmit={submit}>
        <h1>Video Review</h1>
        <p className="muted">Enter your PIN.</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          className="input"
          placeholder="PIN"
          aria-label="PIN"
          maxLength={12}
          value={pin}
          autoFocus
          onChange={(e) => setPin(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" className="btn primary" disabled={busy || !pin}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
