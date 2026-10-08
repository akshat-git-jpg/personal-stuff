import { useEffect, useState } from 'react'
import { Home } from './Home'
import { ProjectPage } from './ProjectPage'

function currentPath() {
  return window.location.pathname
}

export default function App() {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const on = () => setPath(currentPath())
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [])

  const m = /^\/p\/([A-Za-z0-9]+)\/?$/.exec(path)
  if (m) return <ProjectPage token={m[1]} />
  return <Home />
}
