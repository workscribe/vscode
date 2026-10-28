import path from 'node:path'
import * as vscode from 'vscode'
import type { ActivityLog } from './activityLog'
import type { CaptureEventType } from './activityLogLine'
import { spawnCapture } from './capture'

/**
 * Only real, on-disk documents represent a meaningful code_edit event.
 * Skips untitled buffers, output channels, git diff views, etc.
 */
function isCapturableDocument(document: vscode.TextDocument): boolean {
  return document.uri.scheme === 'file'
}

/**
 * `workscribe _capture` requires --cwd — it's what getGitContext() resolves
 * repo_name/branch from via `git rev-parse --show-toplevel`. Always use the
 * file's own directory, not the workspace folder: a workspace root spanning
 * multiple sibling repos isn't itself a git repo, so repo_name resolves null.
 */
function resolveCwdForUri(uri: vscode.Uri): string {
  return path.dirname(uri.fsPath)
}

function resolveCwdForDebugSession(session: vscode.DebugSession): string | null {
  return session.workspaceFolder?.uri.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null
}

function isWorkspaceFolder(
  scope: vscode.WorkspaceFolder | vscode.TaskScope | undefined,
): scope is vscode.WorkspaceFolder {
  return typeof scope === 'object' && scope !== null && 'uri' in scope
}

function resolveCwdForTaskScope(scope: vscode.WorkspaceFolder | vscode.TaskScope | undefined): string | null {
  if (isWorkspaceFolder(scope)) return scope.uri.fsPath
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null
}

/**
 * Sends each editor event to `workscribe _capture`, and notes it in the Workscribe Output channel. `target` is
 * what the log shows: the saved file, or the folder for debug sessions and tasks.
 */
export function registerListeners(context: vscode.ExtensionContext, binaryPath: string, log: ActivityLog): void {
  const capture = (type: CaptureEventType, target: string, args: string[]) => {
    spawnCapture(binaryPath, ['--type', type, ...args, '--source', 'vscode'])
    log.sent(type, target)
  }

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (!isCapturableDocument(document)) return
      const cwd = resolveCwdForUri(document.uri)
      capture('code_edit', document.uri.fsPath, ['--file', document.uri.fsPath, '--cwd', cwd])
    }),

    vscode.debug.onDidStartDebugSession((session) => {
      const cwd = resolveCwdForDebugSession(session)
      if (!cwd) return
      capture('debug_start', cwd, ['--cwd', cwd])
    }),

    vscode.debug.onDidTerminateDebugSession((session) => {
      const cwd = resolveCwdForDebugSession(session)
      if (!cwd) return
      capture('debug_end', cwd, ['--cwd', cwd])
    }),

    // A single task_run event on completion — matches the CLI's actual
    // IDE_EVENT_TYPES vocabulary (code_edit/debug_start/debug_end/task_run),
    // not a start/end pair. See docs/site/commands.md in workscribe-cli.
    vscode.tasks.onDidEndTask((event) => {
      const cwd = resolveCwdForTaskScope(event.execution.task.scope)
      if (!cwd) return
      capture('task_run', cwd, ['--cwd', cwd])
    }),
  )
}
