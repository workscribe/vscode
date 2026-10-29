import * as vscode from 'vscode'
import { registerActivityLog } from './activityLog/activityLog'
import { createCaptureStarter } from './capture/captureStarter'
import { BINARY_PATH_SETTING } from './constants'
import { registerSessionTab } from './sessionTab/sessionTab'

export function activate(context: vscode.ExtensionContext): void {
  // The tab, its command and the log come first and whatever the trust or CLI state, so the tab can always say
  // why it has nothing to show. Capture and the status bar wait for trust and the CLI (captureStarter.ts).
  const log = registerActivityLog(context)
  const tab = registerSessionTab(context, vscode.workspace.isTrusted ? { kind: 'resolving' } : { kind: 'restricted' })
  const capture = createCaptureStarter(context, tab, log)

  context.subscriptions.push(
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      tab.setCliState({ kind: 'resolving' })
      void capture.start()
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(BINARY_PATH_SETTING)) capture.binaryPathChanged()
    }),
  )
  void capture.start()
}

export function deactivate(): void {
  // No cleanup needed — all capture calls are already detached, fire-and-forget
  // subprocesses with no persistent connection to this extension.
}
