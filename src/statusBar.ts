import * as vscode from 'vscode'
import type { SessionContext } from './context'
import { queryContext, shouldSurface } from './context'

/**
 * Tracks the active editor, not "file open" literally — onDidOpenTextDocument
 * only fires once per document's lifetime in the session, so it would leave
 * stale info showing when switching between already-open tabs. Matching the
 * ticket's actual intent (surface context for whatever file you're currently
 * looking at) needs onDidChangeActiveTextEditor instead.
 */
export function registerLastWorkedOnStatusBar(context: vscode.ExtensionContext, binaryPath: string): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
  context.subscriptions.push(statusBarItem)

  // Per-session cache — avoids re-querying the subprocess every time the
  // user switches back to a tab they already visited this session.
  const cache = new Map<string, SessionContext | null>()

  async function updateForEditor(editor: vscode.TextEditor | undefined): Promise<void> {
    if (editor?.document.uri.scheme !== 'file') {
      statusBarItem.hide()
      return
    }

    const filePath = editor.document.uri.fsPath

    let sessionContext: SessionContext | null
    if (cache.has(filePath)) {
      sessionContext = cache.get(filePath) ?? null
    } else {
      sessionContext = await queryContext(binaryPath, filePath)
      cache.set(filePath, sessionContext)
    }

    // The user may have switched editors again while the query was in
    // flight — don't show stale info for a file that's no longer active.
    if (vscode.window.activeTextEditor?.document.uri.fsPath !== filePath) return

    if (!sessionContext || !shouldSurface(sessionContext)) {
      statusBarItem.hide()
      return
    }

    statusBarItem.text = `$(history) ${sessionContext.timeAgo}`
    statusBarItem.tooltip = sessionContext.summary
      ? `Last worked on this file: ${sessionContext.timeAgo}\n\n${sessionContext.summary}`
      : `Last worked on this file: ${sessionContext.timeAgo}`
    statusBarItem.show()
  }

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateForEditor))

  void updateForEditor(vscode.window.activeTextEditor)
}
