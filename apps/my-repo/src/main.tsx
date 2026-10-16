import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './client/App'
import './client/styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
