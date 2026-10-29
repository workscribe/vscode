import * as vscode from 'vscode'
import { querySessionForFile, type SessionContext } from '../cli/context'
import { SHOW_SESSION_COMMAND } from '../constants'
import { accessibilityLabel, statusText, tooltipMarkdown } from './lastWorkedOn'
import { LastWorkedOnController } from './lastWorkedOnController'

const STATUS_BAR_ITEM_ID = 'workscribe.lastWorkedOn'
// In globalState, so the hint is shown once ever, not once per window or workspace
const HINT_SHOWN_KEY = 'workscribe.lastWorkedOnHintShown'
const OPEN_SESSION_ACTION = 'Open session'
const DISMISS_ACTION = 'Got it'

function openSessionCommand(filePath: string): vscode.Command {
  return { command: SHOW_SESSION_COMMAND, title: 'Open session in Workscribe', arguments: [filePath] }
}

function tooltipFor(session: SessionContext, filePath: string): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString(tooltipMarkdown(session, filePath))
  // Only the "Open session" link may run a command; data in the tooltip is escaped, so it can't add one
  tooltip.isTrusted = { enabledCommands: [SHOW_SESSION_COMMAND] }
  return tooltip
}

async function showHint(session: SessionContext, filePath: string): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    `${accessibilityLabel(session)}.`,
    OPEN_SESSION_ACTION,
    DISMISS_ACTION,
  )
  if (choice === OPEN_SESSION_ACTION) await vscode.commands.executeCommand(SHOW_SESSION_COMMAND, filePath)
}

function fileOf(editor: vscode.TextEditor | undefined): string | null {
  return editor?.document.uri.scheme === 'file' ? editor.document.uri.fsPath : null
}

/**
 * "WS · 25 days ago" for the active file, when you last worked on it more than a day ago. It follows the active
 * editor, not "file open" literally — onDidOpenTextDocument fires once per document, so switching between open tabs
 * would leave stale info showing. LastWorkedOnController decides when to ask the CLI and what to show.
 */
export function registerLastWorkedOnStatusBar(context: vscode.ExtensionContext, binaryPath: string): void {
  const statusBarItem = vscode.window.createStatusBarItem(STATUS_BAR_ITEM_ID, vscode.StatusBarAlignment.Left)
  statusBarItem.name = 'Workscribe: last worked on'

  const controller = new LastWorkedOnController(binaryPath, {
    query: querySessionForFile,
    show: (session, filePath) => {
      statusBarItem.text = statusText(session)
      statusBarItem.accessibilityInformation = { label: accessibilityLabel(session) }
      statusBarItem.tooltip = tooltipFor(session, filePath)
      statusBarItem.command = openSessionCommand(filePath)
      statusBarItem.show()
    },
    hide: () => statusBarItem.hide(),
    schedule: (callback, delayMs) => setTimeout(callback, delayMs),
    cancel: (handle) => clearTimeout(handle as NodeJS.Timeout | undefined),
    isHintShown: () => context.globalState.get<boolean>(HINT_SHOWN_KEY, false),
    markHintShown: () => void context.globalState.update(HINT_SHOWN_KEY, true),
    showHint: (session, filePath) => void showHint(session, filePath),
    now: () => Date.now(),
  })

  context.subscriptions.push(
    statusBarItem,
    controller,
    vscode.window.onDidChangeActiveTextEditor((editor) => controller.editorChanged(fileOf(editor))),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme === 'file') controller.fileSaved(document.uri.fsPath)
    }),
  )
  controller.editorChanged(fileOf(vscode.window.activeTextEditor))
}
