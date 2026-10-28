import * as assert from 'node:assert'
import * as vscode from 'vscode'

suite('extension activation', () => {
  test('activates without throwing and registers as active', async () => {
    const extension = vscode.extensions.getExtension('workscribe.workscribe')
    assert.ok(extension, 'extension should be discoverable by id')

    await extension?.activate()

    assert.strictEqual(extension?.isActive, true)
  })

  test('registers workscribe.showSession, which opens the Workscribe tab without throwing', async () => {
    await vscode.extensions.getExtension('workscribe.workscribe')?.activate()

    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes('workscribe.showSession'))
    await vscode.commands.executeCommand('workscribe.showSession')
  })

  test('declares the Workscribe tab, its command, and limited Restricted Mode support', () => {
    const manifest = vscode.extensions.getExtension('workscribe.workscribe')?.packageJSON
    assert.deepStrictEqual(manifest.contributes.viewsContainers.panel, [
      { id: 'workscribe', title: 'Workscribe', icon: 'images/panel.svg' },
    ])
    assert.deepStrictEqual(manifest.contributes.views.workscribe, [
      { type: 'webview', id: 'workscribe.session', name: 'Session' },
    ])
    assert.ok(
      manifest.contributes.commands.some(
        (command: { command: string }) => command.command === 'workscribe.showSession',
      ),
    )
    assert.strictEqual(manifest.capabilities.untrustedWorkspaces.supported, 'limited')
    assert.deepStrictEqual(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations, [
      'workscribe.binaryPath',
    ])
  })

  // Covered: activation succeeds in a trusted workspace with no `workscribe`
  // binary on PATH (this test environment has none) — exercises the
  // "binary not found, show status bar item, don't throw or repeat-alert"
  // path end to end — and the Workscribe tab is registered regardless.
  //
  // Not yet covered:
  // - Asserting the status bar item's actual content/visibility — the public
  //   API has no way to enumerate an extension's own status bar items, so
  //   this can only be verified manually (F5) or by exposing a test-only hook.
  // - Restricted Mode / untrusted-workspace behavior. That needs a fixture
  //   folder pre-seeded as untrusted in the test profile's trust database —
  //   left as follow-up rather than faked here.
})
