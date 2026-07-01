import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from './client/api'
import Login from './client/Login'
import Board from './client/Board'

type Auth = 'loading' | 'in' | 'out'

export default function App() {
  const [auth, setAuth] = useState<Auth>('loading')

  useEffect(() => {
    api
      .me()
      .then((r) => setAuth(r.authenticated ? 'in' : 'out'))
      .catch(() => setAuth('out'))
  }, [])

  if (auth === 'loading') {
    return (
      <div className="min-h-dvh grid place-items-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    )
  }

  if (auth === 'out') return <Login onSuccess={() => setAuth('in')} />

  return <Board onLogout={() => setAuth('out')} />
}
