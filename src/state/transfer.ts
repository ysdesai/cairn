/** Export to and import from a JSON file. */
import type { AppData, ISODate } from './schema'
import { parseAppData } from './validate'
import type { ParseResult } from './validate'

const MAX_IMPORT_BYTES = 20 * 1024 * 1024
const REVOKE_DELAY_MS = 10_000

/** The file body: the document itself, pretty-printed, with `exportedAt` added. */
export function serializeExport(data: AppData, now: number): string {
  return JSON.stringify({ ...data, exportedAt: new Date(now).toISOString() }, null, 2)
}

/** e.g. "cairn-backup-2026-11-12.json" */
export function exportFilename(today: ISODate): string {
  return `cairn-backup-${today}.json`
}

/** Trigger a browser download of the export. */
export function downloadExport(data: AppData, today: ISODate, now: number): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([serializeExport(data, now)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exportFilename(today)
  // Firefox ignores clicks on links that are not in the page.
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers start the download after the click returns; revoking at once can cancel it.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

/** Read and validate a chosen file. Never throws: problems come back as { ok: false, error }. */
export async function readImportFile(file: File, today: ISODate, now: number): Promise<ParseResult> {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'That file is over 20 MB, far larger than any Cairn backup. Choose a different file.' }
  }
  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, error: 'Could not read that file. Check that it still exists, then choose it again.' }
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON. Choose a backup file that Cairn exported.' }
  }
  return parseAppData(raw, today, now)
}
