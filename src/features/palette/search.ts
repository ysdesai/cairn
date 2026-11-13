/** Scoring for the command palette: forgiving, ordered by how directly the words land. */

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The way people type dimensions: "1 d dp" also reads "1d dp". Takes normalized text. */
export function joinDimensions(text: string): string {
  return text.replace(/(\d) ([a-z])\b/g, '$1$2')
}

export function tokens(query: string): string[] {
  return normalize(query).split(' ').filter(Boolean)
}

/** Letters of `needle` appear in order within a short stretch of `text`, for slips like "lngst". */
function subsequence(text: string, needle: string): boolean {
  let at = 0
  let start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== needle[at]) continue
    if (at === 0) start = i
    if (++at === needle.length) return i - start <= needle.length + 2
  }
  return false
}

/** 0 for no match; up to 100 for the whole text. Both arguments must already be normalized. */
export function scoreText(text: string, token: string, fuzzy = true): number {
  if (!text) return 0
  if (text === token) return 100
  const at = text.indexOf(token)
  if (at === 0) return 90
  if (at > 0) return text[at - 1] === ' ' ? 74 : 50
  if (fuzzy && token.length >= 4 && subsequence(text, token)) return 18
  return 0
}

export interface Searchable {
  /** Normalized fields with a weight: a match in a heavier field scores higher. */
  fields: { text: string; weight: number }[]
}

/**
 * Every token must land somewhere; the score is the sum of each token's best landing. When the
 * words also appear together and in order inside one field ("1 d" in "1-D Dynamic Programming"),
 * that phrase counts for a little more than the same words scattered, so a hyphenated name or a
 * pasted title lands on the thing it names before anything that merely contains the pieces.
 */
export function scoreItem(item: Searchable, query: string[]): number {
  let total = 0
  for (const token of query) {
    let best = 0
    for (const field of item.fields) best = Math.max(best, scoreText(field.text, token, field.weight >= 0.8) * field.weight)
    if (best === 0) return 0
    total += best
  }
  if (query.length > 1) {
    const phrase = query.join(' ')
    for (const field of item.fields) total = Math.max(total, scoreText(field.text, phrase, false) * field.weight * query.length * 1.1)
  }
  return total
}

/**
 * Where each query token lands in `text`, for marking: a start of a word wins over the middle of
 * one, overlapping marks are merged, and the result is in reading order.
 */
export function highlightRanges(text: string, query: string[]): [number, number][] {
  const lower = text.toLowerCase()
  const found: [number, number][] = []
  for (const token of query) {
    let at = -1
    for (let from = lower.indexOf(token); from >= 0; from = lower.indexOf(token, from + 1)) {
      if (at < 0) at = from
      if (from === 0 || /[^a-z0-9]/.test(lower[from - 1])) {
        at = from
        break
      }
    }
    if (at >= 0) found.push([at, at + token.length])
  }
  found.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const range of found) {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([range[0], range[1]])
  }
  return merged
}
