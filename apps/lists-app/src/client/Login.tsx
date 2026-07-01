import { useState } from 'react'
import { ListChecks, Loader2 } from 'lucide-react'
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
        className="w-full max-w-sm rounded-xl bg-card p-7 shadow-[var(--shadow-pop)] animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary-soft text-primary">
            <ListChecks className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Lists</h1>
            <p className="text-sm text-muted-foreground">Enter your password to continue</p>
          </div>
        </div>

        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          placeholder="••••••••"
        />

        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Unlock
        </button>
      </form>
    </div>
  )
}
