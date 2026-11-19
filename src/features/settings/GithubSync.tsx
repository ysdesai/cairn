import { Cloud, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { SYNC_BRANCH, SYNC_PATH, connectGithub, disconnectGithub, syncNow, useSync } from '../../state/githubSync'
import { Button, Field, Input, toast } from '../../ui'
import s from './Settings.module.css'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

function when(at: number): string {
  const sec = Math.round((Date.now() - at) / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  return min < 60 ? `${min} min ago` : new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** Save progress to this app's GitHub repository, so clearing the browser loses nothing. */
export function GithubSync() {
  const sync = useSync()
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState(sync.repo)
  const [busy, setBusy] = useState(false)

  const connect = async () => {
    setBusy(true)
    const error = await connectGithub(token, repo)
    setBusy(false)
    if (error) {
      toast({ message: 'Could not connect to GitHub', detail: error })
    } else {
      setToken('')
      toast({ message: 'Connected to GitHub', detail: 'Progress now saves to the repository.', tone: 'success' })
    }
  }

  if (sync.hasToken) {
    const text =
      sync.status === 'error'
        ? `Not saving: ${sync.error}`
        : sync.status === 'syncing'
          ? 'Saving…'
          : sync.lastSynced
            ? `Saved to ${sync.repo}, ${when(sync.lastSynced)}. Every change is committed a few seconds later.`
            : `Connected to ${sync.repo}. Every change is committed a few seconds later.`
    return (
      <div className={s.action}>
        <div className={s.actionText}>
          <h3 className={s.actionName}>Save to GitHub</h3>
          <p className={s.actionBody} role={sync.status === 'error' ? 'alert' : undefined}>
            {text}
          </p>
        </div>
        <div className={s.actionControl}>
          <div className={s.buttonRow}>
            <Button icon={<RefreshCw />} disabled={sync.status === 'syncing'} onClick={() => void syncNow()}>
              Sync now
            </Button>
            <Button variant="ghost" onClick={disconnectGithub}>
              Disconnect
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={s.action} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className={s.actionText} style={{ maxWidth: 'none' }}>
        <h3 className={s.actionName}>Save to GitHub</h3>
        <p className={s.actionBody}>
          Commits your progress to <span className="num">{SYNC_PATH}</span> on the <span className="num">{SYNC_BRANCH}</span> branch of this
          app's repository, like the SDE sheet dashboard. If browser data is cleared, Cairn reads it back on the next visit; it also syncs
          your devices. Create a{' '}
          <a href={TOKEN_URL} target="_blank" rel="noreferrer">
            fine-grained token
          </a>{' '}
          with access to only this repository and <b>Contents: Read and write</b>. The token stays in this browser. In a public repository,
          the progress file is public too.
        </p>
      </div>
      <form
        className={s.buttonRow}
        style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault()
          void connect()
        }}
      >
        <Field label="Repository" htmlFor="gh-repo">
          <Input id="gh-repo" mono value={repo} placeholder="owner/name" onChange={(e) => setRepo(e.target.value)} />
        </Field>
        <Field label="Token" htmlFor="gh-token">
          <Input id="gh-token" mono type="password" autoComplete="off" value={token} placeholder="github_pat_…" onChange={(e) => setToken(e.target.value)} />
        </Field>
        <Button type="submit" icon={<Cloud />} disabled={busy || !token.trim() || !repo.includes('/')}>
          {busy ? 'Connecting' : 'Connect'}
        </Button>
      </form>
    </div>
  )
}
