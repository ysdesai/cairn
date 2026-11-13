/**
 * The demo history: about ten weeks of realistic, varied use, generated relative to `today`
 * so every chart looks current whenever it is loaded. Deterministic for a given seed.
 *
 * The history is not written out as data. A simulated learner works through the NeetCode 150
 * day by day, and every action goes through the same reducers the app uses, so the document is
 * exactly what the app would have produced. All randomness comes from one seeded generator.
 *
 * The learner: strong at Arrays & Hashing and Two Pointers, fights Sliding Window and Linked
 * List, mixed everywhere else. Revisions are done earliest-due first, up to the daily cap, with a
 * few light days and a four or five day break. Nothing is logged on `today` itself.
 *
 * What the screens will show: a topic's strength needs a solved problem, so the topics the
 * learner has not reached are uncharted. Of the topics reached, Sliding Window and Linked List
 * land between 38 and 54 and the strong ones above 76; `briefMiss` rejects a seed that misses.
 *
 * The content depends on `today` and `seed` only. `now` becomes `updatedAt` and nothing else: the
 * attempts, ratings, notes, drills and mocks are the same at 6 am and at 11 pm, and every
 * timestamp is derived from the date and the seed, never from the clock.
 */
import { getProblem, PATTERN_BY_ID, PATTERNS, PROBLEMS, PROBLEMS_BY_TOPIC, ROADMAP_ORDER } from '../data'
import type { Difficulty, PatternId, Problem, TopicId } from '../data/types'
import {
  createEmptyData,
  endMock,
  logAttempt,
  markMockProblem,
  rateMock,
  recordDrill,
  setNotes,
  setOnboarded,
  startMock,
  updateSettings,
} from '../state/reducers'
import type { AttemptInput } from '../state/reducers'
import { MISTAKE_TAGS } from '../state/schema'
import type {
  AppData,
  DrillResult,
  ISODate,
  MistakeTag,
  MockConfig,
  MockResult,
  Rating,
} from '../state/schema'
import { addDays, weekdayIndex } from './dates'
import { DEMO_NOTES } from './demoNotes'
import type { DemoNote } from './demoNotes'
import { derive } from './derive'
import { buildDrillStats, drillOptions, nextDrillCard } from './drill'
import { hashString, mulberry32, pick, pickWeighted, randInt, shuffle } from './rng'
import type { Rng } from './rng'
import { replay } from './srs'
import type { SrsState } from './types'

const HOUR_MS = 3_600_000
const MINUTE_MS = 60_000

/** Days simulated before today. Today is day 69 and stays empty. */
const HISTORY_DAYS = 69
const PLAN_DAYS_AHEAD = 98

// ---------------------------------------------------------------------------------------------
// The learner

type Profile = 'strong' | 'mixed' | 'weak'
type Odds = readonly [easy: number, struggled: number, help: number]

const TOPIC_PROFILE: Partial<Record<TopicId, Profile>> = {
  'arrays-hashing': 'strong',
  'two-pointers': 'strong',
  'sliding-window': 'weak',
  'linked-list': 'weak',
}

const profileOf = (topic: TopicId): Profile => TOPIC_PROFILE[topic] ?? 'mixed'

/** How a first solve goes, by topic profile and difficulty: [easy, struggled, help]. */
const FIRST_ODDS: Record<Profile, Record<Difficulty, Odds>> = {
  strong: { easy: [0.92, 0.07, 0.01], medium: [0.85, 0.13, 0.02], hard: [0.62, 0.28, 0.1] },
  mixed: { easy: [0.55, 0.32, 0.13], medium: [0.17, 0.46, 0.37], hard: [0.06, 0.34, 0.6] },
  weak: { easy: [0.22, 0.46, 0.32], medium: [0.05, 0.37, 0.58], hard: [0.02, 0.28, 0.7] },
}

/** How a revision goes, by topic profile and how the previous attempt went. */
const REVISION_ODDS: Record<Profile, Record<Rating, Odds>> = {
  strong: { easy: [0.96, 0.035, 0.005], struggled: [0.85, 0.14, 0.01], help: [0.65, 0.32, 0.03] },
  mixed: { easy: [0.78, 0.2, 0.02], struggled: [0.55, 0.37, 0.08], help: [0.35, 0.48, 0.17] },
  weak: { easy: [0.09, 0.53, 0.38], struggled: [0.04, 0.58, 0.38], help: [0.03, 0.55, 0.42] },
}

/** Minutes as a multiple of the difficulty's target, by how the attempt went. */
const MINUTE_FACTOR: Record<Rating, readonly [number, number]> = {
  easy: [0.45, 0.9],
  struggled: [1.0, 1.6],
  help: [1.2, 2.0],
}

const TIMED_SHARE = 0.85
const TAGGED_SHARE = 0.7
const NOTES_SHARE = 0.7

const TAG_IDS: readonly MistakeTag[] = MISTAKE_TAGS.map((t) => t.id)
const TAG_WEIGHT: Record<MistakeTag, number> = {
  'off-by-one': 28,
  'edge-case': 28,
  bug: 10,
  'wrong-pattern': 9,
  complexity: 9,
  'out-of-time': 6,
  misread: 6,
  blanked: 6,
}

/** Drill accuracy the learner really has for the patterns they find hard. */
const WEAK_PATTERNS: readonly (readonly [PatternId, number])[] = [
  ['monotonic-stack', 0.38],
  ['search-on-answer', 0.4],
  ['sliding-window', 0.26],
  ['linked-list', 0.42],
  ['fast-slow', 0.42],
]

/** Every problem in the order the roadmap suggests. */
const ROADMAP_PROBLEMS: readonly Problem[] = ROADMAP_ORDER.flatMap((topic) => PROBLEMS_BY_TOPIC[topic])

// ---------------------------------------------------------------------------------------------
// The calendar: which days are active and what each one holds

interface Rhythm {
  active: boolean[]
  weekend: boolean[]
  /** Days when only one or two of the due revisions get done. */
  lightDays: Set<number>
  mockDays: number[]
}

function planRhythm(rng: Rng, startDate: ISODate): Rhythm {
  const weekend = Array.from({ length: HISTORY_DAYS }, (_, i) => weekdayIndex(addDays(startDate, i)) >= 5)
  const inRange = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)

  // The break falls in week five, and the days around it are fixed so that the streaks come out
  // right: a long run before the break, one empty day, then the last nine days all active.
  const breakStart = randInt(rng, 28, 31)
  const off = new Set<number>(inRange(breakStart, breakStart + randInt(rng, 4, 5) - 1))
  off.add(HISTORY_DAYS - 10)
  const forced = new Set<number>([
    0,
    ...inRange(breakStart - 11, breakStart - 1),
    ...inRange(HISTORY_DAYS - 9, HISTORY_DAYS - 1),
  ])

  // One mock in each of weeks 4, 7 and 9, on a weekend day when the week has one.
  const mockDays = [inRange(21, 27), inRange(42, 48), inRange(56, 62)].map((week) => {
    const open = week.filter((d) => !off.has(d))
    const weekendDays = open.filter((d) => weekend[d])
    return pick(rng, weekendDays.length > 0 ? weekendDays : open)
  })
  for (const day of mockDays) forced.add(day)

  // The other quiet days, mostly at weekends. Each stands alone: a day next to the break or to
  // another quiet day would stretch it into a second break.
  const pool = new Set(inRange(0, HISTORY_DAYS - 1).filter((d) => !forced.has(d) && !off.has(d)))
  const isolate = (day: number) => [day - 1, day, day + 1].forEach((d) => pool.delete(d))
  for (const day of off) isolate(day)
  const quiet = randInt(rng, 10, 13)
  for (let n = 0; n < quiet && pool.size > 0; n++) {
    // Seven in twelve fall on a weekend, though weekends are under a third of the days. People
    // are keenest at the start, so the first two weeks lose fewer days.
    const wantWeekend = n % 12 < 7
    const open = [...pool].filter((d) => weekend[d] === wantWeekend)
    const day = pickWeighted(rng, open.length > 0 ? open : [...pool], (d) => (d < 14 ? 0.35 : 1))
    off.add(day)
    isolate(day)
  }
  const active = inRange(0, HISTORY_DAYS - 1).map((d) => !off.has(d))

  // A few busy days in the middle, and most of the last five: fewer revisions done than are due.
  const middle = inRange(32, 57).filter((d) => active[d] && !mockDays.includes(d))
  const lightDays = new Set<number>(shuffle(rng, middle).slice(0, 3))
  for (const day of inRange(HISTORY_DAYS - 4, HISTORY_DAYS - 1)) lightDays.add(day)
  if (rng() < 0.4) lightDays.add(HISTORY_DAYS - 5)

  return { active, weekend, lightDays, mockDays }
}

/** Most new problems a day can take: none on a mock day, two at weekends, otherwise three. */
const newLimit = (rhythm: Rhythm, day: number) => (rhythm.mockDays.includes(day) ? 0 : rhythm.weekend[day] ? 2 : 3)

/** New problems per day. At most two on weekends, none on mock days, and summing to `total`. */
function planNewCounts(rng: Rng, rhythm: Rhythm, total: number): number[] {
  // The first day gets going with two, and the last few days always add something new, which
  // comes back for revision just as the backlog is building.
  const floor = (d: number) => (d === 0 ? 2 : d >= HISTORY_DAYS - 4 ? 1 : 0)
  const days = rhythm.active.flatMap((on, d) => (on ? [d] : []))

  const counts: number[] = Array.from({ length: HISTORY_DAYS }, () => 0)
  for (const d of days) {
    // Keenest in the first week, settling into a steadier pace after the third.
    const odds =
      d < 7 ? [1.5, 3.5, 3.5, 1.5] : rhythm.weekend[d] ? [4, 4, 1, 0] : d < 21 ? [1.5, 4, 3.5, 1] : [2, 4, 3, 0.8]
    const wanted = pickWeighted(rng, [0, 1, 2, 3], (n) => odds[n])
    counts[d] = Math.max(floor(d), Math.min(newLimit(rhythm, d), wanted))
  }

  let sum = counts.reduce((a, b) => a + b, 0)
  while (sum > total) {
    const droppable = days.filter((d) => counts[d] > floor(d))
    counts[pickWeighted(rng, droppable, (d) => counts[d])]--
    sum--
  }
  while (sum < total) {
    const roomy = days.filter((d) => counts[d] < newLimit(rhythm, d))
    counts[pickWeighted(rng, roomy, (d) => (rhythm.weekend[d] ? 0.3 : 1))]++
    sum++
  }
  return counts
}

/** Cards per drill day: runs of 4 to 12 on about forty of the active days, ~260 cards in all. */
function planDrillRuns(rng: Rng, rhythm: Rhythm): Map<number, number> {
  const candidates = rhythm.active.flatMap((on, d) => (on && d >= 5 && !rhythm.mockDays.includes(d) ? [d] : []))
  const days = shuffle(rng, candidates)
    .slice(0, randInt(rng, 38, 42))
    .sort((a, b) => a - b)
  const sizes = [4, 5, 6, 7, 8, 9, 10, 11, 12]
  const weights = [4, 5, 5, 4, 3, 2, 1, 1, 0.5]
  const runs = new Map(days.map((d) => [d, pickWeighted(rng, sizes, (n) => weights[n - 4])]))

  const wanted = randInt(rng, 250, 270)
  let sum = [...runs.values()].reduce((a, b) => a + b, 0)
  while (sum !== wanted) {
    const grow = sum < wanted
    const open = days.filter((d) => (grow ? runs.get(d)! < 12 : runs.get(d)! > 4))
    const day = pick(rng, open)
    runs.set(day, runs.get(day)! + (grow ? 1 : -1))
    sum += grow ? 1 : -1
  }
  return runs
}

// ---------------------------------------------------------------------------------------------
// Simulation state

interface Sim {
  rng: Rng
  today: ISODate
  targets: Record<Difficulty, number>
  /** 0…1 through the history, so rare tags can be topped up late. */
  progress: number
  solved: Set<string>
  peeksLeft: number
  /** First solves with notes available, and how many of them got notes. */
  noteable: { seen: number; noted: number }
  /** Attempts logged by the learner's own sessions, and how many were timed. */
  attempts: { seen: number; timed: number }
  /** Attempts rated struggled or help, and how many of them carry mistake tags. */
  notEasy: { seen: number; tagged: number }
  tagCounts: Record<MistakeTag, number>
  drillLog: DrillResult[]
  patternTally: Map<PatternId, { seen: number; correct: number }>
  patternSkill: Record<PatternId, { skill: number; phase: number }>
}

interface AttemptStep {
  kind: 'attempt'
  slug: string
  input: AttemptInput
  /** Minutes the work took, whether or not the learner timed it. */
  workMinutes: number
  notes: DemoNote | null
}

interface DrillStep {
  kind: 'drill'
  result: Omit<DrillResult, 'at' | 'date'>
}

interface MockPlan {
  config: MockConfig
  slugs: string[]
  /** Minutes into the mock when each finished problem was marked, by slug. */
  marks: Record<string, number>
  results: Record<string, MockResult>
  /** Minutes the mock clock ran. */
  clockMinutes: number
}

interface MockStep {
  kind: 'mock'
  plan: MockPlan
}

type Step = AttemptStep | DrillStep | MockStep

// ---------------------------------------------------------------------------------------------
// Ratings, minutes, mistakes, recall

function normalize(odds: readonly number[]): Odds {
  const [easy, struggled, help] = odds.map((n) => Math.max(0.005, n))
  const sum = easy + struggled + help
  return [easy / sum, struggled / sum, help / sum]
}

function oddsFor(problem: Problem, srs: SrsState | null): Odds {
  const profile = profileOf(problem.topic)
  if (!srs) return FIRST_ODDS[profile][problem.difficulty]

  let [easy, struggled, help] = REVISION_ODDS[profile][srs.lastRating]
  if (problem.difficulty === 'hard') {
    easy -= 0.08
    help += 0.05
  } else if (problem.difficulty === 'easy') {
    easy += 0.04
    help -= 0.02
  }
  // Each revision makes the next one easier, even in a topic the learner fights, so no problem
  // is stuck in a loop of lapses. After a second lapse the learner goes back to the written
  // solution, so a third is rare.
  const practice = Math.min(srs.reviews, 5) * (profile === 'weak' ? 0.25 : 1)
  easy += 0.05 * practice
  help *= 1 - 0.12 * practice
  help /= 1 + 0.25 * Math.max(0, srs.lapses - 1)
  // The first problems are the ones that get mastered: the learner knows them cold.
  if (profile === 'strong' && problem.order <= 12 && srs.lastRating === 'easy') easy = Math.max(easy, 0.97)
  // By the seventh revision it has finally clicked (the ninth, in a topic the learner fights).
  if (srs.reviews >= (profile === 'weak' ? 8 : 6)) return [0.85, 0.13, 0.02]
  return normalize([easy, struggled, help])
}

function rollRating(rng: Rng, [easy, struggled]: Odds): Rating {
  const roll = rng()
  return roll < easy ? 'easy' : roll < easy + struggled ? 'struggled' : 'help'
}

/** Minutes the work took, whether or not the learner timed it. */
function rollMinutes(sim: Sim, problem: Problem, rating: Rating, revision: boolean): number {
  const [low, high] = MINUTE_FACTOR[rating]
  const weak = profileOf(problem.topic) === 'weak'
  // In the topics the learner fights, times sit toward the slow end of each range.
  const spread = weak ? Math.sqrt(sim.rng()) : sim.rng()
  let minutes = sim.targets[problem.difficulty] * (low + (high - low) * spread)
  if (weak) minutes *= 1.6
  // A revision is mostly recall, so it takes about half as long.
  if (revision) minutes *= 0.4 + 0.2 * sim.rng()
  return clamp(Math.round(minutes), 2, 95)
}

/** About 85% of attempts are timed. The count owed is tracked, so the share holds on any run. */
function rollTimed(sim: Sim): boolean {
  const owed = TIMED_SHARE * (sim.attempts.seen + 1) - sim.attempts.timed
  sim.attempts.seen++
  const timed = sim.rng() < clamp(owed, 0, 1)
  if (timed) sim.attempts.timed++
  return timed
}

function rollMistakes(
  sim: Sim,
  problem: Problem,
  rating: Rating,
  revision: boolean,
  minutes: number,
): MistakeTag[] {
  if (rating === 'easy') return []
  // About 70% of the attempts that did not go well are tagged. The count owed is tracked as it
  // goes, so the share holds however few attempts there are, with the dice picking which ones.
  const owed = TAGGED_SHARE * (sim.notEasy.seen + 1) - sim.notEasy.tagged
  sim.notEasy.seen++
  if (sim.rng() >= clamp(owed, 0, 1)) return []
  sim.notEasy.tagged++
  const weak = profileOf(problem.topic) === 'weak'
  const slow = minutes > 1.4 * sim.targets[problem.difficulty]

  const weight = (tag: MistakeTag): number => {
    let w = TAG_WEIGHT[tag]
    // Wrong-pattern mistakes cluster in the hard topics, on hard problems, and on first solves.
    if (tag === 'wrong-pattern') {
      w *= (weak ? 3.5 : 0.35) * (problem.difficulty === 'hard' ? 1.5 : 1) * (revision ? 0.5 : 1)
    }
    if (tag === 'blanked') w *= rating === 'help' ? 2 : 0.5
    if (tag === 'out-of-time') w *= slow ? 3 : 0.5
    if (tag === 'complexity') w *= revision ? 0.6 : 1.3
    if (tag === 'bug') w *= revision ? 1.3 : 1
    // Late in the history, top up any tag that has hardly shown up.
    if (sim.progress > 0.5 && sim.tagCounts[tag] < 3) w *= 4
    return w
  }

  const tags = [pickWeighted(sim.rng, TAG_IDS, weight)]
  if (sim.rng() < 0.3) tags.push(pickWeighted(sim.rng, TAG_IDS.filter((t) => t !== tags[0]), weight))
  for (const tag of tags) sim.tagCounts[tag]++
  return tags
}

/** The first sentence of the notes' insight, without its final period. */
function ideaOf(problem: Problem): string {
  const note = DEMO_NOTES[problem.slug]
  if (!note) return `Use ${problem.tags[0] ?? 'the standard pattern'}`
  const end = note.insight.search(/\.\s/)
  return (end < 0 ? note.insight : note.insight.slice(0, end)).replace(/\.$/, '')
}

const withArticle = (word: string) => `${word === 'easy' ? 'an' : 'a'} ${word}`

/** The idea up to its first comma, when that is a short clause that makes sense on its own. */
function openingClause(idea: string): string | null {
  for (const match of idea.matchAll(/, /g)) {
    const head = idea.slice(0, match.index)
    const balanced = (head.match(/\(/g)?.length ?? 0) === (head.match(/\)/g)?.length ?? 0)
    if (head.length >= 25 && head.length <= 90 && balanced) return head
  }
  return null
}

/** What the learner typed from memory: complete when it went well, partial or wrong after a lapse. */
function recallFor(sim: Sim, problem: Problem, rating: Rating): string {
  const idea = ideaOf(problem)
  const pattern = PATTERN_BY_ID[problem.pattern].name
  if (rating === 'easy') return `${idea}.`
  if (rating === 'struggled') {
    // Only the first part came back.
    const lead = pick(sim.rng, ['Roughly: ', 'Something like: ', 'Main idea: '])
    const head = openingClause(idea) ?? problem.tags[0] ?? pattern.toLowerCase()
    const tail = pick(sim.rng, [
      ', then I blanked on the details.',
      ', but I forgot the rest.',
      ', and I had to rebuild the rest.',
    ])
    return `${lead}${head}${tail}`
  }
  // A lapse: a wrong first guess, or nothing useful at all.
  const decoy = problem.decoys.find((id) => id !== problem.pattern && !problem.alt?.includes(id))
  const lapses = [
    `Only the keyword "${problem.tags[0] ?? pattern.toLowerCase()}" came back and nothing else.`,
    `Could not remember the trick, just that it is ${withArticle(problem.difficulty)} one.`,
    decoy
      ? `Reached for ${PATTERN_BY_ID[decoy].name.toLowerCase()} first, which was wrong. Did not recall the real idea.`
      : 'Blanked on the idea.',
  ]
  return pick(sim.rng, lapses)
}

function wantsNotes(sim: Sim, problem: Problem, rating: Rating): boolean {
  if (!DEMO_NOTES[problem.slug]) return false
  // About 70% of solved problems get notes. The count owed is tracked as it goes, so the share
  // holds whatever the dice do. A first solve that needed help is always written up.
  const owed = NOTES_SHARE * (sim.noteable.seen + 1) - sim.noteable.noted
  sim.noteable.seen++
  const noted = rating === 'help' || sim.rng() < clamp(owed, 0, 1)
  if (noted) sim.noteable.noted++
  return noted
}

function attemptStep(sim: Sim, problem: Problem, srs: SrsState | null, date: ISODate): AttemptStep {
  const revision = srs !== null
  const rating = rollRating(sim.rng, oddsFor(problem, srs))
  const workMinutes = rollMinutes(sim, problem, rating, revision)
  const input: AttemptInput = {
    rating,
    date,
    minutes: rollTimed(sim) ? workMinutes : null,
    mistakes: rollMistakes(sim, problem, rating, revision, workMinutes),
  }
  if (revision && sim.rng() < 0.5) input.recall = recallFor(sim, problem, rating)

  let notes: DemoNote | null = null
  if (!revision && wantsNotes(sim, problem, rating)) {
    notes = DEMO_NOTES[problem.slug]
  }
  return { kind: 'attempt', slug: problem.slug, input, workMinutes, notes }
}

// ---------------------------------------------------------------------------------------------
// Choosing what to work on

/** The next new problem: roadmap order, with now and then a peek at the next topic's first. */
function nextNewProblem(sim: Sim): Problem | null {
  const unsolved = ROADMAP_PROBLEMS.filter((p) => !sim.solved.has(p.slug))
  if (unsolved.length === 0) return null

  const current = unsolved[0].topic
  const left = unsolved.filter((p) => p.topic === current).length
  if (sim.peeksLeft > 0 && left >= 2 && left <= 3 && sim.rng() < 0.12) {
    const ahead = unsolved.find((p) => p.topic !== current)
    if (ahead && ahead.indexInTopic === 1) {
      sim.peeksLeft--
      return ahead
    }
  }
  return unsolved[0]
}

/** Problems whose revision date has come, earliest due first. */
function dueRevisions(data: AppData, date: ISODate): { problem: Problem; srs: SrsState }[] {
  const due: { problem: Problem; srs: SrsState }[] = []
  for (const [slug, record] of Object.entries(data.problems)) {
    const problem = getProblem(slug)
    const srs = problem ? replay(record.attempts) : null
    if (problem && srs && srs.due !== null && srs.due <= date) due.push({ problem, srs })
  }
  return due.sort((a, b) => {
    const byDue = a.srs.due! < b.srs.due! ? -1 : a.srs.due! > b.srs.due! ? 1 : 0
    return byDue || a.problem.order - b.problem.order
  })
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

function drillSteps(sim: Sim, date: ISODate, count: number): DrillStep[] {
  const steps: DrillStep[] = []
  for (let n = 0; n < count; n++) {
    const stats = buildDrillStats(sim.drillLog, sim.today)
    const recent = sim.drillLog.slice(-4).map((d) => d.slug)
    const problem = nextDrillCard({ stats, pool: PROBLEMS, recent, rng: sim.rng })
    if (!problem) break

    const answer = problem.pattern
    const tally = sim.patternTally.get(answer) ?? { seen: 0, correct: 0 }
    // The learner's real skill shows as a steady share of right answers: each pattern keeps a
    // running count that tracks skill x cards seen, offset by its own phase so the misses fall at
    // different cards. A handful of cards still reads as that skill rather than as dice.
    const { skill, phase } = sim.patternSkill[answer]
    const correct = Math.floor(skill * (tally.seen + 1) + phase) > Math.floor(skill * tally.seen + phase)
    const picked = correct ? answer : pick(sim.rng, drillOptions(problem, sim.rng).filter((o) => o !== answer))
    const ms = correct ? randInt(sim.rng, 2800, 9500) : randInt(sim.rng, 5500, 15800)

    sim.patternTally.set(answer, { seen: tally.seen + 1, correct: tally.correct + (correct ? 1 : 0) })
    sim.drillLog.push({ at: 0, date, slug: problem.slug, answer, picked, correct, ms })
    steps.push({ kind: 'drill', result: { slug: problem.slug, answer, picked, correct, ms } })
  }
  return steps
}

// ---------------------------------------------------------------------------------------------
// Mock interviews

interface MockScript {
  mix: MockConfig['mix']
  pool: MockConfig['pool']
  topics: TopicId[]
  minutes: number
  /** How each of the two problems goes. */
  outcomes: readonly [Rating, Rating | 'unfinished']
  difficulties: readonly [Difficulty, Difficulty]
}

const MOCK_SCRIPTS: readonly MockScript[] = [
  {
    mix: 'medium-medium',
    pool: 'solved',
    topics: [],
    minutes: 60,
    outcomes: ['struggled', 'help'],
    difficulties: ['medium', 'medium'],
  },
  {
    mix: 'easy-medium',
    pool: 'solved',
    topics: ['two-pointers', 'stack', 'binary-search'],
    minutes: 30,
    outcomes: ['easy', 'struggled'],
    difficulties: ['easy', 'medium'],
  },
  {
    mix: 'medium-hard',
    pool: 'any',
    topics: [],
    minutes: 45,
    outcomes: ['struggled', 'unfinished'],
    difficulties: ['medium', 'hard'],
  },
]

/** Two problems for a mock: solved ones for most, and a hard one still ahead for the last. */
function pickMockProblems(
  sim: Sim,
  data: AppData,
  script: MockScript,
  busy: Set<string>,
  date: ISODate,
): { problems: Problem[]; topics: TopicId[] } {
  const isSolved = (p: Problem) => Object.hasOwn(data.problems, p.slug) && data.problems[p.slug].attempts.length > 0
  const available = PROBLEMS.filter((p) => isSolved(p) && !busy.has(p.slug))

  // A mock is best spent on problems whose revision has come, so prefer those where there are any.
  const isDue = (p: Problem) => {
    const due = Object.hasOwn(data.problems, p.slug) ? replay(data.problems[p.slug].attempts)?.due : null
    return due !== null && due !== undefined && due <= date
  }
  const choose = (difficulty: Difficulty, from: readonly Problem[], taken: Problem[]): Problem | null => {
    const matching = from.filter((p) => p.difficulty === difficulty && !taken.includes(p))
    const exact = matching.some(isDue) ? matching.filter(isDue) : matching
    const fresh = exact.filter((p) => taken.every((t) => t.topic !== p.topic))
    const options = fresh.length > 0 ? fresh : exact
    return options.length > 0 ? pick(sim.rng, options) : null
  }

  const ahead = ROADMAP_PROBLEMS.filter((p) => !sim.solved.has(p.slug))
  for (const topics of [script.topics, []]) {
    const from = available.filter((p) => topics.length === 0 || topics.includes(p.topic))
    const first = choose(script.difficulties[0], from, [])
    if (!first) continue
    const second =
      script.pool === 'any'
        ? choose(script.difficulties[1], ahead.slice(0, 20), [first])
        : choose(script.difficulties[1], from, [first])
    if (second) return { problems: [first, second], topics }
  }
  // Not enough variety yet: take whatever is closest.
  const [first, second] = shuffle(sim.rng, available)
  return { problems: [first, second], topics: [] }
}

function planMock(sim: Sim, data: AppData, index: number, busy: Set<string>, date: ISODate): MockPlan {
  const script = MOCK_SCRIPTS[index]
  const { problems, topics } = pickMockProblems(sim, data, script, busy, date)
  const config: MockConfig = { mix: script.mix, pool: script.pool, topics, minutes: script.minutes }

  const finished = problems.flatMap((problem, i) => {
    const outcome = script.outcomes[i]
    return outcome === 'unfinished' ? [] : [{ problem, rating: outcome }]
  })
  const solveMinutes = finished.map(({ problem, rating }) => rollMinutes(sim, problem, rating, false))
  // The two attempts share one clock, so squeeze them into the time the mock allows.
  const scale = Math.min(1, (config.minutes - 3) / solveMinutes.reduce((a, b) => a + b, 0))

  const marks: Record<string, number> = {}
  const results: Record<string, MockResult> = {}
  let elapsed = 0
  finished.forEach(({ problem, rating }, i) => {
    const spent = Math.max(2, Math.round(solveMinutes[i] * scale))
    elapsed += spent
    marks[problem.slug] = elapsed
    const mistakes = rollMistakes(sim, problem, rating, false, spent)
    results[problem.slug] = { outcome: rating, minutes: spent, mistakes }
  })
  // Time ran out on the unfinished one.
  problems.forEach((problem, i) => {
    if (script.outcomes[i] === 'unfinished') {
      results[problem.slug] = { outcome: 'unfinished', minutes: null, mistakes: ['out-of-time'] }
    }
  })

  const allDone = finished.length === problems.length
  return {
    config,
    slugs: problems.map((p) => p.slug),
    marks,
    results,
    clockMinutes: allDone ? elapsed + 1 : config.minutes,
  }
}

// ---------------------------------------------------------------------------------------------
// One day

function planDay(
  sim: Sim,
  data: AppData,
  rhythm: Rhythm,
  day: number,
  date: ISODate,
  newCounts: number[],
  drillCards: number,
): Step[] {
  const newCount = newCounts[day]
  const steps: Step[] = []
  const busy = new Set<string>()

  const due = dueRevisions(data, date)
  const limit = rhythm.lightDays.has(day) ? pickWeighted(sim.rng, [1, 2], (n) => n) : data.settings.dailyReviewCap
  for (const { problem, srs } of due.slice(0, limit)) {
    busy.add(problem.slug)
    steps.push(attemptStep(sim, problem, srs, date))
  }

  // An active day always has something in it. If nothing is due and nothing new was planned,
  // take one new problem and let a later day give it back, so the total stays on plan.
  const mockIndex = rhythm.mockDays.indexOf(day)
  let newToday = newCount
  if (steps.length === 0 && newCount === 0 && mockIndex < 0) {
    newToday = 1
    const later = newCounts.findIndex((n, d) => d > day && n > 0)
    if (later >= 0) newCounts[later]--
  }
  // An evening is not endless: once a couple of hours of work are planned, the rest of the new
  // problems wait for a later day.
  let work = steps.reduce((sum, step) => sum + (step.kind === 'attempt' ? step.workMinutes : 0), 0)
  const workBudget = rhythm.weekend[day] ? 150 : 120
  // The next active day with room, a weekday if one is close by, since weekends stay light.
  const laterDay = () => {
    const room = (d: number) => d > day && rhythm.active[d] && newCounts[d] < newLimit(rhythm, d)
    const weekdays = newCounts.findIndex((_, d) => room(d) && !rhythm.weekend[d])
    return weekdays >= 0 && weekdays - day <= 4 ? weekdays : newCounts.findIndex((_, d) => room(d))
  }
  for (let n = 0; n < newToday; n++) {
    const later = work >= workBudget ? laterDay() : -1
    if (later >= 0) {
      newCounts[later]++
      continue
    }
    const problem = nextNewProblem(sim)
    if (!problem) break
    busy.add(problem.slug)
    const step = attemptStep(sim, problem, null, date)
    work += step.workMinutes
    steps.push(step)
    sim.solved.add(problem.slug)
  }

  steps.push(...drillSteps(sim, date, drillCards))

  if (mockIndex >= 0) steps.push({ kind: 'mock', plan: planMock(sim, data, mockIndex, busy, date) })
  return steps
}

/** Milliseconds a step takes before it is logged (lead) and the pause after it (tail). */
function timing(step: Step): { lead: number; tail: number } {
  switch (step.kind) {
    case 'attempt':
      // Notes are typed half a minute after the attempt is logged.
      return { lead: step.workMinutes * MINUTE_MS, tail: step.notes ? 75_000 : 45_000 }
    case 'drill':
      return { lead: step.result.ms, tail: 1_500 }
    case 'mock': {
      const finished = Object.keys(step.plan.marks).length
      // Setup first; afterwards the clock, the rating screen and the nudges between attempts.
      return { lead: 90_000, tail: step.plan.clockMinutes * MINUTE_MS + 150_000 + finished * 1_000 + 60_000 }
    }
  }
}

/** Moves the latest attempt on a problem to a new timestamp. */
function retimeLastAttempt(data: AppData, slug: string, at: number): AppData {
  const record = data.problems[slug]
  const attempts = record.attempts.map((a, i) => (i === record.attempts.length - 1 ? { ...a, at } : a))
  return { ...data, problems: { ...data.problems, [slug]: { ...record, attempts } } }
}

function applyMock(data: AppData, plan: MockPlan, date: ISODate, startAt: number): AppData {
  const endAt = startAt + plan.clockMinutes * MINUTE_MS
  const rateAt = endAt + 150_000

  let next = startMock(data, plan.config, plan.slugs, startAt)
  for (const slug of plan.slugs) {
    if (Object.hasOwn(plan.marks, slug)) next = markMockProblem(next, slug, startAt + plan.marks[slug] * MINUTE_MS)
  }
  next = endMock(next, endAt)
  next = rateMock(next, plan.results, date, rateAt)

  // rateMock stamps every attempt it logs with the same time; spread them a second apart
  // so each entry has its own place in the log.
  let k = 0
  for (const slug of plan.slugs) {
    if (Object.hasOwn(plan.marks, slug)) next = retimeLastAttempt(next, slug, rateAt + 1_000 * k++)
  }
  return next
}

function applyDay(
  sim: Sim,
  data: AppData,
  date: ISODate,
  steps: Step[],
  startsAt: (hour: number) => number,
): AppData {
  const weekend = weekdayIndex(date) >= 5
  const span = steps.reduce((sum, step) => sum + timing(step).lead + timing(step).tail, 0)
  // Evenings, a little earlier at weekends, and always finished before 10:45 pm.
  const earliest = weekend ? 16.5 : 17.5
  const latest = weekend ? 18.5 : 20
  const hour = clamp(Math.min(earliest + (latest - earliest) * sim.rng(), 22.75 - span / HOUR_MS), 8, 24)

  let cursor = Math.round(startsAt(hour))
  let next = data
  for (const step of steps) {
    const { lead, tail } = timing(step)
    cursor += lead
    switch (step.kind) {
      case 'attempt':
        next = logAttempt(next, step.slug, step.input, date, cursor)
        if (step.notes) {
          const { insight, time, space, pitfalls } = step.notes
          next = setNotes(next, step.slug, { insight, time, space, pitfalls }, cursor + 30_000)
        }
        break
      case 'drill':
        next = recordDrill(next, step.result, date, cursor)
        break
      case 'mock':
        next = applyMock(next, step.plan, date, cursor)
        break
    }
    cursor += tail
  }
  return next
}

// ---------------------------------------------------------------------------------------------
// The whole history

/**
 * The wall-clock time `hour` (a decimal, 17.5 is 5:30 pm) on a calendar day in the local zone.
 * Built from the date's own fields, so it lands on that day even where daylight saving moves
 * the clocks, and it never reads the clock.
 */
function localTime(date: ISODate, hour: number): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, Math.floor(hour), Math.round((hour % 1) * 60)).getTime()
}

/** Reducers mint random ids; give every attempt and mock one derived from when it happened. */
function withStableIds(data: AppData): AppData {
  const stableId = (label: string, at: number) =>
    (hashString(`${label}:${at}`).toString(36) + hashString(`${at}:${label}`).toString(36)).slice(0, 12).padEnd(12, '0')

  const problems: AppData['problems'] = {}
  for (const [slug, record] of Object.entries(data.problems)) {
    problems[slug] = { ...record, attempts: record.attempts.map((a) => ({ ...a, id: stableId(slug, a.at) })) }
  }
  return { ...data, problems, mocks: data.mocks.map((m) => ({ ...m, id: stableId('mock', m.startedAt) })) }
}

/** One simulated history for a seed, before the acceptance check (exported for the tests and the tuning). */
export function simulate(today: ISODate, now: number, seed: number): AppData {
  const rng = mulberry32(seed)
  const startDate = addDays(today, -HISTORY_DAYS)

  const rhythm = planRhythm(rng, startDate)
  const newTotal = randInt(rng, 59, 63)
  const newCounts = planNewCounts(rng, rhythm, newTotal)
  const drillRuns = planDrillRuns(rng, rhythm)

  const patternSkill = {} as Sim['patternSkill']
  for (const { id } of PATTERNS) patternSkill[id] = { skill: 0.78 + 0.17 * rng(), phase: rng() }
  for (const [id, skill] of WEAK_PATTERNS) patternSkill[id] = { skill: skill + 0.04 * (rng() - 0.5), phase: rng() }

  let data = createEmptyData(startDate, localTime(startDate, 0))
  data = updateSettings(data, { startDate, targetDate: addDays(today, PLAN_DAYS_AHEAD) }, data.createdAt)
  data = setOnboarded(data, true, data.createdAt)
  data = { ...data, demo: true }

  const sim: Sim = {
    rng,
    today,
    targets: data.settings.targets,
    progress: 0,
    solved: new Set(),
    peeksLeft: 2,
    noteable: { seen: 0, noted: 0 },
    attempts: { seen: 0, timed: 0 },
    notEasy: { seen: 0, tagged: 0 },
    tagCounts: Object.fromEntries(TAG_IDS.map((t) => [t, 0])) as Record<MistakeTag, number>,
    drillLog: [],
    patternTally: new Map(),
    patternSkill,
  }

  for (let day = 0; day < HISTORY_DAYS; day++) {
    if (!rhythm.active[day]) continue
    sim.progress = day / HISTORY_DAYS
    const date = addDays(startDate, day)
    const steps = planDay(sim, data, rhythm, day, date, newCounts, drillRuns.get(day) ?? 0)
    data = applyDay(sim, data, date, steps, (hour) => localTime(date, hour))
  }

  return { ...withStableIds(data), updatedAt: now }
}

/** Weekends are quieter: worked less often, and with fewer new problems on the days that are. */
function weekendsAreLighter(data: AppData): boolean {
  const worked = new Set<ISODate>(data.drills.map((x) => x.date))
  const newOn = new Map<ISODate, number>()
  for (const record of Object.values(data.problems)) {
    record.attempts.forEach((a, i) => {
      worked.add(a.date)
      // A problem's earliest attempt is its first solve.
      if (i === 0) newOn.set(a.date, (newOn.get(a.date) ?? 0) + 1)
    })
  }
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(data.settings.startDate, i))
  const group = (weekend: boolean) => days.filter((day) => (weekdayIndex(day) >= 5) === weekend)
  const rate = (weekend: boolean) => group(weekend).filter((day) => worked.has(day)).length / group(weekend).length
  const perDay = (weekend: boolean) => {
    const active = group(weekend).filter((day) => worked.has(day))
    return active.reduce((sum, day) => sum + (newOn.get(day) ?? 0), 0) / active.length
  }
  return rate(true) < rate(false) && perDay(true) < perDay(false)
}

/**
 * The headline numbers the brief promises. Returns what is missing, or null when all hold. A seed
 * that misses is skipped, so the history is realistic for every seed and every day it is loaded
 * on, not just a lucky few.
 */
/** What a generated document misses of the brief, or null (exported for the tests and the tuning). */
export function briefMiss(data: AppData, today: ISODate): string | null {
  const d = derive(data, today)
  const { queue } = d
  const overdue = [...queue.today, ...queue.waiting].filter((v) => (v.dueIn ?? 0) <= -2).length
  if (d.counts.solved < 56 || d.counts.solved > 66) return 'solved'
  const { streak, activity } = d
  if (streak.current !== 9 || streak.best <= 9 || activity.activeDays < 44 || activity.activeDays > 60) return 'streak'
  if (d.plan.status !== 'behind' && d.plan.status !== 'on-pace') return 'plan'
  if (!weekendsAreLighter(data)) return 'weekends'
  if (d.counts.mastered < 6) return 'mastered'
  if (queue.totalDue <= queue.cap || queue.waiting.length < 2 || overdue < 2 || queue.totalDue > 24) return 'backlog'
  if (d.mistakes.byTag.some((t) => t.count < 3)) return 'tags'
  if (d.mistakes.byTag.slice(0, 2).some((t) => t.tag !== 'off-by-one' && t.tag !== 'edge-case')) return 'top-tags'

  // Every rating makes up a real share of the history.
  const attempts = d.list.flatMap((v) => v.attempts)
  for (const rating of ['easy', 'struggled', 'help'] as const) {
    if (attempts.filter((a) => a.rating === rating).length < 0.16 * attempts.length) return `share-${rating}`
  }
  // Revisions go better than first solves on the whole.
  const score = (list: typeof attempts) =>
    list.reduce((sum, a) => sum + (a.rating === 'easy' ? 1 : a.rating === 'struggled' ? 0.55 : 0.15), 0) / list.length
  const revisions = score(d.list.flatMap((v) => v.attempts.slice(1)))
  if (revisions < score(d.list.flatMap((v) => v.attempts.slice(0, 1))) + 0.02) return 'revision-score'

  // Harder problems are rated worse than easy ones.
  const firstScore = (difficulty: string) => {
    const firsts = d.list.filter((v) => v.solved && v.problem.difficulty === difficulty).map((v) => v.attempts[0])
    return score(firsts)
  }
  if (firstScore('easy') < firstScore('medium') + 0.03) return 'difficulty'
  if (firstScore('medium') < firstScore('hard') + 0.03) return 'difficulty'

  // Weak spots and strengths show up in the topic scores and the drill.
  // A topic with nothing solved has no strength, and the two weak topics must have been started.
  const strength = (topic: TopicId) => d.topics[topic].strength ?? -1
  const hard = [strength('sliding-window'), strength('linked-list')]
  if (Math.min(...hard) < 38 || Math.max(...hard) > 54) return 'weak-strength'
  const strengths = d.topicList.flatMap((t) => (t.strength === null ? [] : [t.strength]))
  if (Math.min(...strengths) >= 55 || Math.max(...strengths) <= 75) return 'strength-range'
  const inTopics = (...ids: TopicId[]) => ids.flatMap((id) => d.topics[id].problems)
  const hardFirsts = inTopics('sliding-window', 'linked-list').map((v) => v.attempts[0].rating)
  if (hardFirsts.filter((r) => r !== 'easy').length < 0.65 * hardFirsts.length) return 'weak-firsts'
  if (strength('arrays-hashing') <= 76 || strength('two-pointers') <= 76) return 'strong-strength'
  const strongRatings = inTopics('arrays-hashing', 'two-pointers').flatMap((v) => v.attempts.map((a) => a.rating))
  if (strongRatings.filter((r) => r === 'easy').length < 0.8 * strongRatings.length) return 'strong-ratings'

  const tested = d.drill.byPattern.filter((p) => p.seen >= 5 && p.accuracy !== null)
  const named = (id: PatternId) => d.drill.byPattern.find((p) => p.pattern.id === id)!
  const weakNamed = [named('monotonic-stack'), named('search-on-answer')]
  if (weakNamed.some((p) => p.seen < 5 || (p.accuracy ?? 1) >= 0.56 || (p.accuracy ?? 0) < 0.3)) return 'weak-drill'
  if (tested.filter((p) => (p.accuracy ?? 1) < 0.56).length < 3) return 'weak-drill'
  if (tested.filter((p) => (p.accuracy ?? 0) > 0.72).length < 10) return 'strong-drill'
  return null
}

const MAX_TRIES = 40

/**
 * About ten weeks of believable use, ending the day before `today`, as a complete document.
 * Each day's entries fall on that day, in the evening, and `now` becomes the document's
 * `updatedAt`. The same `today`, `now` and `seed` always give a deep-equal result.
 */
export function generateDemoData(today: ISODate, now: number, seed: number = 7): AppData {
  let data = simulate(today, now, seed)
  // Each retry is a new, equally deterministic stream derived from the seed.
  for (let retry = 1; retry < MAX_TRIES && briefMiss(data, today) !== null; retry++) {
    data = simulate(today, now, (seed + Math.imul(retry, 0x9e3779b1)) >>> 0)
  }
  return data
}
