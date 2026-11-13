import type { ProblemDetail } from '../types'
import { details as arraysHashing } from './arrays-hashing'
import { details as twoPointers } from './two-pointers'
import { details as slidingWindow } from './sliding-window'
import { details as stack } from './stack'
import { details as binarySearch } from './binary-search'
import { details as linkedList } from './linked-list'
import { details as trees } from './trees'
import { details as tries } from './tries'
import { details as heap } from './heap'
import { details as backtracking } from './backtracking'
import { details as graphs } from './graphs'
import { details as advancedGraphs } from './advanced-graphs'
import { details as dp1d } from './dp-1d'
import { details as dp2d } from './dp-2d'
import { details as greedy } from './greedy'
import { details as intervals } from './intervals'
import { details as mathGeometry } from './math-geometry'
import { details as bitManipulation } from './bit-manipulation'

/** Every problem's learning content, keyed by slug. */
export const DETAILS: Record<string, ProblemDetail> = {
  ...arraysHashing,
  ...twoPointers,
  ...slidingWindow,
  ...stack,
  ...binarySearch,
  ...linkedList,
  ...trees,
  ...tries,
  ...heap,
  ...backtracking,
  ...graphs,
  ...advancedGraphs,
  ...dp1d,
  ...dp2d,
  ...greedy,
  ...intervals,
  ...mathGeometry,
  ...bitManipulation,
}
