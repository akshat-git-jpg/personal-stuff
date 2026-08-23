import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/app.css'
import { App } from './App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('no #root element')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
