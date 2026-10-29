import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import * as vscode from 'vscode'

const execFileAsync = promisify(execFile)

const COMMON_FIXED_PATHS = ['/usr/local/bin/workscribe', '/opt/homebrew/bin/workscribe', '/usr/bin/workscribe']

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await execFileAsync(candidate, ['--version'], { timeout: 2000 })
    return true
  } catch {
    return false
  }
}

async function resolveViaShell(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('bash', ['-l', '-c', 'which workscribe'], { timeout: 2000 })
    const resolved = stdout.trim()
    return resolved.length > 0 ? resolved : null
  } catch {
    return null
  }
}

/**
 * Resolution order mirrors the shell hook and every other Workscribe plugin:
 * user-configured path -> login-shell `which` (handles nvm/volta/fnm) -> common
 * fixed install paths -> null (capture disabled).
 */
export async function resolveBinaryPath(): Promise<string | null> {
  const configured = vscode.workspace.getConfiguration('workscribe').get<string>('binaryPath')
  if (configured && (await pathExists(configured))) {
    return configured
  }

  const fromShell = await resolveViaShell()
  if (fromShell) {
    return fromShell
  }

  for (const candidate of COMMON_FIXED_PATHS) {
    if (await pathExists(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * Fire-and-forget subprocess call into `workscribe _capture`. Detached and
 * fully swallowed on failure — a capture error must never surface to the
 * user or affect the editor session (WOR-11 architecture constraint).
 */
export function spawnCapture(binaryPath: string, args: string[]): void {
  try {
    const child = spawn(binaryPath, ['_capture', ...args], {
      detached: true,
      stdio: 'ignore',
    })
    child.on('error', () => {
      // Swallowed intentionally — see function doc comment.
    })
    child.unref()
  } catch {
    // Swallowed intentionally — see function doc comment.
  }
}
