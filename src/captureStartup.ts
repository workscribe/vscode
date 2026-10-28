// When capture may start, and what happens if the CLI's path changes — free of `vscode`, so the races are tested
// with a fake lookup. captureStarter.ts connects it to VS Code.

export interface CaptureStartupDependencies {
  isTrusted(): boolean
  resolveBinaryPath(): Promise<string | null>
  /** The workspace isn't trusted: capture stays off */
  showRestricted(): void
  /** Looking for the CLI again after a settings change */
  showResolving(): void
  showNotFound(): void
  beginCapture(binaryPath: string): void
  /** The path changed once capture was already running with another binary */
  askForReload(): void
}

/**
 * Capture starts once, when the workspace is trusted and the CLI is found. Start-up, a trust grant and a settings
 * change share one lookup, so capture is never set up twice. A path change only repairs "not found": once capture
 * runs, it keeps its binary (so capture, the status bar and the tab agree) and the change asks for a reload.
 */
export class CaptureStartup {
  private isCapturing = false
  private lookup: Promise<string | null> | null = null
  // The path changed while a lookup (with the old path) was running
  private hasPathChangedDuringLookup = false

  constructor(private readonly dependencies: CaptureStartupDependencies) {}

  async start(): Promise<void> {
    if (!this.dependencies.isTrusted()) {
      this.dependencies.showRestricted()
      return
    }
    if (this.isCapturing) return

    this.lookup ??= this.dependencies.resolveBinaryPath().finally(() => {
      this.lookup = null
    })
    const binaryPath = await this.lookup
    // Another caller awaiting the same lookup got here first
    if (this.isCapturing) return

    const hadPathChange = this.hasPathChangedDuringLookup
    this.hasPathChangedDuringLookup = false
    if (!binaryPath) {
      if (hadPathChange) return this.start()
      this.dependencies.showNotFound()
      return
    }

    this.isCapturing = true
    this.dependencies.beginCapture(binaryPath)
    // The lookup that won used the old path: say the new one needs a reload, as for any later change
    if (hadPathChange) this.dependencies.askForReload()
  }

  binaryPathChanged(): void {
    if (this.isCapturing) {
      this.dependencies.askForReload()
      return
    }
    if (!this.dependencies.isTrusted()) return
    if (this.lookup) {
      this.hasPathChangedDuringLookup = true
      return
    }
    this.dependencies.showResolving()
    void this.start()
  }
}
