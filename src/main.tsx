import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { applyTheme } from './state/prefs'
import { startGithubSync } from './state/githubSync'
import { actions, useStore } from './state/store'
import './styles/global.css'

applyTheme()
void actions.init().then(() =>
  startGithubSync({ current: () => useStore.getState().data, adopt: (doc) => void actions.adoptSynced(doc) }),
)
// Ask the browser not to evict our storage under disk pressure. (Clearing site data still erases it;
// Save to GitHub in Settings is what survives that.)
void navigator.storage?.persist?.().catch(() => undefined)

// A handle for development and automated checks. Not present in production builds.
if (import.meta.env.DEV) {
  Object.assign(window, { __cairn: { actions, store: useStore, ready: () => useStore.getState().status === 'ready' } })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
