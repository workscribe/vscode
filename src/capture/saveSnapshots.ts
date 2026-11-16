// The last version of each open file that was sent to the CLI, so a save can be line-diffed against it. Pure.
import { MAX_TRACKED_FILE_CHARS, MAX_TRACKED_FILES, MAX_TRACKED_LINES } from '../constants'
import { diffLineCounts, type LineCounts } from './lineDiff'

export interface DocumentChange {
  path: string
  /** The document's text after the change */
  text: string
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

  /** Keeps `text` as the file's last version sent. A text it can't keep leaves the file untracked, its old copy gone. */
  track(path: string, text: string): void {
    this.snapshots.delete(path)
    if (!isTrackable(text)) return
    this.snapshots.set(path, text)
    this.evictOldest()
  }

  forget(path: string): void {
    this.snapshots.delete(path)
  }

  /**
   * A change event is one of three things, and only one resets the snapshot:
   * typing (`changeCount > 0`, dirty) keeps it, since your edits add up against the last version sent;
   * an outside change (`changeCount > 0`, clean: a reload, a git checkout, an undo back to clean) takes the new text,
   * so it isn't counted as your edit; the no-op VS Code fires around every save (`changeCount === 0`) changes nothing,
   * and resetting on it would make every save count 0/0.
   */
  documentChanged({ path, text, changeCount, isDirty }: DocumentChange): void {
    if (changeCount === 0) return
    if (isDirty) {
      this.touch(path)
      return
    }
    this.track(path, text)
  }

  /**
   * What the save changed, or null when the file wasn't tracked (never seen open, too big, binary, or evicted). The
   * snapshot always moves on to the saved text, whatever came of the diff, so the next save never counts two edits.
   */
  countsOnSave(path: string, text: string): LineCounts | null {
    const before = this.snapshots.get(path)
    const counts = before !== undefined && isTrackable(text) ? diffLineCounts(before, text) : null
    this.track(path, text)
    return counts
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
