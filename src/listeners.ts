import * as vscode from 'vscode'
import { spawnCapture } from './capture'

/**
 * Only real, on-disk documents represent a meaningful file_save event.
 * Skips untitled buffers, output channels, git diff views, etc.
 */
function isCapturableDocument(document: vscode.TextDocument): boolean {
  return document.uri.scheme === 'file'
}

export function registerListeners(context: vscode.ExtensionContext, binaryPath: string): void {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (!isCapturableDocument(document)) return
      spawnCapture(binaryPath, ['--type', 'file_save', '--file', document.uri.fsPath, '--source', 'vscode'])
    }),

    vscode.debug.onDidStartDebugSession(() => {
      spawnCapture(binaryPath, ['--type', 'debug_start', '--source', 'vscode'])
    }),

    vscode.debug.onDidTerminateDebugSession(() => {
      spawnCapture(binaryPath, ['--type', 'debug_end', '--source', 'vscode'])
    }),

    // NOTE: VS Code tasks aren't only builds (test, watch, lint, clean tasks all
    // fire the same events). Mapped to build_start/build_end for now since that's
    // the closest fit in WOR-11's event-type enum — worth revisiting once real
    // usage shows whether lumping all task types together is misleading.
    vscode.tasks.onDidStartTask(() => {
      spawnCapture(binaryPath, ['--type', 'build_start', '--source', 'vscode'])
    }),

    vscode.tasks.onDidEndTask(() => {
      spawnCapture(binaryPath, ['--type', 'build_end', '--source', 'vscode'])
    }),
  )
}
