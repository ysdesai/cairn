import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as R from './reducers'
import type { AppData } from './schema'

const TODAY = '2026-11-19'
const T0 = Date.parse('2026-11-19T10:00:00Z')

const withSolve = (at: number): AppData => ({
  ...R.logAttempt({ ...R.createEmptyData(TODAY, at), onboarded: true }, 'two-sum', { rating: 'easy' }, TODAY, at),
  updatedAt: at,
})

const b64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))
const unb64 = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)))
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

/** A fake GitHub holding one file on the progress branch. */
function fakeGithub(initial: AppData | null) {
  const state = { file: initial ? JSON.stringify(initial) : null, sha: initial ? 'sha0' : null, puts: 0, conflictOnce: false }
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    if (url.startsWith('https://raw.githubusercontent.com/')) return state.file ? new Response(state.file) : new Response('', { status: 404 })
    if (url.includes('/branches/progress')) return json(200, {})
    if (url.includes('/contents/cairn-progress.json') && method === 'GET') {
      return state.file ? json(200, { content: b64(state.file), sha: state.sha }) : json(404, {})
    }
    if (url.includes('/contents/cairn-progress.json') && method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { content: string; sha?: string }
      if (state.conflictOnce || (body.sha ?? null) !== state.sha) {
        state.conflictOnce = false
        return json(409, {})
      }
      state.file = unb64(body.content)
      state.sha = `sha${++state.puts}`
      return json(200, { content: { sha: state.sha } })
    }
    return json(500, {})
  })
  vi.stubGlobal('fetch', fetchMock)
  return state
}

async function load() {
  vi.resetModules()
  return import('./githubSync')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(T0)
  vi.stubGlobal('location', { hostname: 'someone.github.io', pathname: '/cairn/' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('github sync', () => {
  it('guesses the repository from a github.io address', async () => {
    const sync = await load()
    expect(sync.repoFromLocation()).toBe('someone/cairn')
  })

  it('restores an emptied browser from the public file, without a token', async () => {
    const saved = withSolve(T0 - 86_400_000)
    fakeGithub(saved)
    const sync = await load()
    let local = R.createEmptyData(TODAY, T0)
    await sync.startGithubSync({ current: () => local, adopt: (d) => (local = d) })
    expect(Object.keys(local.problems)).toEqual(['two-sum'])
    expect(local.updatedAt).toBe(saved.updatedAt)
  })

  it('keeps local progress that is newer than the file, and commits it once connected', async () => {
    const gh = fakeGithub(withSolve(T0 - 86_400_000))
    const sync = await load()
    const local = withSolve(T0)
    const adopt = vi.fn()
    await sync.startGithubSync({ current: () => local, adopt })
    expect(adopt).not.toHaveBeenCalled()
    expect(await sync.connectGithub('tok', 'someone/cairn')).toBeNull()
    expect(gh.puts).toBe(1)
    expect(JSON.parse(gh.file!).updatedAt).toBe(T0)
  })

  it('commits a change a few seconds after it is saved', async () => {
    const gh = fakeGithub(null)
    const sync = await load()
    let local = withSolve(T0)
    await sync.startGithubSync({ current: () => local, adopt: (d) => (local = d) })
    await sync.connectGithub('tok', 'someone/cairn')
    expect(gh.puts).toBe(1)
    local = { ...local, settings: { ...local.settings, dailyReviewCap: 9 }, updatedAt: T0 + 1000 }
    sync.scheduleSync(local)
    expect(gh.puts).toBe(1)
    await vi.advanceTimersByTimeAsync(9000)
    expect(gh.puts).toBe(2)
    expect(JSON.parse(gh.file!).settings.dailyReviewCap).toBe(9)
  })

  it('on a conflict, takes the other device’s document when it is newer', async () => {
    const gh = fakeGithub(null)
    const sync = await load()
    let local = withSolve(T0)
    await sync.startGithubSync({ current: () => local, adopt: (d) => (local = d) })
    await sync.connectGithub('tok', 'someone/cairn')
    // Another device commits something newer.
    const other = { ...withSolve(T0 + 5000), settings: { ...local.settings, dailyReviewCap: 2 } }
    gh.file = JSON.stringify(other)
    gh.sha = 'other'
    local = { ...local, updatedAt: T0 + 1000 }
    sync.scheduleSync(local)
    await vi.advanceTimersByTimeAsync(9000)
    expect(local.settings.dailyReviewCap).toBe(2)
    expect(sync.useSync.getState().status).toBe('synced')
  })

  it('never commits the demo', async () => {
    const gh = fakeGithub(null)
    const sync = await load()
    const local = { ...withSolve(T0), demo: true }
    await sync.startGithubSync({ current: () => local, adopt: vi.fn() })
    await sync.connectGithub('tok', 'someone/cairn')
    sync.scheduleSync(local)
    await vi.advanceTimersByTimeAsync(9000)
    expect(gh.puts).toBe(0)
  })
})
