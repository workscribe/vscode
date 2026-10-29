import { randomBytes } from 'node:crypto'
import * as vscode from 'vscode'
import { querySessionForFile } from '../cli/context'
import { MANAGE_TRUST_COMMAND, OPEN_SETTINGS_COMMAND } from '../constants'
import { type CliState, SessionTabController } from './sessionTabController'
import { sessionTabHtml } from './sessionTabHtml'
import { nextTarget } from './sessionTarget'

export const SESSION_VIEW_ID = 'workscribe.session'
export const SHOW_SESSION_COMMAND = 'workscribe.showSession'

/** The Workscribe tab's webview, driven by SessionTabController (what to show, and when to ask the CLI). */
class SessionTab implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined
  readonly controller: SessionTabController

  constructor(initialState: CliState, initialTarget: string | null) {
    this.controller = new SessionTabController(initialState, initialTarget, {
      query: querySessionForFile,
      render: (state) => {
        if (this.view) this.view.webview.html = sessionTabHtml(state, { nonce: randomBytes(16).toString('base64') })
      },
      isVisible: () => this.view?.visible ?? false,
      schedule: (callback, delayMs) => setTimeout(callback, delayMs),
      cancel: (handle) => clearTimeout(handle as NodeJS.Timeout | undefined),
    })
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view
    view.webview.options = {
      enableScripts: false,
      enableCommandUris: [OPEN_SETTINGS_COMMAND, MANAGE_TRUST_COMMAND],
    }
    const visibilityListener = view.onDidChangeVisibility(() => {
      if (view.visible) this.controller.becameVisible()
    })
    const disposeListener = view.onDidDispose(() => {
      visibilityListener.dispose()
      disposeListener.dispose()
      // VS Code may already have created a replacement view (when the view is moved): keep that one
      if (this.view === view) this.view = undefined
    })
    this.controller.viewCreated()
  }

  dispose(): void {
    this.controller.dispose()
  }
}

function activeDocument(): { scheme: string; fsPath: string } | undefined {
  const uri = vscode.window.activeTextEditor?.document.uri
  return uri ? { scheme: uri.scheme, fsPath: uri.fsPath } : undefined
}

function hasOpenTabs(): boolean {
  return vscode.window.tabGroups.all.some((group) => group.tabs.length > 0)
}

/** What the rest of the extension tells the tab: whether it can reach the CLI. */
export interface SessionTabHandle {
  setCliState(state: CliState): void
}

/**
 * Registers the Workscribe tab and `workscribe.showSession`. Registered at activation whatever the trust or CLI
 * state, so the tab can always explain why it has nothing to show.
 */
export function registerSessionTab(context: vscode.ExtensionContext, initialState: CliState): SessionTabHandle {
  const tab = new SessionTab(initialState, nextTarget(null, activeDocument(), hasOpenTabs()))
  const { controller } = tab
  const followEditor = () => controller.setTarget(nextTarget(controller.target, activeDocument(), hasOpenTabs()))

  context.subscriptions.push(
    tab,
    vscode.window.registerWebviewViewProvider(SESSION_VIEW_ID, tab),
    vscode.window.onDidChangeActiveTextEditor(followEditor),
    vscode.window.tabGroups.onDidChangeTabs(followEditor),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme === 'file') controller.fileSaved(document.uri.fsPath)
    }),
    // Shows the session for a given file, else the active editor's. The target is set before the view is revealed,
    // so a first reveal — which creates the view — shows the right file. (WOR-125's status bar will pass its file.)
    vscode.commands.registerCommand(SHOW_SESSION_COMMAND, async (filePath?: unknown) => {
      if (typeof filePath === 'string') controller.setTarget(filePath)
      else followEditor()
      await vscode.commands.executeCommand(`${SESSION_VIEW_ID}.focus`)
    }),
  )
  return controller
}
