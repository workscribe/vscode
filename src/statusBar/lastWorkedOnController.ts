// When the "last worked on" status bar item asks the CLI, and what it shows — free of `vscode`, so it's tested with
// fake timers and a fake CLI. statusBar.ts connects it to the status bar item and the editor events.
import type { SessionContext, SessionLookup } from '../cli/context'
import { shouldSurface } from '../cli/context'
import { SAVE_REFRESH_DELAY_MS } from '../constants'

// Flicking through tabs shouldn't start a `context --file` for each one: a found file's answer can take seconds of git
export const SWITCH_DEBOUNCE_MS = 150

export interface LastWorkedOnDependencies {
  query(binaryPath: string, filePath: string): Promise<SessionLookup>
  show(session: SessionContext, filePath: string): void
  hide(): void
  schedule(callback: () => void, delayMs: number): unknown
  cancel(handle: unknown): void
  /** Whether the one-time hint has been shown, in this window or any other */
  isHintShown(): boolean
  /** Remembers the hint as shown — before it appears, so a window opened a moment later doesn't show it too */
  markHintShown(): void
  showHint(session: SessionContext, filePath: string): void
  /** The clock, for the 24 h rule */
  now(): number
}

/**
 * Asks the CLI about the active file, a moment after you switch to it and again after you save it. Requests are
 * numbered and only the latest answer is shown, so a slow answer about another file can't replace a newer one.
 * Nothing is cached: every answer is fresh.
 */
export class LastWorkedOnController {
  private activeFile: string | null = null
  private latestRequest = 0
  private switchTimer: unknown
  private saveTimer: unknown

  constructor(
    private readonly binaryPath: string,
    private readonly dependencies: LastWorkedOnDependencies,
  ) {}

  /**
   * The active editor changed: `filePath` is the file on disk it shows, or null for anything else. The item hides at
   * once, so its text and click never point at the previous file while the new answer is on its way.
   */
  editorChanged(filePath: string | null): void {
    this.dependencies.cancel(this.switchTimer)
    this.dependencies.cancel(this.saveTimer)
    this.activeFile = filePath
    // Any answer still on its way is about a file that's no longer active
    this.latestRequest++
    this.dependencies.hide()
    if (filePath === null) return
    this.switchTimer = this.dependencies.schedule(() => this.refresh(), SWITCH_DEBOUNCE_MS)
  }

  /** A save of the active file: ask again once capture has had time to record it. */
  fileSaved(filePath: string): void {
    if (filePath !== this.activeFile) return
    this.dependencies.cancel(this.saveTimer)
    this.saveTimer = this.dependencies.schedule(() => this.refresh(), SAVE_REFRESH_DELAY_MS)
  }

  private refresh(): void {
    const filePath = this.activeFile
    if (filePath === null) return
    void this.load(++this.latestRequest, filePath)
  }

  private async load(request: number, filePath: string): Promise<void> {
    const lookup = await this.dependencies.query(this.binaryPath, filePath)
    if (request !== this.latestRequest) return
    // The 24 h rule: a file you touched today isn't worth a status bar item
    if (lookup.kind !== 'found' || !shouldSurface(lookup.session, this.dependencies.now())) {
      this.dependencies.hide()
      return
    }
    this.dependencies.show(lookup.session, filePath)
    if (this.dependencies.isHintShown()) return
    this.dependencies.markHintShown()
    this.dependencies.showHint(lookup.session, filePath)
  }

  dispose(): void {
    this.dependencies.cancel(this.switchTimer)
    this.dependencies.cancel(this.saveTimer)
  }
}
