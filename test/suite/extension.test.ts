import * as assert from 'node:assert'
import * as vscode from 'vscode'

suite('extension activation', () => {
  test('activates without throwing and registers as active', async () => {
    const extension = vscode.extensions.getExtension('workscribe.workscribe')
    assert.ok(extension, 'extension should be discoverable by id')

    await extension?.activate()

    assert.strictEqual(extension?.isActive, true)
  })

  // Covered: activation succeeds in a trusted workspace with no `workscribe`
  // binary on PATH (this test environment has none) — exercises the
  // "binary not found, show status bar item, don't throw or repeat-alert"
  // path end to end.
  //
  // Not yet covered:
  // - Asserting the status bar item's actual content/visibility — the public
  //   API has no way to enumerate an extension's own status bar items, so
  //   this can only be verified manually (F5) or by exposing a test-only hook.
  // - Restricted Mode / untrusted-workspace behavior. That needs a fixture
  //   folder pre-seeded as untrusted in the test profile's trust database —
  //   left as follow-up rather than faked here.
})
