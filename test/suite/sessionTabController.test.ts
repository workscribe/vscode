import * as assert from 'node:assert'
import type { SessionContext, SessionLookup } from '../../src/context'
import {
  type CliState,
  LOADING_DELAY_MS,
  SAVE_REFRESH_DELAY_MS,
  SessionTabController,
} from '../../src/sessionTabController'
import type { TabState } from '../../src/sessionTabHtml'

const READY: CliState = { kind: 'ready', binaryPath: '/usr/local/bin/workscribe' }
const README = '/repo/README.md'
const INDEX = '/repo/src/index.ts'

function sessionFor(startedAt: string): SessionContext {
  return {
    date: '2026-10-28',
    startedAt,
    endedAt: startedAt,
    timeAgo: 'now',
    durationMinutes: 1,
    branch: 'main',
    eventCount: 1,
    summary: null,
  }
}

/** A fake CLI whose answers the test releases, timers the test fires, and a record of every page rendered. */
function harness(options: { cliState?: CliState; target?: string | null; visible?: boolean } = {}) {
  const pending: { filePath: string; answer: (lookup: SessionLookup) => void }[] = []
  const timers = new Map<number, { callback: () => void; delayMs: number }>()
  let nextTimer = 1
  const rendered: TabState[] = []
  let visible = options.visible ?? true

  // `null` is a real target ("no file"), so only a missing option falls back to README
  const target = options.target === undefined ? README : options.target
  const controller = new SessionTabController(options.cliState ?? READY, target, {
    query: (_binaryPath, filePath) =>
      new Promise<SessionLookup>((resolve) => pending.push({ filePath, answer: resolve })),
    render: (state) => rendered.push(state),
    isVisible: () => visible,
    schedule: (callback, delayMs) => {
      timers.set(nextTimer, { callback, delayMs })
      return nextTimer++
    },
    cancel: (handle) => timers.delete(handle as number),
  })

  return {
    controller,
    pending,
    rendered,
    setVisible: (value: boolean) => {
      visible = value
    },
    /** Fires every pending timer scheduled with this delay */
    fire(delayMs: number) {
      for (const [handle, timer] of [...timers]) {
        if (timer.delayMs !== delayMs) continue
        timers.delete(handle)
        timer.callback()
      }
    },
    hasTimer: (delayMs: number) => [...timers.values()].some((timer) => timer.delayMs === delayMs),
  }
}

/** Lets awaited answers reach the controller. */
const settle = () => new Promise((resolve) => setImmediate(resolve))

suite('SessionTabController', () => {
  test('shows why it cannot ask the CLI, without asking', () => {
    for (const kind of ['resolving', 'restricted', 'no-cli'] as const) {
      const tab = harness({ cliState: { kind } })
      tab.controller.viewCreated()
      assert.deepStrictEqual(tab.rendered, [{ kind }])
      assert.strictEqual(tab.pending.length, 0)
    }
  })

  test('with no target file, asks you to open one', () => {
    const tab = harness({ target: null })
    tab.controller.viewCreated()
    assert.deepStrictEqual(tab.rendered, [{ kind: 'no-file' }])
  })

  test('shows the answer for the target file', async () => {
    const tab = harness()
    tab.controller.viewCreated()
    tab.pending[0].answer({ kind: 'found', session: sessionFor('2026-10-28T09:00:00.000Z') })
    await settle()

    assert.deepStrictEqual(tab.rendered, [
      { kind: 'session', session: sessionFor('2026-10-28T09:00:00.000Z'), filePath: README },
    ])
  })

  test('only shows the latest request’s answer, even when an older one arrives last', async () => {
    const tab = harness()
    tab.controller.viewCreated() // README
    tab.controller.setTarget(INDEX)
    tab.pending[1].answer({ kind: 'none' }) // INDEX answers first
    await settle()
    tab.pending[0].answer({ kind: 'found', session: sessionFor('2026-10-28T09:00:00.000Z') }) // README, late
    await settle()

    assert.deepStrictEqual(tab.rendered, [{ kind: 'none' }])
  })

  test('shows "Loading…" only when the answer is slow', async () => {
    const quick = harness()
    quick.controller.viewCreated()
    quick.pending[0].answer({ kind: 'none' })
    await settle()
    assert.strictEqual(quick.hasTimer(LOADING_DELAY_MS), false, 'the loading timer is cancelled by the answer')
    assert.deepStrictEqual(quick.rendered, [{ kind: 'none' }])

    const slow = harness()
    slow.controller.viewCreated()
    slow.fire(LOADING_DELAY_MS)
    assert.deepStrictEqual(slow.rendered, [{ kind: 'loading' }])
  })

  test('does not render the same page twice, but does for a new webview', async () => {
    const tab = harness()
    tab.controller.viewCreated()
    tab.pending[0].answer({ kind: 'none' })
    await settle()
    tab.controller.refresh()
    tab.pending[1].answer({ kind: 'none' })
    await settle()
    assert.strictEqual(tab.rendered.length, 1)

    tab.controller.viewCreated()
    tab.pending[2].answer({ kind: 'none' })
    await settle()
    assert.strictEqual(tab.rendered.length, 2)
  })

  test('while hidden, asks nothing — and catches up once shown', () => {
    const tab = harness({ visible: false })
    tab.controller.viewCreated()
    tab.controller.setTarget(INDEX)
    assert.strictEqual(tab.pending.length, 0)

    tab.setVisible(true)
    tab.controller.becameVisible()
    assert.deepStrictEqual(
      tab.pending.map((request) => request.filePath),
      [INDEX],
    )
  })

  test('asks again two seconds after the target file is saved — other files’ saves are ignored', () => {
    const tab = harness()
    tab.controller.viewCreated()
    tab.controller.fileSaved(INDEX)
    assert.strictEqual(tab.hasTimer(SAVE_REFRESH_DELAY_MS), false)

    tab.controller.fileSaved(README)
    tab.controller.fileSaved(README) // a second save restarts the wait, rather than queueing another refresh
    assert.strictEqual(tab.pending.length, 1)
    tab.fire(SAVE_REFRESH_DELAY_MS)
    assert.strictEqual(tab.pending.length, 2)
  })

  test('the same target again changes nothing', () => {
    const tab = harness()
    tab.controller.viewCreated()
    tab.controller.setTarget(README)
    assert.strictEqual(tab.pending.length, 1)
  })

  test('cancels its timers when disposed', () => {
    const tab = harness()
    tab.controller.viewCreated()
    tab.controller.fileSaved(README)
    tab.controller.dispose()
    assert.strictEqual(tab.hasTimer(SAVE_REFRESH_DELAY_MS), false)
    assert.strictEqual(tab.hasTimer(LOADING_DELAY_MS), false)
  })
})
