import path from 'node:path'
import * as vscode from 'vscode'
import { spawnCapture } from './capture'

/**
 * Only real, on-disk documents represent a meaningful code_edit event.
 * Skips untitled buffers, output channels, git diff views, etc.
 */
function isCapturableDocument(document: vscode.TextDocument): boolean {
  return document.uri.scheme === 'file'
}

/**
 * `workscribe _capture` requires --cwd (silently no-ops without it) — it's
 * what getGitContext() resolves repo_name/branch from. Prefer the containing
 * workspace folder; fall back to the file's own directory for single-file-open
 * scenarios, same as the shell hook does for any arbitrary cwd.
 */
function resolveCwdForUri(uri: vscode.Uri): string {
  return vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath ?? path.dirname(uri.fsPath)
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

export function registerListeners(context: vscode.ExtensionContext, binaryPath: string): void {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (!isCapturableDocument(document)) return
      const cwd = resolveCwdForUri(document.uri)
      spawnCapture(binaryPath, [
        '--type',
        'code_edit',
        '--file',
        document.uri.fsPath,
        '--cwd',
        cwd,
        '--source',
        'vscode',
      ])
    }),

    vscode.debug.onDidStartDebugSession((session) => {
      const cwd = resolveCwdForDebugSession(session)
      if (!cwd) return
      spawnCapture(binaryPath, ['--type', 'debug_start', '--cwd', cwd, '--source', 'vscode'])
    }),

    vscode.debug.onDidTerminateDebugSession((session) => {
      const cwd = resolveCwdForDebugSession(session)
      if (!cwd) return
      spawnCapture(binaryPath, ['--type', 'debug_end', '--cwd', cwd, '--source', 'vscode'])
    }),

    // A single task_run event on completion — matches the CLI's actual
    // IDE_EVENT_TYPES vocabulary (code_edit/debug_start/debug_end/task_run),
    // not a start/end pair. See docs/site/commands.md in workscribe-cli.
    vscode.tasks.onDidEndTask((event) => {
      const cwd = resolveCwdForTaskScope(event.execution.task.scope)
      if (!cwd) return
      spawnCapture(binaryPath, ['--type', 'task_run', '--cwd', cwd, '--source', 'vscode'])
    }),
  )
}
