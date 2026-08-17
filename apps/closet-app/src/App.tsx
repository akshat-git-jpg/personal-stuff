import { useEffect, useState } from 'react'
import { api } from './client/api'
import Login from './client/Login'
import Closet from './client/Closet'

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
      <div className="min-h-dvh grid place-items-center" style={{ color: 'var(--muted)' }}>
        Loading…
      </div>
    )
  }

  if (auth === 'out') return <Login onSuccess={() => setAuth('in')} />

  return <Closet onLogout={() => setAuth('out')} />
}
