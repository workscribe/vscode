import * as vscode from 'vscode'
import {
  BINARY_PATH_CHANGED_LINE,
  type CaptureEventType,
  type CaptureStatus,
  formatCaptureStatus,
  formatLogLine,
} from './activityLogLine'

/** The Workscribe Output channel: what the extension sends to the CLI, and whether capture is on. */
export interface ActivityLog {
  /** An event handed to `workscribe _capture`, about a file or folder */
  sent(type: CaptureEventType, target: string): void
  captureStatus(status: CaptureStatus): void
  binaryPathChanged(): void
}

/**
 * A file or folder as the log shows it: relative to the workspace, or the folder's name for a workspace folder
 * itself (debug sessions and tasks run there) — `asRelativePath` would give its full path.
 */
function describeTarget(target: string): string {
  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(target))
  if (folder?.uri.fsPath === target) return folder.name
  return vscode.workspace.asRelativePath(target)
}

/** Never opens itself — it's there when you pick Workscribe in the Output panel's dropdown. */
export function registerActivityLog(context: vscode.ExtensionContext): ActivityLog {
  const channel = vscode.window.createOutputChannel('Workscribe')
  context.subscriptions.push(channel)
  return {
    sent: (type, target) =>
      channel.appendLine(formatLogLine({ time: new Date(), type, target: describeTarget(target) })),
    captureStatus: (status) => channel.appendLine(formatCaptureStatus(status)),
    binaryPathChanged: () => channel.appendLine(BINARY_PATH_CHANGED_LINE),
  }
}
