/**
 * Progress kept in the app's own GitHub repository, the way the Striver SDE sheet dashboard does it.
 *
 * The whole document is committed as one JSON file on a `progress` branch (not main, so saving never
 * triggers a Pages deploy). Writing needs a fine-grained token with Contents: Read and write on this
 * repository only; it is kept in this browser's localStorage and nowhere else.
 *
 * Reading needs no token while the repository is public. So after browser data is cleared, the
 * next visit finds the empty browser, reads the committed file and carries on from it; pasting
 * the token again turns saving back on.
 *
 * Conflicts (another device or tab committed first) are settled by the document's updatedAt: the
 * newer document wins, as it does between tabs.
 */
import { create } from 'zustand'
import { getToday, now } from './clock'
import type { AppData } from './schema'
import { parseAppData } from './validate'

export const SYNC_BRANCH = 'progress'
export const SYNC_PATH = 'cairn-progress.json'
const CONFIG_KEY = 'cairn:github'
const PUSH_DELAY_MS = 8000
const API = 'https://api.github.com'

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'synced' | 'error'

interface SyncState {
  status: SyncStatus
  /** owner/name. Guessed from a *.github.io address when not set. */
  repo: string
  hasToken: boolean
  lastSynced: number | null
  error: string | null
}

interface Config {
  token: string
  repo: string
}

// --- config ----------------------------------------------------------------------------------

/** owner/name from https://<owner>.github.io/<name>/, or '' anywhere else. */
export function repoFromLocation(): string {
  if (typeof location === 'undefined') return ''
  const host = location.hostname.match(/^([^.]+)\.github\.io$/i)
  const name = location.pathname.split('/').filter(Boolean)[0]
  return host && name ? `${host[1]}/${name}` : ''
}

function readConfig(): Config {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) {
      const c = JSON.parse(raw) as Partial<Config>
      return { token: c.token ?? '', repo: c.repo || repoFromLocation() }
    }
  } catch {
    // Blocked or unreadable: fall through.
  }
  return { token: '', repo: repoFromLocation() }
}

function writeConfig(c: Config): void {
  try {
    if (!c.token && c.repo === repoFromLocation()) localStorage.removeItem(CONFIG_KEY)
    else localStorage.setItem(CONFIG_KEY, JSON.stringify(c))
  } catch {
    // The token then lasts for this visit only.
  }
}

let config: Config = readConfig()

export const useSync = create<SyncState>(() => ({
  status: config.token ? 'idle' : 'off',
  repo: config.repo,
  hasToken: Boolean(config.token),
  lastSynced: null,
  error: null,
}))

// --- the API ---------------------------------------------------------------------------------

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function api(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}/repos/${config.repo}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
      ...init.headers,
    },
  })
}

class SyncError extends Error {}

function explain(status: number, writing: boolean): SyncError {
  if (status === 401) return new SyncError('GitHub rejected the token. It may have expired; paste a new one.')
  if (status === 403 || (writing && status === 404))
    return new SyncError('The token cannot write to this repository. Give it Contents: Read and write on it.')
  if (status === 404) return new SyncError('Repository not found. Check the name, and that the token can see it.')
  return new SyncError(`GitHub answered ${status}.`)
}

interface Remote {
  data: AppData | null
  /** The file's blob sha, needed to replace it. null when the file does not exist. */
  sha: string | null
}

/** The committed document. With a token, through the API; without, from the public raw file. */
async function fetchRemote(): Promise<Remote> {
  let text: string | null = null
  let sha: string | null = null
  if (config.token) {
    const r = await api(`/contents/${SYNC_PATH}?ref=${SYNC_BRANCH}`)
    if (r.status === 404) return { data: null, sha: null } // No branch or no file yet.
    if (!r.ok) throw explain(r.status, false)
    const body = (await r.json()) as { content: string; sha: string }
    text = base64ToUtf8(body.content)
    sha = body.sha
  } else {
    const r = await fetch(`https://raw.githubusercontent.com/${config.repo}/${SYNC_BRANCH}/${SYNC_PATH}?t=${Date.now()}`, { cache: 'no-store' })
    if (r.status === 404) return { data: null, sha: null }
    if (!r.ok) throw new SyncError(`GitHub answered ${r.status}.`)
    text = await r.text()
  }
  const parsed = parseAppData(JSON.parse(text), getToday(), now())
  if (!parsed.ok) throw new SyncError(`The file on GitHub could not be read: ${parsed.error}`)
  return { data: parsed.data, sha }
}

/** Make the progress branch, off the default branch, the first time anything is saved. */
async function ensureBranch(): Promise<void> {
  const exists = await api(`/branches/${SYNC_BRANCH}`)
  if (exists.ok) return
  if (exists.status !== 404) throw explain(exists.status, false)
  const repo = await api('')
  if (!repo.ok) throw explain(repo.status, false)
  const { default_branch } = (await repo.json()) as { default_branch: string }
  const head = await api(`/git/ref/heads/${default_branch}`)
  if (!head.ok) throw explain(head.status, false)
  const { object } = (await head.json()) as { object: { sha: string } }
  const made = await api('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${SYNC_BRANCH}`, sha: object.sha }) })
  if (!made.ok && made.status !== 422) throw explain(made.status, true) // 422: made meanwhile.
}

// --- syncing ---------------------------------------------------------------------------------

/** How the store is reached. Set by `startGithubSync`, so this module does not import the store. */
interface Host {
  current(): AppData
  /** Replace the document with a newer one from GitHub, keeping its updatedAt. */
  adopt(data: AppData): void
}
let host: Host | null = null

let sha: string | null = null
/** updatedAt of the document last read from or written to GitHub. */
let syncedAt = 0
let timer: ReturnType<typeof setTimeout> | null = null
let running: Promise<void> = Promise.resolve()

const isBlank = (d: AppData) => Object.keys(d.problems).length === 0 && d.drills.length === 0 && d.mocks.length === 0 && !d.drillArchive?.length

/** Take the remote document if it is the one to keep. Returns true when it was taken. */
function maybeAdopt(remote: AppData): boolean {
  if (!host) return false
  const local = host.current()
  if (local.demo || remote.demo) return false
  // A fresh, empty browser (data was cleared) always takes what GitHub has.
  const take = (isBlank(local) && !isBlank(remote)) || remote.updatedAt > local.updatedAt
  if (take) host.adopt(remote)
  return take
}

async function push(data: AppData): Promise<void> {
  if (!config.token || !config.repo || data.demo || data.updatedAt <= syncedAt) return
  useSync.setState({ status: 'syncing', error: null })
  try {
    await ensureBranch()
    for (let tries = 0; tries < 3; tries++) {
      const body = JSON.stringify(data, null, 1)
      const r = await api(`/contents/${SYNC_PATH}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Progress: ${new Date(data.updatedAt).toISOString().slice(0, 16).replace('T', ' ')}`,
          content: utf8ToBase64(body),
          branch: SYNC_BRANCH,
          ...(sha ? { sha } : {}),
        }),
      })
      if (r.ok) {
        sha = ((await r.json()) as { content: { sha: string } }).content.sha
        syncedAt = data.updatedAt
        useSync.setState({ status: 'synced', lastSynced: Date.now(), error: null })
        return
      }
      if (r.status === 409 || r.status === 422) {
        // Someone else committed first. Keep theirs if it is newer, else write ours over it.
        const remote = await fetchRemote()
        sha = remote.sha
        if (remote.data && maybeAdopt(remote.data)) {
          syncedAt = remote.data.updatedAt
          useSync.setState({ status: 'synced', lastSynced: Date.now(), error: null })
          return
        }
        continue
      }
      throw explain(r.status, true)
    }
    throw new SyncError('GitHub kept changing under us. Try Sync now.')
  } catch (err) {
    useSync.setState({ status: 'error', error: err instanceof Error ? err.message : 'Could not save to GitHub.' })
  }
}

/** Read GitHub, take it if newer, and push ours if ours is newer. */
async function pull(): Promise<void> {
  if (!config.repo || !host) return
  if (config.token) useSync.setState({ status: 'syncing', error: null })
  try {
    const remote = await fetchRemote()
    sha = remote.sha
    if (remote.data) {
      if (maybeAdopt(remote.data)) syncedAt = remote.data.updatedAt
      else syncedAt = Math.max(syncedAt, remote.data.updatedAt)
    }
    if (!config.token) return
    useSync.setState({ status: 'synced', lastSynced: Date.now() })
    const local = host.current()
    if (!local.demo && !isBlank(local) && local.updatedAt > syncedAt) await push(local)
  } catch (err) {
    // Reading without a token fails quietly: the browser copy is all there is.
    if (config.token) useSync.setState({ status: 'error', error: err instanceof Error ? err.message : 'Could not reach GitHub.' })
  }
}

const queue = (job: () => Promise<void>) => (running = running.then(job, job))

/** Called after every local save. Commits a few seconds after the last change. */
export function scheduleSync(data: AppData): void {
  if (!config.token || data.demo || data.updatedAt <= syncedAt) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    void queue(() => push(host?.current() ?? data))
  }, PUSH_DELAY_MS)
}

/** Commit now anything still waiting (the page is being hidden). */
export function flushSync(): void {
  if (!timer) return
  clearTimeout(timer)
  timer = null
  void queue(() => push(host!.current()))
}

/** Start syncing. Call once the store has loaded. */
export function startGithubSync(h: Host): Promise<void> {
  host = h
  return queue(pull)
}

/** Save the token and repository, then sync both ways. Resolves to the error, or null. */
export async function connectGithub(token: string, repo: string): Promise<string | null> {
  config = { token: token.trim(), repo: repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/+$/, '') }
  writeConfig(config)
  sha = null
  syncedAt = 0
  useSync.setState({ repo: config.repo, hasToken: Boolean(config.token), status: config.token ? 'idle' : 'off', error: null })
  if (!config.token) return null
  await queue(pull)
  return useSync.getState().error
}

/** Forget the token. What is already on GitHub stays there. */
export function disconnectGithub(): void {
  if (timer) clearTimeout(timer)
  timer = null
  config = { token: '', repo: config.repo }
  writeConfig(config)
  useSync.setState({ status: 'off', hasToken: false, lastSynced: null, error: null })
}

/** Sync both ways now. */
export function syncNow(): Promise<void> {
  return queue(pull)
}
