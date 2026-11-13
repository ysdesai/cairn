import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyData, logAttempt, setNotes } from './reducers'
import { downloadExport, exportFilename, readImportFile, serializeExport } from './transfer'
import { parseAppData } from './validate'

const TODAY = '2026-11-12'
const T0 = Date.UTC(2026, 10, 12, 15, 0, 0)

function sampleData() {
  let data = createEmptyData(TODAY, T0)
  data = logAttempt(data, 'two-sum', { rating: 'easy', minutes: 12 }, TODAY, T0 + 1)
  return setNotes(data, 'two-sum', { insight: 'complement map' }, T0 + 2)
}

const fileOf = (text: string) => new File([text], 'backup.json', { type: 'application/json' })

describe('serializeExport', () => {
  it('pretty-prints the document with two spaces and adds exportedAt', () => {
    const data = sampleData()
    const text = serializeExport(data, T0 + 5)
    expect(text).toBe(JSON.stringify({ ...data, exportedAt: '2026-11-12T15:00:00.005Z' }, null, 2))
    expect(text).toContain('\n  "app": "cairn"')
    expect(JSON.parse(text).exportedAt).toBe(new Date(T0 + 5).toISOString())
  })

  it('produces a file that parseAppData accepts, unchanged', () => {
    const data = sampleData()
    const result = parseAppData(JSON.parse(serializeExport(data, T0 + 5)), TODAY, T0 + 10)
    expect(result).toEqual({ ok: true, data, warnings: [] })
  })
})

describe('exportFilename', () => {
  it('includes the date', () => {
    expect(exportFilename('2026-11-12')).toBe('cairn-backup-2026-11-12.json')
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('downloadExport', () => {
  it('does nothing outside a browser', () => {
    expect(typeof document).toBe('undefined')
    expect(() => downloadExport(sampleData(), TODAY, T0)).not.toThrow()
  })

  it('clicks a temporary download link and frees the file afterwards', async () => {
    vi.useFakeTimers()
    const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
    const body = { append: vi.fn() }
    vi.stubGlobal('document', { createElement: vi.fn(() => link), body })
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:cairn')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    const data = sampleData()
    downloadExport(data, TODAY, T0)

    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe(serializeExport(data, T0))
    expect(link).toMatchObject({ href: 'blob:cairn', download: 'cairn-backup-2026-11-12.json' })
    expect(body.append).toHaveBeenCalledWith(link)
    expect(link.click).toHaveBeenCalledOnce()
    expect(link.remove).toHaveBeenCalledOnce()
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cairn')
  })
})

describe('readImportFile', () => {
  it('reads an exported file', async () => {
    const data = sampleData()
    const result = await readImportFile(fileOf(serializeExport(data, T0 + 5)), TODAY, T0 + 10)
    expect(result).toEqual({ ok: true, data, warnings: [] })
  })

  it('passes warnings through for a damaged file', async () => {
    const raw = { ...sampleData(), problems: { 'no-such-problem': { attempts: [], notes: {} } } }
    const result = await readImportFile(fileOf(JSON.stringify(raw)), TODAY, T0)
    expect(result).toMatchObject({ ok: true, warnings: ['Dropped 1 record for unknown problems.'] })
  })

  it('reports invalid JSON', async () => {
    const result = await readImportFile(fileOf('{ not json'), TODAY, T0)
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/not valid JSON/) })
  })

  it('reports an empty file as invalid JSON', async () => {
    const result = await readImportFile(fileOf(''), TODAY, T0)
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/not valid JSON/) })
  })

  it('passes validation errors through', async () => {
    const wrongApp = await readImportFile(fileOf(JSON.stringify({ app: 'other', version: 1 })), TODAY, T0)
    expect(wrongApp).toEqual({ ok: false, error: expect.stringMatching(/not a Cairn backup/) })
    const newer = await readImportFile(fileOf(JSON.stringify({ app: 'cairn', version: 99 })), TODAY, T0)
    expect(newer).toEqual({ ok: false, error: expect.stringMatching(/newer version of Cairn/) })
    const notObject = await readImportFile(fileOf('null'), TODAY, T0)
    expect(notObject).toEqual({ ok: false, error: expect.stringMatching(/not a Cairn backup/) })
  })

  it('reports a file that cannot be read', async () => {
    const unreadable = { size: 10, text: () => Promise.reject(new Error('gone')) } as unknown as File
    const result = await readImportFile(unreadable, TODAY, T0)
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/Could not read that file/) })
  })

  it('rejects a file over 20 MB without reading it', async () => {
    let read = false
    const huge = {
      size: 20 * 1024 * 1024 + 1,
      text: async () => {
        read = true
        return '{}'
      },
    } as unknown as File
    const result = await readImportFile(huge, TODAY, T0)
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/over 20 MB/) })
    expect(read).toBe(false)
  })

  it('accepts a file of exactly 20 MB in size', async () => {
    const edge = { size: 20 * 1024 * 1024, text: async () => 'null' } as unknown as File
    const result = await readImportFile(edge, TODAY, T0)
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/not a Cairn backup/) })
  })

  it('reports a truncated file as invalid JSON', async () => {
    const result = await readImportFile(fileOf('{"app":"cairn","version":1,'), TODAY, T0)
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/not valid JSON/) })
  })

  it('reports JSON nested too deeply for the parser as invalid, without throwing', async () => {
    const result = await readImportFile(fileOf('['.repeat(2_000_000)), TODAY, T0)
    expect(result.ok).toBe(false)
  })

  it('rejects JSON that is not an object', async () => {
    for (const text of ['[]', '5', '"cairn"', 'true']) {
      const result = await readImportFile(fileOf(text), TODAY, T0)
      expect(result, text).toEqual({ ok: false, error: expect.stringMatching(/not a Cairn backup/) })
    }
  })

  it('reads a file that starts with a byte order mark', async () => {
    const data = sampleData()
    const result = await readImportFile(fileOf(`\uFEFF${serializeExport(data, T0)}`), TODAY, T0)
    expect(result).toEqual({ ok: true, data, warnings: [] })
  })

  it('survives a 2 MB string where a number belongs, and a "__proto__" key', async () => {
    const big = JSON.stringify({ ...sampleData(), createdAt: 'x'.repeat(2_000_000), updatedAt: { __proto__: 1 } })
    const result = await readImportFile(fileOf(big), TODAY, T0)
    expect(result.ok).toBe(true)
    const polluted = '{"app":"cairn","version":1,"problems":{"__proto__":{"attempts":[]}},"settings":{"__proto__":{"x":1}}}'
    expect((await readImportFile(fileOf(polluted), TODAY, T0)).ok).toBe(true)
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })

  it('survives a file reader that throws instead of rejecting', async () => {
    const throwing = {
      size: 10,
      text: () => {
        throw new Error('sync failure')
      },
    } as unknown as File
    const result = await readImportFile(throwing, TODAY, T0)
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/Could not read that file/) })
  })
})
