/** The "coach me" link: opens a new Claude chat primed as a hints-only interview coach. */
import { TOPIC_BY_ID } from '../data'
import type { Problem } from '../data/types'

const COACH_BRIEF = `Act as my interview coach for one LeetCode problem. I am practising problem-solving, not collecting solutions, so coach me with hints only.

How I want this to go:
1. First make sure I understand the question. Ask me to restate it and walk through a small example. Do not reveal any approach yet.
2. Ask for my brute-force idea and its complexity before anything else.
3. If I am stuck, give one small hint at a time, then wait for me. Start with a question that points at the constraint I am missing.
4. Do not reveal the optimal approach, name the pattern, or write code unless I explicitly ask for it.
5. When I have a working solution, have me explain why it is correct, state its time and space complexity, and name the clues in the problem statement that identify the pattern.

Keep replies short. Ask one thing at a time.`

export function coachPrompt(problem: Problem): string {
  const topic = TOPIC_BY_ID[problem.topic]
  return [
    COACH_BRIEF,
    '',
    `Problem: ${problem.title} (LeetCode ${problem.number}, ${problem.difficulty})`,
    `URL: ${problem.url}`,
    `Where it sits in my study plan: ${topic.name}. Do not treat that as a hint to give me.`,
    'My language: Python',
  ].join('\n')
}

export function coachUrl(problem: Problem): string {
  return `https://claude.ai/new?q=${encodeURIComponent(coachPrompt(problem))}`
}
