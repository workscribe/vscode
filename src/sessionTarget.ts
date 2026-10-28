// Which file the Workscribe tab is about. Pure.

/** The bit of an editor the rule needs — a `vscode.Uri`'s scheme and path. */
export interface EditorDocument {
  scheme: string
  fsPath: string
}

/**
 * The tab's file after the active editor changes. A file on disk becomes the target. Anything else (the Output
 * panel, settings, an untitled file) keeps the current one, so the tab doesn't empty out as you click around —
 * until every editor tab is closed.
 */
export function nextTarget(
  current: string | null,
  editor: EditorDocument | undefined,
  hasOpenTabs: boolean,
): string | null {
  if (editor?.scheme === 'file') return editor.fsPath
  if (!hasOpenTabs) return null
  return current
}
