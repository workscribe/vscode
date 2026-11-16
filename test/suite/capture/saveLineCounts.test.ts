import * as assert from 'node:assert'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import * as vscode from 'vscode'
import type { ActivityLog } from '../../../src/activityLog/activityLog'
import { registerListeners } from '../../../src/capture/listeners'
import { resolveBinaryPath } from '../../../src/cli/capture'

// The compiled tests run from out/test/suite/capture
const FIXTURES = join(__dirname, '..', '..', '..', '..', 'test', 'fixtures')
const SILENT_LOG: ActivityLog = { sent: () => {}, captureStatus: () => {}, binaryPathChanged: () => {} }
const WAIT_MS = 15_000

/** A `workscribe` that prints the given release's `_capture --help` and writes the arguments of every capture. */
function writeFakeCli(folder: string, helpFixture: string, recordPath: string, helpDelaySeconds = 0): string {
  const script = join(folder, 'workscribe')
  writeFileSync(
    script,
    [
      '#!/bin/sh',
      'case "$1" in',
      '  --version) echo 3.4.1 ;;',
      '  _capture)',
      `    if [ "$2" = "--help" ]; then sleep ${helpDelaySeconds}; cat "${join(FIXTURES, helpFixture)}"; else echo "$@" >> "${recordPath}"; fi ;;`,
      '  *) exit 1 ;;',
      'esac',
      '',
    ].join('\n'),
  )
  chmodSync(script, 0o755)
  return script
}

async function waitFor(condition: () => boolean | Promise<boolean>): Promise<void> {
  const giveUpAt = Date.now() + WAIT_MS
  while (Date.now() < giveUpAt) {
    if (await condition()) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('timed out waiting')
}

/**
 * Edits the document and saves it, with no pause between, and returns once VS Code has told the listeners about the
 * save: `save()` can resolve before they run, and the next edit would land in the text they read.
 */
async function typeAndSave(document: vscode.TextDocument, text: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit()
  edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), text)
  await vscode.workspace.applyEdit(edit)
  const saveHeard = new Promise<void>((resolve) => {
    const subscription = vscode.workspace.onDidSaveTextDocument((saved) => {
      if (saved !== document) return
      subscription.dispose()
      resolve()
    })
  })
  await document.save()
  await saveHeard
}

suite('saving a file sends its line counts', function () {
  this.timeout(60_000)
  let folder: string
  let recordPath: string
  let file: string
  let context: vscode.ExtensionContext

  const captures = () => (existsSync(recordPath) ? readFileSync(recordPath, 'utf8').split('\n').filter(Boolean) : [])

  /** Saves `text` and waits for the capture that save sends, returning its arguments. */
  async function save(document: vscode.TextDocument, text: string): Promise<string> {
    const before = captures().length
    await typeAndSave(document, text)
    await waitFor(() => captures().length > before)
    return captures()[captures().length - 1]
  }

  /** Opens the file with the listeners registered for a CLI that prints `helpFixture`, and gets past the first save. */
  async function openWithCli(helpFixture: string): Promise<vscode.TextDocument> {
    const cli = writeFakeCli(folder, helpFixture, recordPath)
    registerListeners(context, cli, SILENT_LOG)
    const document = await vscode.workspace.openTextDocument(file)
    // The first save only starts the file's snapshot when the listeners missed the open
    await save(document, 'a\nb\nc\n')
    return document
  }

  setup(async function () {
    // A real CLI on this machine would have the extension write these saves to the real database, unless HOME is a
    // scratch folder, which is where its database would then be
    const savesWouldReachRealDatabase = (await resolveBinaryPath()) !== null && !homedir().startsWith(tmpdir())
    if (savesWouldReachRealDatabase) this.skip()
    folder = mkdtempSync(join(tmpdir(), 'workscribe-save-'))
    recordPath = join(folder, 'captures.log')
    file = join(folder, 'notes.txt')
    writeFileSync(file, 'start\n')
    context = { subscriptions: [] } as unknown as vscode.ExtensionContext
  })

  teardown(async () => {
    for (const subscription of context?.subscriptions ?? []) subscription.dispose()
    await vscode.commands.executeCommand('workbench.action.closeAllEditors')
    if (folder) rmSync(folder, { recursive: true, force: true })
  })

  test('counts each save against the one before it, with a CLI that takes line counts', async () => {
    const document = await openWithCli('help_33.txt')

    const first = await save(document, 'a\nX\nc\nd\n')
    const second = await save(document, 'a\nX\nc\nd\ne\n')

    assert.match(first, /--lines-added 2 --lines-removed 1 /)
    assert.match(second, /--lines-added 1 --lines-removed 0 /)
  })

  /** Changes the file on disk behind the editor's back (a git checkout), then throws away an edit with a revert. */
  async function revertToDiskContent(document: vscode.TextDocument, onDisk: string): Promise<void> {
    await vscode.window.showTextDocument(document)
    writeFileSync(file, onDisk)
    const edit = new vscode.WorkspaceEdit()
    edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), 'a\nb\nc\nq\n')
    await vscode.workspace.applyEdit(edit)
    await vscode.commands.executeCommand('workbench.action.files.revert')
    await waitFor(() => document.getText() === onDisk && !document.isDirty)
  }

  test('counts only what was typed after the file was reverted to what is on disk', async () => {
    const document = await openWithCli('help_33.txt')
    await revertToDiskContent(document, 'x\ny\n')

    const sent = await save(document, 'x\ny\nz\n')

    assert.match(sent, /--lines-added 1 --lines-removed 0 /)
  })

  test('counts each of two saves made while the first check of the CLI is still running', async () => {
    // The fake CLI takes a while to print its help, so both saves arrive before the first check has finished
    const cli = writeFakeCli(folder, 'help_33.txt', recordPath, 0.5)
    registerListeners(context, cli, SILENT_LOG)
    const document = await vscode.workspace.openTextDocument(file)

    await typeAndSave(document, 'start\nb\n')
    await typeAndSave(document, 'start\nb\nc\nd\n')
    await waitFor(() => captures().length >= 2)

    // The two captures are separate processes, so which one writes its line first is not fixed
    const sent = captures().join('\n')
    assert.match(sent, /--lines-added 1 --lines-removed 0 /)
    assert.match(sent, /--lines-added 2 --lines-removed 0 /)
  })

  test('sends the save without counts to a CLI that would reject them', async () => {
    const document = await openWithCli('help_32.txt')

    const sent = await save(document, 'a\nX\nc\nd\n')

    assert.match(sent, /_capture --type code_edit --file .*notes\.txt --cwd /)
    assert.doesNotMatch(sent, /--lines-/)
  })
})
