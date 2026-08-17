import { useState } from 'react'
import { api } from './api'

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.login(password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Unauthorized' ? err.message : 'Wrong password')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl p-7"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight">Closet</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Enter your password to continue
          </p>
        </div>

        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password" type="password" className="field"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />

        {error && (
          <p className="mt-2 text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !password} className="btn-primary mt-5 w-full disabled:opacity-50">
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}
