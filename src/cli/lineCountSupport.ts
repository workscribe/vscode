// Whether the installed `workscribe` takes `--lines-added`/`--lines-removed` on `_capture` (CLI 3.3.0 and later). A CLI
// before 3.3.0 rejects options it doesn't know, so sending it the flags would lose the whole save.
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { LineCounts } from '../capture/lineDiff'
import { SUPPORT_PROBE_TIMEOUT_MS, SUPPORT_RETRY_MS } from '../constants'

const execFileAsync = promisify(execFile)

/** A flag as `--help` prints it: whole, with whitespace or a comma before it and whitespace, `[`, `<`, `=` or the end after. */
function listsFlag(helpText: string, flag: string): boolean {
  return new RegExp(`(?:^|[\\s,])${flag}(?=[\\s\\[<=]|$)`).test(helpText)
}

/** Whether `_capture --help` lists both line-count flags. */
export function listsLineCountFlags(helpText: string): boolean {
  return listsFlag(helpText, '--lines-added') && listsFlag(helpText, '--lines-removed')
}

/** The `_capture` arguments for a save's line counts; none when they aren't known. */
export function lineCountArgs(counts: LineCounts | null): string[] {
  if (!counts) return []
  return ['--lines-added', String(counts.linesAdded), '--lines-removed', String(counts.linesRemoved)]
}

async function readCaptureHelp(binaryPath: string): Promise<string> {
  const { stdout } = await execFileAsync(binaryPath, ['_capture', '--help'], { timeout: SUPPORT_PROBE_TIMEOUT_MS })
  return stdout
}

interface SupportAnswer {
  supported: boolean
  /** Epoch ms from which to ask again; null for a yes, which is kept for good */
  askAgainAt: number | null
}

export interface LineCountSupportDependencies {
  readHelp: (binaryPath: string) => Promise<string>
  now?: () => number
}

/**
 * What is known about each CLI, by binary path (the path can change in settings). A yes is kept for good; a no, or no
 * answer at all, for `SUPPORT_RETRY_MS`, so a slow or broken CLI doesn't make every save wait for the probe and one
 * that gets fixed is asked again soon. Saves that arrive while a probe runs share it.
 */
export class LineCountSupport {
  private readonly answers = new Map<string, SupportAnswer>()
  private readonly probes = new Map<string, Promise<boolean>>()
  private readonly readHelp: (binaryPath: string) => Promise<string>
  private readonly now: () => number

  constructor({ readHelp, now = Date.now }: LineCountSupportDependencies) {
    this.readHelp = readHelp
    this.now = now
  }

  async supports(binaryPath: string): Promise<boolean> {
    const answer = this.answers.get(binaryPath)
    if (answer && (answer.askAgainAt === null || answer.askAgainAt > this.now())) return answer.supported

    const running = this.probes.get(binaryPath)
    if (running) return running

    const probe = this.probe(binaryPath).finally(() => {
      if (this.probes.get(binaryPath) === probe) this.probes.delete(binaryPath)
    })
    this.probes.set(binaryPath, probe)
    return probe
  }

  private async probe(binaryPath: string): Promise<boolean> {
    const supported = await this.readHelp(binaryPath).then(listsLineCountFlags, () => false)
    this.answers.set(binaryPath, { supported, askAgainAt: supported ? null : this.now() + SUPPORT_RETRY_MS })
    return supported
  }
}

/** The one the extension asks, running the installed CLI's own `--help`. */
export const lineCountSupport = new LineCountSupport({ readHelp: readCaptureHelp })
