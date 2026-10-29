// What the Workscribe tab shows and when it asks the CLI — free of `vscode`, so it's tested with fake timers and
// a fake CLI. sessionTab.ts connects it to the webview and the editor events.
import type { SessionLookup } from '../cli/context'
import { SAVE_REFRESH_DELAY_MS } from '../constants'
import type { TabState } from './sessionTabHtml'

/** Whether the tab can ask the CLI yet — still looking, not allowed, not found, or ready. */
export type CliState =
  | { kind: 'resolving' }
  | { kind: 'restricted' }
  | { kind: 'no-cli' }
  | { kind: 'ready'; binaryPath: string }

// Quick answers replace the page before this, so "Loading…" doesn't flash
export const LOADING_DELAY_MS = 300

export interface TabControllerDependencies {
  query(binaryPath: string, filePath: string): Promise<SessionLookup>
  render(state: TabState): void
  isVisible(): boolean
  schedule(callback: () => void, delayMs: number): unknown
  cancel(handle: unknown): void
}

/**
 * Asks the CLI only while the tab is visible — a change while hidden marks it out of date for when it's shown.
 * Requests are numbered and only the latest one's answer is shown, so a slow answer (another file, an earlier
 * save) can't overwrite a newer one. A page identical to the one showing isn't rendered again.
 */
export class SessionTabController {
  private targetFile: string | null
  private isOutOfDate = false
  private latestRequest = 0
  private lastRenderedState = ''
  private saveTimer: unknown
  private loadingTimer: unknown

  constructor(
    private cliState: CliState,
    initialTarget: string | null,
    private readonly dependencies: TabControllerDependencies,
  ) {
    this.targetFile = initialTarget
  }

  get target(): string | null {
    return this.targetFile
  }

  setCliState(state: CliState): void {
    this.cliState = state
    this.refresh()
  }

  setTarget(filePath: string | null): void {
    if (filePath === this.targetFile) return
    this.targetFile = filePath
    this.refresh()
  }

  /** A save of the target file: ask again once capture has had time to record it. */
  fileSaved(filePath: string): void {
    if (filePath !== this.targetFile) return
    this.dependencies.cancel(this.saveTimer)
    this.saveTimer = this.dependencies.schedule(() => this.refresh(), SAVE_REFRESH_DELAY_MS)
  }

  /** The tab became visible: catch up if anything changed while it was hidden. */
  becameVisible(): void {
    if (this.isOutOfDate) this.refresh()
  }

  /** A new webview: whatever it last showed is gone, so render again even if nothing changed. */
  viewCreated(): void {
    this.lastRenderedState = ''
    this.refresh()
  }

  refresh(): void {
    if (!this.dependencies.isVisible()) {
      this.isOutOfDate = true
      return
    }
    this.isOutOfDate = false
    void this.load(++this.latestRequest)
  }

  private async load(request: number): Promise<void> {
    this.dependencies.cancel(this.loadingTimer)
    const state = this.cliState
    if (state.kind !== 'ready') {
      this.render(state)
      return
    }
    const filePath = this.targetFile
    if (!filePath) {
      this.render({ kind: 'no-file' })
      return
    }

    this.loadingTimer = this.dependencies.schedule(() => {
      if (request === this.latestRequest) this.render({ kind: 'loading' })
    }, LOADING_DELAY_MS)
    const lookup = await this.dependencies.query(state.binaryPath, filePath)
    // A newer request has started since: its answer is the one to show
    if (request !== this.latestRequest) return
    this.dependencies.cancel(this.loadingTimer)
    this.render(lookup.kind === 'found' ? { kind: 'session', session: lookup.session, filePath } : lookup)
  }

  private render(state: TabState): void {
    const stateKey = JSON.stringify(state)
    if (stateKey === this.lastRenderedState) return
    this.lastRenderedState = stateKey
    this.dependencies.render(state)
  }

  dispose(): void {
    this.dependencies.cancel(this.saveTimer)
    this.dependencies.cancel(this.loadingTimer)
  }
}
