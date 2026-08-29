import * as vscode from 'vscode'
import { resolveBinaryPath } from './capture'
import { registerListeners } from './listeners'
import { registerLastWorkedOnStatusBar } from './statusBar'

/**
 * A persistent status bar item, not a notification — shown once per session
 * and left visible for as long as the CLI is missing, rather than a toast
 * that would either spam on every capture attempt or (if only shown once
 * ever) get permanently silenced while the problem is still unresolved.
 */
function showBinaryNotFoundStatus(context: vscode.ExtensionContext): void {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
  statusBarItem.text = '$(warning) Workscribe'
  statusBarItem.tooltip = 'Workscribe: `workscribe` CLI not found on PATH — editor activity is not being captured.'
  statusBarItem.command = {
    title: 'Configure Workscribe binary path',
    command: 'workbench.action.openSettings',
    arguments: ['workscribe.binaryPath'],
  }
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)
}

async function startCapture(context: vscode.ExtensionContext): Promise<void> {
  // Capture spawns subprocesses derived from workspace file paths — treat that
  // as workspace-content-driven behavior and gate it on Workspace Trust, same
  // as the security posture VS Code expects from extensions in this category.
  if (!vscode.workspace.isTrusted) {
    context.subscriptions.push(
      vscode.workspace.onDidGrantWorkspaceTrust(() => {
        void startCapture(context)
      }),
    )
    return
  }

  const binaryPath = await resolveBinaryPath()
  if (!binaryPath) {
    showBinaryNotFoundStatus(context)
    return
  }

  registerListeners(context, binaryPath)
  registerLastWorkedOnStatusBar(context, binaryPath)
}

export function activate(context: vscode.ExtensionContext): void {
  void startCapture(context)
}

export function deactivate(): void {
  // No cleanup needed — all capture calls are already detached, fire-and-forget
  // subprocesses with no persistent connection to this extension.
}
