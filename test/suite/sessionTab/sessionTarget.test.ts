import * as assert from 'node:assert'
import { nextTarget } from '../../../src/sessionTab/sessionTarget'

const README = '/Users/dev/api/README.md'

suite('nextTarget', () => {
  test('a file on disk becomes the target', () => {
    assert.strictEqual(nextTarget(null, { scheme: 'file', fsPath: README }, true), README)
  })

  test('Output, settings or an untitled file keep the current target', () => {
    for (const scheme of ['output', 'vscode-settings', 'untitled']) {
      assert.strictEqual(nextTarget(README, { scheme, fsPath: 'x' }, true), README, scheme)
    }
  })

  test('closing every editor clears it', () => {
    assert.strictEqual(nextTarget(README, undefined, false), null)
  })

  test('no file yet: an untitled first editor leaves no target', () => {
    assert.strictEqual(nextTarget(null, { scheme: 'untitled', fsPath: 'Untitled-1' }, true), null)
  })
})
