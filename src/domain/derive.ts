/**
 * One pass from the stored document to everything the screens read.
 * Cheap enough (150 problems, a few thousand log entries) to redo on every change.
 */
import { PROBLEMS, TOPICS } from '../data'
import type { AppData, ISODate } from '../state/schema'
import { buildDrillStats } from './drill'
import { buildForecast } from './forecast'
import { viewProblem } from './problemView'
import { buildQueue } from './queue'
import { buildSuggestion, recommendNext } from './recommend'
import { buildTopicViews } from './roadmap'
import { viewSession } from './session'
import { buildActivity, buildCounts, buildDifficulty, buildMistakes, buildPlan, buildStreak } from './stats'
import type { Derived, ProblemView } from './types'

export function derive(data: AppData, today: ISODate): Derived {
  const list: ProblemView[] = PROBLEMS.map((problem) =>
    viewProblem(problem, data.problems[problem.slug] ?? null, today),
  )
  const problems: Record<string, ProblemView> = Object.fromEntries(list.map((v) => [v.problem.slug, v]))

  const { settings } = data
  const drill = buildDrillStats(data.drills, today, data.drillArchive)
  const topics = buildTopicViews(list, drill, settings.targets)
  const counts = buildCounts(list)
  const queue = buildQueue(list, today, settings.dailyReviewCap)
  const recommendations = recommendNext(topics)
  const activity = buildActivity(list)
  const session = viewSession(data.session, problems, drill.today, today)

  return {
    today,
    problems,
    list,
    topics,
    topicList: TOPICS.map((t) => topics[t.id]),
    counts,
    queue,
    recommendations,
    suggestion: buildSuggestion({ topics, queue, counts, drill, recommendations, session }),
    session,
    plan: buildPlan(list, settings, today),
    streak: buildStreak(activity, today),
    activity,
    forecast: buildForecast(list, today, settings.dailyReviewCap),
    mistakes: buildMistakes(list),
    difficulty: buildDifficulty(list, settings.targets),
    drill,
    activeMock: data.mocks.find((m) => m.status === 'running' || m.status === 'review') ?? null,
  }
}

/** Remembers the last result, so components that ask in the same render share one computation. */
let memo: { data: AppData; today: ISODate; derived: Derived } | null = null

export function deriveCached(data: AppData, today: ISODate): Derived {
  if (memo && memo.data === data && memo.today === today) return memo.derived
  const derived = derive(data, today)
  memo = { data, today, derived }
  return derived
}
