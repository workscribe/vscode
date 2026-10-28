import * as assert from 'node:assert'
import { CaptureStartup } from '../../src/captureStartup'

/** A fake CLI lookup the test resolves, and a record of what start-up did. */
function harness(options: { trusted?: boolean } = {}) {
  const lookups: ((binaryPath: string | null) => void)[] = []
  const events: string[] = []
  let trusted = options.trusted ?? true
  const startup = new CaptureStartup({
    isTrusted: () => trusted,
    resolveBinaryPath: () => new Promise((resolve) => lookups.push(resolve)),
    showRestricted: () => events.push('restricted'),
    showResolving: () => events.push('resolving'),
    showNotFound: () => events.push('not found'),
    beginCapture: (binaryPath) => events.push(`capture ${binaryPath}`),
    askForReload: () => events.push('reload'),
  })
  return {
    startup,
    lookups,
    events,
    trust: () => {
      trusted = true
    },
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

suite('CaptureStartup', () => {
  test('stays off in Restricted Mode, without looking for the CLI', async () => {
    const run = harness({ trusted: false })
    await run.startup.start()
    assert.deepStrictEqual(run.events, ['restricted'])
    assert.strictEqual(run.lookups.length, 0)
  })

  test('starts capture once, even when start-up and a trust grant race on the same lookup', async () => {
    const run = harness()
    const first = run.startup.start()
    const second = run.startup.start()
    assert.strictEqual(run.lookups.length, 1, 'one lookup, shared')
    run.lookups[0]('/usr/local/bin/workscribe')
    await Promise.all([first, second])
    assert.deepStrictEqual(run.events, ['capture /usr/local/bin/workscribe'])
  })

  test('not found, then the path is fixed: looks again and starts capture', async () => {
    const run = harness()
    const start = run.startup.start()
    run.lookups[0](null)
    await start
    run.startup.binaryPathChanged()
    run.lookups[1]('/opt/workscribe')
    await settle()
    assert.deepStrictEqual(run.events, ['not found', 'resolving', 'capture /opt/workscribe'])
  })

  test('the path changes during a lookup that finds nothing: looks again with the new path', async () => {
    const run = harness()
    const start = run.startup.start()
    run.startup.binaryPathChanged()
    run.lookups[0](null)
    await settle()
    assert.strictEqual(run.lookups.length, 2, 'a second lookup, not "not found"')
    run.lookups[1]('/opt/workscribe')
    await start
    assert.deepStrictEqual(run.events, ['capture /opt/workscribe'])
  })

  test('the path changes during a lookup that finds the old binary: capture starts, and asks for a reload', async () => {
    const run = harness()
    const start = run.startup.start()
    run.startup.binaryPathChanged()
    run.lookups[0]('/usr/local/bin/workscribe')
    await start
    assert.deepStrictEqual(run.events, ['capture /usr/local/bin/workscribe', 'reload'])
  })

  test('once capture runs, a path change asks for a reload and looks for nothing', async () => {
    const run = harness()
    const start = run.startup.start()
    run.lookups[0]('/usr/local/bin/workscribe')
    await start
    run.startup.binaryPathChanged()
    assert.deepStrictEqual(run.events, ['capture /usr/local/bin/workscribe', 'reload'])
    assert.strictEqual(run.lookups.length, 1)
  })

  test('a path change while untrusted does nothing; trust then starts capture', async () => {
    const run = harness({ trusted: false })
    run.startup.binaryPathChanged()
    assert.deepStrictEqual(run.events, [])
    run.trust()
    const start = run.startup.start()
    run.lookups[0]('/usr/local/bin/workscribe')
    await start
    assert.deepStrictEqual(run.events, ['capture /usr/local/bin/workscribe'])
  })
})
