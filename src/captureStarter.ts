import * as vscode from 'vscode'
import type { ActivityLog } from './activityLog'
import { resolveBinaryPath } from './capture'
import { CaptureStartup } from './captureStartup'
import { BINARY_PATH_SETTING, OPEN_SETTINGS_COMMAND } from './constants'
import { registerListeners } from './listeners'
import type { SessionTabHandle } from './sessionTab'
import { registerLastWorkedOnStatusBar } from './statusBar'

/**
 * A persistent status bar item, not a notification — shown once per session
 * and left visible for as long as the CLI is missing, rather than a toast
 * that would either spam on every capture attempt or (if only shown once
 * ever) get permanently silenced while the problem is still unresolved.
 */
function createBinaryNotFoundStatus(): vscode.StatusBarItem {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)
  statusBarItem.text = '$(warning) Workscribe'
  statusBarItem.tooltip = 'Workscribe: `workscribe` CLI not found on PATH — editor activity is not being captured.'
  statusBarItem.command = {
    title: 'Configure Workscribe binary path',
    command: OPEN_SETTINGS_COMMAND,
    arguments: [BINARY_PATH_SETTING],
  }
  return statusBarItem
}

/**
 * Starts capture and the status bar once the workspace is trusted and the CLI is found (see CaptureStartup for the
 * rules), keeping the Workscribe tab and log in step.
 */
export function createCaptureStarter(
  context: vscode.ExtensionContext,
  tab: SessionTabHandle,
  log: ActivityLog,
): CaptureStartup {
  // One item for as long as the CLI is missing, however often the lookup is retried
  let notFoundStatus: vscode.StatusBarItem | undefined

  return new CaptureStartup({
    // Capture spawns subprocesses derived from workspace file paths — treat that
    // as workspace-content-driven behavior and gate it on Workspace Trust, same
    // as the security posture VS Code expects from extensions in this category.
    isTrusted: () => vscode.workspace.isTrusted,
    resolveBinaryPath,
    showRestricted: () => {
      tab.setCliState({ kind: 'restricted' })
      log.captureStatus({ kind: 'restricted' })
    },
    showResolving: () => tab.setCliState({ kind: 'resolving' }),
    showNotFound: () => {
      if (!notFoundStatus) {
        notFoundStatus = createBinaryNotFoundStatus()
        context.subscriptions.push(notFoundStatus)
      }
      notFoundStatus.show()
      tab.setCliState({ kind: 'no-cli' })
      log.captureStatus({ kind: 'no-cli' })
    },
    beginCapture: (binaryPath) => {
      notFoundStatus?.dispose()
      notFoundStatus = undefined
      registerListeners(context, binaryPath, log)
      registerLastWorkedOnStatusBar(context, binaryPath)
      tab.setCliState({ kind: 'ready', binaryPath })
      log.captureStatus({ kind: 'on', binaryPath })
    },
    askForReload: () => log.binaryPathChanged(),
  })
}
