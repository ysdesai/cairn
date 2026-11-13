import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { applyTheme } from './state/prefs'
import { actions, useStore } from './state/store'
import './styles/global.css'

applyTheme()
void actions.init()

// A handle for development and automated checks. Not present in production builds.
if (import.meta.env.DEV) {
  Object.assign(window, { __cairn: { actions, store: useStore, ready: () => useStore.getState().status === 'ready' } })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
