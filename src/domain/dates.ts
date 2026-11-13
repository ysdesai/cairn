/**
 * Calendar-date helpers. Dates are local 'YYYY-MM-DD' strings throughout the app, so "today"
 * means the user's today and never shifts with the timezone offset. Arithmetic goes through
 * UTC noon to stay clear of daylight-saving edges.
 */
import type { ISODate } from '../state/schema'

const pad = (n: number) => String(n).padStart(2, '0')

/** The local calendar date of a Date. */
export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISO(now)
}

/** A Date at UTC noon on the given calendar day. For arithmetic and formatting only. */
function utcNoon(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12))
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = utcNoon(value)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = utcNoon(iso)
  d.setUTCDate(d.getUTCDate() + Math.round(days))
  return d.toISOString().slice(0, 10)
}

/** Whole days from `a` to `b`: positive when b is later. */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((utcNoon(b).getTime() - utcNoon(a).getTime()) / 86_400_000)
}

export function minISO(a: ISODate, b: ISODate): ISODate {
  return a <= b ? a : b
}

export function maxISO(a: ISODate, b: ISODate): ISODate {
  return a >= b ? a : b
}

/** Every date from `from` to `to`, inclusive. Empty if `to` is earlier. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const n = diffDays(from, to)
  const out: ISODate[] = []
  for (let i = 0; i <= n; i++) out.push(addDays(from, i))
  return out
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(iso: ISODate): number {
  return (utcNoon(iso).getUTCDay() + 6) % 7
}

/** The Monday on or before the date. */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -weekdayIndex(iso))
}

// Formatted in the reader's own locale, so the examples below are the en-US renderings.
const FORMATS = {
  /** Nov 12 */
  short: { day: 'numeric', month: 'short' },
  /** Nov 12, 2026 */
  medium: { day: 'numeric', month: 'short', year: 'numeric' },
  /** Thursday, November 12 */
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  /** Thu, Nov 12 */
  weekday: { weekday: 'short', day: 'numeric', month: 'short' },
  /** Nov */
  month: { month: 'short' },
  /** Thu */
  dow: { weekday: 'short' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

const formatters = new Map<string, Intl.DateTimeFormat>()

export function formatDate(iso: ISODate | null | undefined, style: keyof typeof FORMATS = 'short'): string {
  if (!iso) return '—'
  let f = formatters.get(style)
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, { ...FORMATS[style], timeZone: 'UTC' })
    formatters.set(style, f)
  }
  return f.format(utcNoon(iso))
}

/** "today", "tomorrow", "yesterday", "in 5 days", "3 days ago". */
export function relativeDay(iso: ISODate, today: ISODate): string {
  const n = diffDays(today, iso)
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}

/** 95 → "1h 35m", 25 → "25m", 0 → "0m". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}h ${rest}m` : `${h}h`
}

/** Milliseconds → "12:41", or "1:02:07" past an hour. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** "morning" before noon, "afternoon" until 6pm, then "evening". */
export function dayPart(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours()
  return h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
}
