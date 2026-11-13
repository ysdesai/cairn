import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getProblem, PROBLEMS_BY_TOPIC, ROADMAP_ORDER } from '../data'
import type { TopicId } from '../data/types'
import { sanitizeMinutes, sanitizeMistakes, sanitizeRecall } from '../state/reducers'
import { MISTAKE_TAGS, RATINGS } from '../state/schema'
import type { AppData, Attempt, Rating } from '../state/schema'
import { parseAppData } from '../state/validate'
import { addDays, diffDays, toISO, weekdayIndex } from './dates'
import { generateDemoData } from './demo'
import { DEMO_NOTES } from './demoNotes'
import { derive } from './derive'
import { replay, sortAttempts } from './srs'
import type { Derived } from './types'

const NOW_A = new Date(2026, 10, 12, 9, 30).getTime()
/** A different weekday alignment, and a history that crosses a year boundary. */
const NOW_B = new Date(2027, 2, 1, 21, 10).getTime()

const ROADMAP_SLUGS = ROADMAP_ORDER.flatMap((topic) => PROBLEMS_BY_TOPIC[topic].map((p) => p.slug))
const HARD_TOPICS: readonly TopicId[] = ['sliding-window', 'linked-list']
const EASY_TOPICS: readonly TopicId[] = ['arrays-hashing', 'two-pointers']

const share = (n: number, of: number) => n / of
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const score = (r: Rating) => (r === 'easy' ? 1 : r === 'struggled' ? 0.55 : 0.15)

/** The first sentence of a problem's demo note, as the generator reuses it for recall. */
const idea = (slug: string) => DEMO_NOTES[slug].insight.split(/\.\s/)[0].replace(/\.$/, '')

/** One logged attempt with what the schedule looked like just before it. */
interface Logged {
  slug: string
  attempt: Attempt
  index: number
  /** The due date the problem had before this attempt; null for a first solve. */
  due: string | null
}

function loggedAttempts(doc: AppData): Logged[] {
  return Object.entries(doc.problems).flatMap(([slug, record]) => {
    const sorted = sortAttempts(record.attempts)
    return sorted.map((attempt, index) => ({
      slug,
      attempt,
      index,
      due: index === 0 ? null : (replay(sorted.slice(0, index))?.due ?? null),
    }))
  })
}

/** Every date with anything logged on it, in order. */
function activeDates(doc: AppData): string[] {
  const dates = new Set<string>(doc.drills.map((x) => x.date))
  for (const record of Object.values(doc.problems)) for (const a of record.attempts) dates.add(a.date)
  return [...dates].sort()
}

/** Every range the brief promises, for one generated document. */
function expectHeadline(doc: AppData, today: string, d: Derived = derive(doc, today)) {
  expect(d.counts.solved).toBeGreaterThanOrEqual(56)
  expect(d.counts.solved).toBeLessThanOrEqual(66)
  expect(d.counts.mastered).toBeGreaterThanOrEqual(6)

  expect(d.queue.totalDue).toBeGreaterThan(doc.settings.dailyReviewCap)
  expect(d.queue.waiting.length).toBeGreaterThanOrEqual(2)
  const overdue = [...d.queue.today, ...d.queue.waiting].filter((v) => (v.dueIn ?? 0) <= -2)
  expect(overdue.length).toBeGreaterThanOrEqual(2)

  expect(d.streak.current).toBe(9)
  expect(d.streak.activeToday).toBe(false)
  expect(d.streak.best).toBeGreaterThan(9)
  expect(d.activity.activeDays).toBeGreaterThanOrEqual(44)
  expect(d.activity.activeDays).toBeLessThanOrEqual(60)

  const counts = new Map(d.mistakes.byTag.map((t) => [t.tag, t.count]))
  for (const { id } of MISTAKE_TAGS) expect(counts.get(id) ?? 0, id).toBeGreaterThanOrEqual(2)
  expect(d.mistakes.byTag.slice(0, 2).map((t) => t.tag).sort()).toEqual(['edge-case', 'off-by-one'])

  const solved = d.list.filter((v) => v.solved)
  const noted = share(solved.filter((v) => v.hasNotes).length, solved.length)
  expect(noted).toBeGreaterThanOrEqual(0.6)
  expect(noted).toBeLessThanOrEqual(0.8)

  expect(d.drill.total).toBeGreaterThanOrEqual(220)
  expect(d.drill.total).toBeLessThanOrEqual(300)
  const tested = d.drill.byPattern.filter((p) => p.seen >= 5)
  expect(tested.filter((p) => (p.accuracy ?? 1) < 0.56).length).toBeGreaterThanOrEqual(3)
  expect(tested.filter((p) => (p.accuracy ?? 0) > 0.7).length).toBeGreaterThanOrEqual(10)
  for (const id of ['monotonic-stack', 'search-on-answer']) {
    const stat = d.drill.byPattern.find((p) => p.pattern.id === id)!
    expect(stat.seen, id).toBeGreaterThanOrEqual(5)
    expect(stat.accuracy!, id).toBeLessThan(0.56)
    expect(stat.accuracy!, id).toBeGreaterThanOrEqual(0.3)
  }

  expect(doc.mocks).toHaveLength(3)
  expect(doc.mocks.every((m) => m.status === 'done')).toBe(true)
  expect(d.activeMock).toBeNull()

  expect(d.topicList.filter((t) => t.state === 'complete').length).toBeGreaterThanOrEqual(3)
  const strengths = d.topicList.flatMap((t) => (t.strength === null ? [] : [t.strength]))
  expect(Math.min(...strengths)).toBeLessThan(55)
  expect(Math.max(...strengths)).toBeGreaterThan(75)
  // The two weak topics land in a band that reads as weak but not hopeless; the strong ones sit high.
  for (const id of HARD_TOPICS) {
    expect(d.topics[id].strength, id).toBeGreaterThanOrEqual(38)
    expect(d.topics[id].strength, id).toBeLessThanOrEqual(54)
  }
  for (const id of EASY_TOPICS) expect(d.topics[id].strength, id).toBeGreaterThan(76)
  // A topic with nothing solved is uncharted, whatever the drill says about it.
  for (const t of d.topicList.filter((x) => x.solved === 0)) {
    expect(t.strength, t.topic.id).toBeNull()
    expect(t.confidence, t.topic.id).toBe('none')
  }

  expect(['behind', 'on-pace']).toContain(d.plan.status)

  const attempts = d.list.flatMap((v) => v.attempts)
  for (const rating of RATINGS) {
    expect(share(attempts.filter((a) => a.rating === rating).length, attempts.length), rating).toBeGreaterThanOrEqual(0.15)
  }

  expectRhythm(doc)
  expectDays(doc, today)
}

/** Three days in four, lighter at weekends, and one break of four or five days around week five. */
function expectRhythm(doc: AppData) {
  const dates = activeDates(doc)
  const start = doc.settings.startDate
  const gaps: { from: number; length: number }[] = []
  for (let i = 1; i < dates.length; i++) {
    const length = diffDays(dates[i - 1], dates[i]) - 1
    if (length > 0) gaps.push({ from: diffDays(start, dates[i - 1]) + 1, length })
  }
  const breaks = gaps.filter((g) => g.length >= 3)
  expect(breaks).toHaveLength(1)
  expect(breaks[0].length).toBeGreaterThanOrEqual(4)
  expect(breaks[0].length).toBeLessThanOrEqual(5)
  // Week five is days 28 to 34.
  expect(breaks[0].from).toBeGreaterThanOrEqual(26)
  expect(breaks[0].from).toBeLessThanOrEqual(35)
  expect(gaps.filter((g) => g.length === 2).length).toBeLessThanOrEqual(1)

  const days = Array.from({ length: 69 }, (_, i) => addDays(start, i))
  const active = new Set(dates)
  const rate = (weekend: boolean) => {
    const pool = days.filter((day) => (weekdayIndex(day) >= 5) === weekend)
    return share(pool.filter((day) => active.has(day)).length, pool.length)
  }
  expect(rate(true)).toBeLessThan(rate(false))

  // New problems are lighter at weekends too.
  const newOn = new Map<string, number>()
  for (const { attempt, index } of loggedAttempts(doc)) if (index === 0) newOn.set(attempt.date, (newOn.get(attempt.date) ?? 0) + 1)
  const perDay = (weekend: boolean) =>
    mean(dates.filter((day) => (weekdayIndex(day) >= 5) === weekend).map((day) => newOn.get(day) ?? 0))
  expect(perDay(true)).toBeLessThan(perDay(false))
}

/** What each day holds: due revisions first, earliest due first, then a few new problems. */
function expectDays(doc: AppData, today: string) {
  const cap = doc.settings.dailyReviewCap
  const logged = loggedAttempts(doc)
  const days = new Map<string, Logged[]>()
  for (const entry of logged.filter((l) => l.attempt.source === 'manual')) {
    days.set(entry.attempt.date, [...(days.get(entry.attempt.date) ?? []), entry])
  }

  const revisionsPerDay: [string, number][] = []
  for (const [date, entries] of days) {
    entries.sort((a, b) => a.attempt.at - b.attempt.at)
    const revisions = entries.filter((e) => e.index > 0)
    const fresh = entries.filter((e) => e.index === 0)
    expect(revisions.length, date).toBeLessThanOrEqual(cap)
    expect(fresh.length, date).toBeLessThanOrEqual(3)
    revisionsPerDay.push([date, revisions.length])

    // Never revised before it was due, and the longest-waiting go first.
    for (const r of revisions) expect(r.due !== null && r.attempt.date >= r.due, `${r.slug} on ${date}`).toBe(true)
    for (let i = 1; i < revisions.length; i++) expect(revisions[i].due! >= revisions[i - 1].due!, date).toBe(true)
    // Revisions come before new problems within a day.
    if (revisions.length > 0 && fresh.length > 0) {
      expect(revisions.at(-1)!.attempt.at).toBeLessThan(fresh[0].attempt.at)
    }
  }

  // No problem is attempted twice on one day, mocks included.
  const seen = new Set<string>()
  for (const { slug, attempt } of logged) {
    const key = `${slug}@${attempt.date}`
    expect(seen.has(key), key).toBe(false)
    seen.add(key)
  }

  // Most of the last five days only get a revision or two done, and a few days earlier did too.
  const lastFive = [4, 3, 2, 1, 0].map((n) => addDays(today, -1 - n))
  const light = lastFive.filter((date) => (days.get(date)?.filter((e) => e.index > 0).length ?? 0) <= 2)
  expect(light.length).toBeGreaterThanOrEqual(3)
  const middleLight = revisionsPerDay.filter(([date, n]) => n <= 2 && date >= addDays(today, -69 + 32) && date < lastFive[0])
  expect(middleLight.length).toBeGreaterThanOrEqual(2)
  // Every other active day works through everything that is due, up to the cap.
  const dueBefore = (date: string) =>
    Object.values(doc.problems).filter((record) => {
      const due = replay(record.attempts.filter((a) => a.date < date))?.due
      return due !== null && due !== undefined && due <= date
    }).length
  const short = revisionsPerDay.filter(([date, n]) => n < Math.min(cap, dueBefore(date)))
  expect(short.length).toBeLessThanOrEqual(9)
  expect(short.length).toBeLessThan(revisionsPerDay.length * 0.2)
}

const scenarios = [
  { name: 'today 2026-11-12', today: '2026-11-12', now: NOW_A },
  { name: 'today 2027-03-01, across a year boundary', today: '2027-03-01', now: NOW_B },
]

describe.each(scenarios)('generateDemoData, $name', ({ today, now }) => {
  let doc: AppData
  let d: Derived

  beforeAll(() => {
    doc = generateDemoData(today, now, 7)
    d = derive(doc, today)
  })

  it('meets every headline range', () => {
    expectHeadline(doc, today, d)
  })

  it('sets up the plan and flags as the brief describes', () => {
    expect(doc.settings.startDate).toBe(addDays(today, -69))
    expect(doc.settings.targetDate).toBe(addDays(today, 98))
    expect(doc.settings.dailyReviewCap).toBe(5)
    expect(doc.settings.targets).toEqual({ easy: 15, medium: 25, hard: 40 })
    expect(doc.demo).toBe(true)
    expect(doc.onboarded).toBe(true)
    expect(doc.timer).toBeNull()
    expect(doc.session).toBeNull()
    expect(doc.updatedAt).toBe(now)
    expect(toISO(new Date(doc.createdAt))).toBe(doc.settings.startDate)
  })

  it('logs nothing on today or later, and leaves today fresh', () => {
    const dates = [
      ...Object.values(doc.problems).flatMap((r) => r.attempts.map((a) => a.date)),
      ...doc.drills.map((x) => x.date),
    ]
    expect(dates.length).toBeGreaterThan(0)
    expect(dates.every((date) => date < today)).toBe(true)
    expect(dates.some((date) => date === addDays(today, -1))).toBe(true)
    expect(d.queue.doneToday).toBe(0)
    expect(d.drill.today).toBe(0)
  })

  it('puts every entry on its own day, in the evening, in strictly increasing order of logging', () => {
    const entries = [
      ...Object.values(doc.problems).flatMap((r) => r.attempts.map((a) => ({ at: a.at, date: a.date }))),
      ...doc.drills.map((x) => ({ at: x.at, date: x.date })),
    ].sort((a, b) => a.at - b.at)

    expect(new Set(entries.map((e) => e.at)).size).toBe(entries.length)
    expect(entries.every((e) => Number.isInteger(e.at))).toBe(true)
    for (const { at, date } of entries) expect(toISO(new Date(at))).toBe(date)
    for (let i = 1; i < entries.length; i++) expect(entries[i].date >= entries[i - 1].date).toBe(true)
    expect(entries.every((e) => e.at < now)).toBe(true)

    // The first entry of a day lands between 4 pm and 10:30 pm, and the last well before midnight.
    const byDate = new Map<string, number[]>()
    for (const { at, date } of entries) byDate.set(date, [...(byDate.get(date) ?? []), at])
    for (const [date, times] of byDate) {
      const clock = (at: number) => new Date(at).getHours() + new Date(at).getMinutes() / 60
      expect(clock(times[0]), date).toBeGreaterThanOrEqual(16)
      expect(clock(times[0]), date).toBeLessThanOrEqual(22.5)
      expect(clock(times.at(-1)!), date).toBeLessThanOrEqual(23.5)
    }

    for (const mock of doc.mocks) {
      expect(mock.endedAt).not.toBeNull()
      expect(mock.endedAt!).toBeGreaterThan(mock.startedAt)
    }
    for (const record of Object.values(doc.problems)) {
      if (record.notes.updatedAt !== null) expect(record.notes.updatedAt).toBeLessThan(now)
    }
  })

  it('follows the roadmap, with at most a couple of early peeks', () => {
    const solved = new Set(d.list.filter((v) => v.solved).map((v) => v.problem.slug))
    const prefix = new Set(ROADMAP_SLUGS.slice(0, solved.size))
    const ahead = [...solved].filter((slug) => !prefix.has(slug))
    expect(ahead.length).toBeLessThanOrEqual(2)
    // A peek is always the first problem of its topic.
    for (const slug of ahead) expect(getProblem(slug)!.indexInTopic).toBe(1)

    // And in time order: a topic is never started while an earlier one has more than a few left.
    const firsts = d.list
      .filter((v) => v.solved)
      .map((v) => ({ slug: v.problem.slug, at: v.attempts[0].at }))
      .sort((a, b) => a.at - b.at)
    firsts.forEach(({ slug }, i) => {
      const rank = ROADMAP_SLUGS.indexOf(slug)
      expect(rank, `${slug} was solved too early`).toBeLessThanOrEqual(i + 2 + 12)
    })
  })

  it('shows the learner\'s strengths and weaknesses', () => {
    const topic = (id: TopicId) => d.topics[id]
    const hardTopics = HARD_TOPICS.map(topic)
    const easyTopics = EASY_TOPICS.map(topic)

    // First solves in the hard topics are mostly struggled or help.
    const firsts = hardTopics.flatMap((t) => t.problems.map((v) => v.attempts[0].rating))
    expect(firsts.filter((r) => r !== 'easy').length / firsts.length).toBeGreaterThan(0.6)
    for (const t of hardTopics) {
      expect(t.strength!, t.topic.id).toBeGreaterThanOrEqual(38)
      expect(t.strength!, t.topic.id).toBeLessThanOrEqual(54)
    }
    // Nearly everything in the easy topics is rated easy.
    const easyRatings = easyTopics.flatMap((t) => t.problems.flatMap((v) => v.attempts.map((a) => a.rating)))
    expect(easyRatings.filter((r) => r === 'easy').length / easyRatings.length).toBeGreaterThan(0.78)
    for (const t of easyTopics) expect(t.strength!, t.topic.id).toBeGreaterThan(76)
    // Revisions in the hard topics lapse now and then.
    const lapses = hardTopics.reduce((n, t) => n + t.problems.reduce((m, v) => m + (v.srs?.lapses ?? 0), 0), 0)
    expect(lapses).toBeGreaterThanOrEqual(5)
    // But nothing is hammered: no problem is attempted more than twelve times in ten weeks.
    expect(Math.max(...d.list.map((v) => v.attempts.length))).toBeLessThanOrEqual(12)

    // Times run well over target there, and under it in the easy topics.
    const slow = hardTopics.flatMap((t) => t.problems.map((v) => v.attempts[0].minutes)).filter((m): m is number => m !== null)
    const quick = easyTopics.flatMap((t) => t.problems.map((v) => v.attempts[0].minutes)).filter((m): m is number => m !== null)
    expect(mean(slow)).toBeGreaterThan(mean(quick) * 1.8)
  })

  it('rates harder problems worse, and revisions better than first solves', () => {
    const solved = d.list.filter((v) => v.solved)

    const byDifficulty = (difficulty: string) =>
      mean(solved.filter((v) => v.problem.difficulty === difficulty).map((v) => score(v.attempts[0].rating)))
    expect(byDifficulty('easy')).toBeGreaterThan(byDifficulty('medium'))
    expect(byDifficulty('medium')).toBeGreaterThan(byDifficulty('hard'))

    const first = mean(solved.map((v) => score(v.attempts[0].rating)))
    const revisions = mean(solved.flatMap((v) => v.attempts.slice(1).map((a) => score(a.rating))))
    expect(revisions).toBeGreaterThan(first)
    expect(solved.flatMap((v) => v.attempts.slice(1)).some((a) => a.rating === 'help')).toBe(true)
  })

  it('times attempts the way the brief describes', () => {
    const attempts = d.list.flatMap((v) =>
      v.attempts.map((a, i) => ({ a, i, slug: v.problem.slug, target: doc.settings.targets[v.problem.difficulty] })),
    )
    const timed = attempts.filter(({ a }) => a.minutes !== null)
    // A mock attempt is a full timed solve of a problem already seen, not a recall revision.
    const recalls = timed.filter(({ a }) => a.source === 'manual')
    expect(share(timed.length, attempts.length)).toBeGreaterThan(0.78)
    expect(share(timed.length, attempts.length)).toBeLessThan(0.92)

    // Within the hard topics and outside them separately, so the mix of topics cannot hide it.
    const ratio = (rating: Rating, revision: boolean, hard: boolean) =>
      recalls
        .filter(({ a, i }) => a.rating === rating && (i > 0) === revision)
        .filter(({ slug }) => HARD_TOPICS.includes(getProblem(slug)!.topic) === hard)
        .map(({ a, target }) => a.minutes! / target)
    for (const hard of [false, true]) {
      const [easy, struggled, help] = RATINGS.map((rating) => ratio(rating, false, hard))
      if (easy.length >= 12 && struggled.length >= 12) expect(mean(easy)).toBeLessThan(mean(struggled))
      if (struggled.length >= 12 && help.length >= 12) expect(mean(struggled)).toBeLessThan(mean(help))
      for (const rating of RATINGS) {
        const first = ratio(rating, false, hard)
        const revisions = ratio(rating, true, hard)
        if (first.length >= 5 && revisions.length >= 5) expect(mean(revisions), `${rating} ${hard}`).toBeLessThan(mean(first) * 0.75)
      }
    }
    expect(mean(ratio('easy', false, false))).toBeLessThan(1)

    // Outside the two hard topics every solve sits in its rating's band, and a revision takes
    // 40 to 60% of that. A little slack covers rounding to whole minutes.
    const band: Record<Rating, readonly [number, number]> = { easy: [0.45, 0.9], struggled: [1, 1.6], help: [1.2, 2] }
    for (const v of d.list) {
      if (HARD_TOPICS.includes(v.problem.topic)) continue
      const target = doc.settings.targets[v.problem.difficulty]
      v.attempts.forEach((a, i) => {
        if (a.minutes === null || a.source === 'mock') return
        const [low, high] = band[a.rating]
        const [from, to] = i === 0 ? [low, high] : [low * 0.4, high * 0.6]
        const slack = 1 / target
        expect(a.minutes / target, `${v.problem.slug} attempt ${i}`).toBeGreaterThanOrEqual(Math.min(from - slack, 2 / target))
        expect(a.minutes / target, `${v.problem.slug} attempt ${i}`).toBeLessThanOrEqual(to + slack)
      })
    }
  })

  it('tags mistakes on struggled and help attempts only', () => {
    const attempts = d.list.flatMap((v) => v.attempts)
    expect(attempts.filter((a) => a.rating === 'easy').every((a) => a.mistakes.length === 0)).toBe(true)

    const hard = attempts.filter((a) => a.rating !== 'easy')
    expect(share(hard.filter((a) => a.mistakes.length > 0).length, hard.length)).toBeGreaterThan(0.6)
    expect(share(hard.filter((a) => a.mistakes.length > 0).length, hard.length)).toBeLessThan(0.8)
    expect(hard.every((a) => a.mistakes.length <= 2)).toBe(true)

    const counts = new Map(d.mistakes.byTag.map((t) => [t.tag, t.count]))
    for (const { id } of MISTAKE_TAGS) expect(counts.get(id), id).toBeGreaterThanOrEqual(3)
    const rank = d.mistakes.byTag.map((t) => t.tag)
    expect(rank.slice(0, 2).sort()).toEqual(['edge-case', 'off-by-one'])

    // wrong-pattern clusters in the topics the learner finds hard.
    const wrongPattern = d.mistakes.byTopic.map((t) => ({ topic: t.topic, n: t.byTag['wrong-pattern'] ?? 0 }))
    const inHard = wrongPattern.filter((t) => HARD_TOPICS.includes(t.topic)).reduce((a, t) => a + t.n, 0)
    const total = wrongPattern.reduce((a, t) => a + t.n, 0)
    expect(inHard / total).toBeGreaterThan(0.4)
  })

  it('writes notes by hand for most solved problems, and recall for about half the revisions', () => {
    const solved = d.list.filter((v) => v.solved)
    const helped = solved.filter((v) => v.attempts[0].rating === 'help')
    expect(helped.length).toBeGreaterThan(5)
    expect(share(helped.filter((v) => v.hasNotes).length, helped.length)).toBeGreaterThanOrEqual(0.9)

    for (const v of solved.filter((x) => x.hasNotes)) {
      const { notes } = doc.problems[v.problem.slug]
      expect(notes.insight).toBe(DEMO_NOTES[v.problem.slug].insight)
      expect(notes.pitfalls).toBe(DEMO_NOTES[v.problem.slug].pitfalls)
      expect(notes.updatedAt).not.toBeNull()
    }

    const revisions = solved.flatMap((v) => v.attempts.slice(1).map((a) => ({ a, slug: v.problem.slug })))
    const withRecall = revisions.filter(({ a }) => a.recall !== undefined)
    expect(share(withRecall.length, revisions.length)).toBeGreaterThan(0.35)
    expect(share(withRecall.length, revisions.length)).toBeLessThan(0.65)
    for (const { a, slug } of withRecall) {
      expect(a.recall!.length).toBeLessThanOrEqual(150)
      expect(a.recall).not.toContain('!')
      // A good revision restates the whole idea; a lapse never does.
      if (a.rating === 'easy') expect(a.recall).toBe(`${idea(slug)}.`)
      else expect(a.recall).not.toContain(idea(slug))
      expect(a.recall).not.toMatch(/\ba easy\b/)
    }
    // A first solve never carries recall.
    expect(solved.every((v) => v.attempts[0].recall === undefined)).toBe(true)
  })

  it('clears the whole ladder on several early problems', () => {
    const mastered = d.list.filter((v) => v.status === 'mastered')
    expect(mastered.length).toBeGreaterThanOrEqual(6)
    const early = mastered.filter((v) => v.problem.order <= 14)
    expect(early.length).toBeGreaterThanOrEqual(6)
  })

  it('drills about forty days, in runs of 4 to 12, with plausible picks and times', () => {
    const perDay = new Map<string, number>()
    for (const x of doc.drills) perDay.set(x.date, (perDay.get(x.date) ?? 0) + 1)
    expect(perDay.size).toBeGreaterThanOrEqual(36)
    expect(perDay.size).toBeLessThanOrEqual(44)
    for (const n of perDay.values()) {
      expect(n).toBeGreaterThanOrEqual(4)
      expect(n).toBeLessThanOrEqual(12)
    }

    for (const x of doc.drills) {
      const problem = getProblem(x.slug)!
      expect(x.answer).toBe(problem.pattern)
      expect(x.correct).toBe(x.picked === x.answer)
      expect(x.ms).toBeGreaterThanOrEqual(2500)
      expect(x.ms).toBeLessThanOrEqual(16000)
      // With three or more decoys a wrong pick has to be one of them.
      if (!x.correct && problem.decoys.length >= 3) expect(problem.decoys).toContain(x.picked)
    }

    // Cards come from the whole list, not only from solved problems.
    const unsolved = doc.drills.filter((x) => !d.problems[x.slug].solved)
    expect(unsolved.length).toBeGreaterThan(doc.drills.length * 0.3)
  })

  it('has three finished mocks in weeks 4, 7 and 9, one with an unfinished problem', () => {
    const start = doc.settings.startDate
    const weeks = doc.mocks.map((m) => Math.floor(diffDays(start, toISO(new Date(m.startedAt))) / 7) + 1)
    expect(weeks).toEqual([4, 7, 9])

    expect(new Set(doc.mocks.map((m) => m.config.mix)).size).toBe(3)
    const outcomes = doc.mocks.flatMap((m) => Object.values(m.results).map((r) => r.outcome))
    expect(outcomes.filter((o) => o === 'unfinished')).toHaveLength(1)
    expect(new Set(outcomes).size).toBeGreaterThanOrEqual(3)

    for (const mock of doc.mocks) {
      expect(mock.slugs).toHaveLength(2)
      expect(Object.keys(mock.results).sort()).toEqual([...mock.slugs].sort())
      for (const slug of mock.slugs) {
        const result = mock.results[slug]
        const logged = doc.problems[slug]?.attempts.filter((a) => a.source === 'mock') ?? []
        if (result.outcome === 'unfinished') {
          expect(Object.hasOwn(mock.marks, slug)).toBe(false)
          expect(result.minutes).toBeNull()
          // Nothing is logged for it, so it is not solved by the mock.
          expect(logged).toHaveLength(0)
        } else {
          expect(Object.hasOwn(mock.marks, slug)).toBe(true)
          expect(logged.some((a) => a.rating === result.outcome && a.minutes === result.minutes)).toBe(true)
          // The mark is where the clock stood, and the result's minutes agree with it to the minute.
          expect(result.minutes!).toBeLessThanOrEqual(Math.ceil(mock.marks[slug] / 60_000))
        }
      }
    }
  })

  it('is what the reducers produce: every field already sanitised', () => {
    for (const record of Object.values(doc.problems)) {
      expect(new Set(record.attempts.map((a) => a.id)).size).toBe(record.attempts.length)
      for (const a of record.attempts) {
        expect(a.id).toMatch(/^[0-9a-z]{12}$/)
        expect(sanitizeMinutes(a.minutes)).toBe(a.minutes)
        expect(sanitizeMistakes(a.mistakes)).toEqual(a.mistakes)
        expect(sanitizeRecall(a.recall)).toBe(a.recall)
        expect(['manual', 'mock']).toContain(a.source)
      }
    }
    expect(new Set(doc.mocks.map((m) => m.id)).size).toBe(doc.mocks.length)
    for (const record of Object.values(doc.problems)) {
      // Notes are saved whole, so a record has all four fields or none.
      const filled = [record.notes.insight, record.notes.time, record.notes.space, record.notes.pitfalls].filter((t) => t !== '')
      expect([0, 4]).toContain(filled.length)
    }
  })

  it('reads back through the importer without a change or a warning', () => {
    const result = parseAppData(JSON.parse(JSON.stringify(doc)), today, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings).toEqual([])
    expect(result.data).toEqual(doc)
  })

  it('is deterministic, and the seed changes the history', () => {
    expect(generateDemoData(today, now, 7)).toEqual(doc)
    expect(generateDemoData(today, now)).toEqual(doc)

    const other = generateDemoData(today, now, 8)
    expect(other).not.toEqual(doc)
    expectHeadline(other, today)
  })

  it('generates quickly', () => {
    const started = performance.now()
    generateDemoData(today, now, 21)
    expect(performance.now() - started).toBeLessThan(400)
  })
})

describe('generateDemoData purity', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reads neither the clock nor Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random was called')
    })
    const now = vi.spyOn(Date, 'now').mockImplementation(() => {
      throw new Error('Date.now was called')
    })
    const doc = generateDemoData('2026-11-12', NOW_A, 3)
    expect(random).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
    vi.restoreAllMocks()

    // And the wall clock makes no difference.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2031, 5, 1, 3, 0))
    expect(generateDemoData('2026-11-12', NOW_A, 3)).toEqual(doc)
  })

  it('gives the same history whatever the time of day: only updatedAt follows `now`', () => {
    const today = '2026-11-12'
    const at = (hour: number, minute = 0) => new Date(2026, 10, 12, hour, minute).getTime()
    const base = generateDemoData(today, at(0, 1), 7)
    for (const now of [at(6, 15), at(9, 30), at(12), at(18, 45), at(23, 59), new Date(2026, 10, 13, 4).getTime()]) {
      const doc = generateDemoData(today, now, 7)
      expect(doc.updatedAt).toBe(now)
      // Every attempt, rating, note, drill and mock is the same; nothing else moves with the clock.
      expect({ ...doc, updatedAt: 0 }).toEqual({ ...base, updatedAt: 0 })
    }
    // The numbers a screen shows are the same too.
    const a = derive(base, today)
    const b = derive(generateDemoData(today, at(21, 40), 7), today)
    expect(b.counts).toEqual(a.counts)
    expect(b.topicList.map((t) => t.strength)).toEqual(a.topicList.map((t) => t.strength))
    expect(b.queue.totalDue).toBe(a.queue.totalDue)
  })

  it('does not depend on earlier calls', () => {
    const a = generateDemoData('2026-11-12', NOW_A, 5)
    const b = generateDemoData('2027-03-01', NOW_B, 9)
    const c = generateDemoData('2026-11-12', NOW_A, 5)
    const d = generateDemoData('2027-03-01', NOW_B, 9)
    expect(c).toEqual(a)
    expect(d).toEqual(b)
    // The document shares nothing with the notes table, so editing it cannot change a later one.
    const slug = Object.keys(a.problems).find((s) => a.problems[s].notes.insight !== '')!
    const before = DEMO_NOTES[slug].insight
    a.problems[slug].notes.insight = 'changed'
    a.settings.targets.easy = 99
    expect(DEMO_NOTES[slug].insight).toBe(before)
    expect(generateDemoData('2026-11-12', NOW_A, 5)).toEqual(c)
  })
})

describe('generateDemoData across seeds and days', () => {
  // Month ends, a leap day, a year boundary, and every weekday.
  const days = [
    '2026-11-12',
    '2027-03-01',
    '2028-02-29',
    '2028-03-01',
    '2026-12-31',
    '2027-01-01',
    '2027-05-31',
    '2027-08-14',
    '2027-10-03',
    '2027-04-30',
    '2027-02-28',
    '2026-10-31',
  ]

  it('covers every weekday', () => {
    expect(new Set(days.map(weekdayIndex)).size).toBe(7)
  })

  it('holds the headline ranges for every day, with three seeds each', () => {
    for (const today of days) {
      const now = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8)), 9, 30).getTime()
      for (const seed of [1, 7, 12345]) expectHeadline(generateDemoData(today, now, seed), today)
    }
  }, 60_000)

  it('holds the headline ranges for twenty seeds', () => {
    for (let seed = 1; seed <= 20; seed++) expectHeadline(generateDemoData('2026-11-12', NOW_A, seed), '2026-11-12')
  }, 60_000)

  it('holds the headline ranges for every weekday alignment, day by day', () => {
    for (let offset = 0; offset < 14; offset++) {
      const today = addDays('2026-11-12', offset)
      expectHeadline(generateDemoData(today, NOW_A, 7), today)
    }
  }, 60_000)
})

describe('DEMO_NOTES', () => {
  it('covers the first 75 problems in roadmap order', () => {
    for (const slug of ROADMAP_SLUGS.slice(0, 75)) expect(DEMO_NOTES[slug], slug).toBeDefined()
  })

  it('names only real problems', () => {
    for (const slug of Object.keys(DEMO_NOTES)) expect(getProblem(slug), slug).toBeDefined()
  })

  it('has every field filled in, with real complexities and no stray punctuation', () => {
    for (const [slug, note] of Object.entries(DEMO_NOTES)) {
      for (const field of ['insight', 'time', 'space', 'pitfalls'] as const) {
        expect(note[field].trim(), `${slug} ${field}`).not.toBe('')
        expect(note[field], `${slug} ${field}`).not.toContain('!')
        expect(note[field], `${slug} ${field}`).toBe(note[field].trim())
      }
      expect(note.time, slug).toMatch(/O\(/)
      expect(note.space, slug).toMatch(/O\(/)
      // The insight is one or two plain sentences, and its first one doubles as a recall line.
      const sentences = note.insight.split(/\.\s/)
      expect(sentences.length, slug).toBeLessThanOrEqual(2)
      expect(sentences[0].length, slug).toBeLessThanOrEqual(130)
      expect(note.pitfalls.length, slug).toBeGreaterThanOrEqual(40)
    }
  })
})
