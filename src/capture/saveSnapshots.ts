// The last version of each open file that was sent to the CLI, so a save can be line-diffed against it. Pure.
import { MAX_TRACKED_FILE_CHARS, MAX_TRACKED_FILES, MAX_TRACKED_LINES } from '../constants'
import { diffLineCounts, type LineCounts } from './lineDiff'

export interface DocumentChange {
  path: string
  /** Reads the document's text after the change. Only a change that reads clean reads it: typing never does */
  readText: () => string
  /** How many content changes the event carried */
  changeCount: number
  isDirty: boolean
}

function lineCountOf(text: string): number {
  let lines = 1
  for (let at = text.indexOf('\n'); at !== -1; at = text.indexOf('\n', at + 1)) lines++
  return lines
}

/** Small enough to keep and diff in time, and not binary. */
function isTrackable(text: string): boolean {
  return text.length <= MAX_TRACKED_FILE_CHARS && !text.includes('\0') && lineCountOf(text) <= MAX_TRACKED_LINES
}

export class SaveSnapshots {
  // A Map keeps insertion order, so the first key is the least recently used: a use re-inserts the file
  private readonly snapshots = new Map<string, string>()
  // The text after a change that read clean, until the next event says whether it was typing or an outside change
  private readonly cleanChanges = new Map<string, string>()

  /** Keeps `text` as the file's last version sent. A text it can't keep leaves the file untracked, its old copy gone. */
  track(path: string, text: string): void {
    this.snapshots.delete(path)
    if (!isTrackable(text)) return
    this.snapshots.set(path, text)
    this.evictOldest()
  }

  forget(path: string): void {
    this.snapshots.delete(path)
    this.cleanChanges.delete(path)
  }

  /**
   * What a change event means, told from the events alone (VS Code sets a document's `isDirty` a moment after it
   * reports the edit, so reading the flag later is a race):
   * - Typing on a dirty document (`changeCount > 0`, dirty) keeps the snapshot: your edits add up against the last
   *   version sent. So does the event that only announces the document is dirty now (`changeCount === 0`, dirty).
   * - The no-op around a save (`changeCount === 0`, clean) changes nothing; acting on it would make every save count 0/0.
   * - A change that reads clean (`changeCount > 0`, clean) is either the first edit typed after a save, which VS Code
   *   reports before it flags the document dirty, or an outside change (a reload, a git checkout, a revert). It is held
   *   until the next event says which: the dirty announcement that always follows a typed edit drops it, and a later
   *   change that finds it still held means nothing followed it, so it was an outside change and the snapshot takes its
   *   text, rather than counting it as your edit.
   */
  documentChanged({ path, readText, changeCount, isDirty }: DocumentChange): void {
    if (isDirty) {
      this.cleanChanges.delete(path)
      if (changeCount > 0) this.touch(path)
      return
    }
    if (changeCount === 0) return
    this.settleCleanChange(path)
    this.cleanChanges.set(path, readText())
  }

  /**
   * What the save changed, or null when the file wasn't tracked (never seen open, too big, binary, or evicted). The
   * snapshot always moves on to the saved text, whatever came of the diff, so the next save never counts two edits.
   * A save needs a dirty document, so a clean change still held was the first typed edit after all.
   */
  countsOnSave(path: string, text: string): LineCounts | null {
    this.cleanChanges.delete(path)
    const before = this.snapshots.get(path)
    const counts = before !== undefined && isTrackable(text) ? diffLineCounts(before, text) : null
    this.track(path, text)
    return counts
  }

  /** A change that read clean and that nothing followed was an outside change: its text is the file's new version. */
  private settleCleanChange(path: string): void {
    const text = this.cleanChanges.get(path)
    if (text === undefined) return
    this.cleanChanges.delete(path)
    this.track(path, text)
  }

  private touch(path: string): void {
    const text = this.snapshots.get(path)
    if (text === undefined) return
    this.snapshots.delete(path)
    this.snapshots.set(path, text)
  }

  private evictOldest(): void {
    while (this.snapshots.size > MAX_TRACKED_FILES) {
      const [oldest] = this.snapshots.keys()
      if (oldest === undefined) return
      this.snapshots.delete(oldest)
    }
  }
}
