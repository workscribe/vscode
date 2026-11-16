// How many lines a save added and removed, counted the way `git diff --numstat` counts them. Pure.
import { DIFF_CLOCK_CHECK_EVERY, DIFF_DEADLINE_MS } from '../constants'

export interface LineCounts {
  linesAdded: number
  linesRemoved: number
}

export interface DiffOptions {
  /** The clock the deadline is read from; a test passes its own */
  now?: () => number
  deadlineMs?: number
}

// Git counts a last line with no newline as another line from the same text with one, so it is marked to differ
const NO_NEWLINE_MARK = '\u0000no-newline'

function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines[lines.length - 1] === '') {
    lines.pop()
  } else {
    lines[lines.length - 1] += NO_NEWLINE_MARK
  }
  return lines
}

/** The lines that differ once the ones both texts begin and end with are set aside. */
function withoutCommonEnds(before: string[], after: string[]): { before: string[]; after: string[] } {
  const shortest = Math.min(before.length, after.length)
  let start = 0
  while (start < shortest && before[start] === after[start]) start++

  let beforeEnd = before.length
  let afterEnd = after.length
  while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
    beforeEnd--
    afterEnd--
  }
  return { before: before.slice(start, beforeEnd), after: after.slice(start, afterEnd) }
}

/**
 * The fewest lines that must be added and removed to turn `before` into `after` (Myers' diff), or null when
 * `isExpired` says the time is up. It takes time in proportion to the size of the texts times the number of lines that
 * changed, so a few edits in a long file are quick wherever they are.
 */
function shortestEditLength(before: string[], after: string[], isExpired: () => boolean): number | null {
  const total = before.length + after.length
  // For each diagonal k (x - y), how far along `before` the best path has got; `total` shifts k to an array index
  const furthest = new Int32Array(2 * total + 2)
  let diagonalsDone = 0
  for (let edits = 0; edits <= total; edits++) {
    if (isExpired()) return null
    for (let diagonal = -edits; diagonal <= edits; diagonal += 2) {
      if (++diagonalsDone % DIFF_CLOCK_CHECK_EVERY === 0 && isExpired()) return null
      const index = total + diagonal
      // Reach this diagonal by taking a line of `after` (down) or deleting a line of `before` (right), whichever
      // path is further along; the edges of the pass have only one way in
      const isDownMove = diagonal === -edits || (diagonal !== edits && furthest[index - 1] < furthest[index + 1])
      let x = isDownMove ? furthest[index + 1] : furthest[index - 1] + 1
      let y = x - diagonal
      while (x < before.length && y < after.length && before[x] === after[y]) {
        x++
        y++
      }
      furthest[index] = x
      if (x >= before.length && y >= after.length) return edits
    }
  }
  return total
}

/**
 * The lines `afterText` added to and removed from `beforeText`. The common start and end are set aside first, then the
 * rest is diffed exactly if that finishes by the deadline; otherwise every differing line counts, which can only
 * overstate.
 */
export function diffLineCounts(beforeText: string, afterText: string, options: DiffOptions = {}): LineCounts {
  const { now = Date.now, deadlineMs = DIFF_DEADLINE_MS } = options
  const deadline = now() + deadlineMs
  const { before, after } = withoutCommonEnds(splitLines(beforeText), splitLines(afterText))

  const edits = shortestEditLength(before, after, () => now() > deadline)
  if (edits === null) return { linesAdded: after.length, linesRemoved: before.length }
  // Added minus removed is the change in length, and added plus removed is the number of edits
  const lengthChange = after.length - before.length
  return { linesAdded: (edits + lengthChange) / 2, linesRemoved: (edits - lengthChange) / 2 }
}
