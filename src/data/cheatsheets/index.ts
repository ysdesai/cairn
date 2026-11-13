import type { CheatSheet, TopicId } from '../types'
import { sheet as arraysHashing } from './arrays-hashing'
import { sheet as twoPointers } from './two-pointers'
import { sheet as slidingWindow } from './sliding-window'
import { sheet as stack } from './stack'
import { sheet as binarySearch } from './binary-search'
import { sheet as linkedList } from './linked-list'
import { sheet as trees } from './trees'
import { sheet as tries } from './tries'
import { sheet as heap } from './heap'
import { sheet as backtracking } from './backtracking'
import { sheet as graphs } from './graphs'
import { sheet as advancedGraphs } from './advanced-graphs'
import { sheet as dp1d } from './dp-1d'
import { sheet as dp2d } from './dp-2d'
import { sheet as greedy } from './greedy'
import { sheet as intervals } from './intervals'
import { sheet as mathGeometry } from './math-geometry'
import { sheet as bitManipulation } from './bit-manipulation'

/** The field guide for each topic. */
export const CHEATSHEETS: Record<TopicId, CheatSheet> = {
  'arrays-hashing': arraysHashing,
  'two-pointers': twoPointers,
  'sliding-window': slidingWindow,
  stack,
  'binary-search': binarySearch,
  'linked-list': linkedList,
  trees,
  tries,
  heap,
  backtracking,
  graphs,
  'advanced-graphs': advancedGraphs,
  'dp-1d': dp1d,
  'dp-2d': dp2d,
  greedy,
  intervals,
  'math-geometry': mathGeometry,
  'bit-manipulation': bitManipulation,
}
