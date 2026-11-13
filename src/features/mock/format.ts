import type { MockSession } from '../../state/schema'

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

/** 45 → "Forty-five". Mock lengths run 15 to 120, so anything past that falls back to digits. */
export function numberWord(n: number): string {
  let word: string
  if (!Number.isInteger(n) || n < 0 || n >= 100) {
    if (n === 100) word = 'one hundred'
    else if (n > 100 && n <= 120) word = `one hundred ${n - 100 < 20 ? ONES[n - 100] : `${TENS[Math.floor((n - 100) / 10)]}${(n - 100) % 10 ? `-${ONES[(n - 100) % 10]}` : ''}`}`
    else return String(n)
  } else if (n < 20) word = ONES[n]
  else word = `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/** Whole minutes for a duration in ms, never below one. */
export function wholeMinutes(ms: number): number {
  return Math.max(1, Math.round(ms / 60000))
}

/** Clock time as the person reads it: "6:12 PM". */
export function formatTimeOfDay(epoch: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(epoch)
}

/** Minutes the mock actually ran: ended early or at the buzzer, never past the allotted time. */
export function minutesUsed(mock: MockSession): number {
  const deadline = mock.startedAt + mock.config.minutes * 60000
  const end = Math.min(mock.endedAt ?? deadline, deadline)
  return Math.max(0, Math.round((end - mock.startedAt) / 60000))
}
