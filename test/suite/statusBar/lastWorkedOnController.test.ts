import * as assert from 'node:assert'
import type { SessionContext, SessionLookup } from '../../../src/cli/context'
import { SAVE_REFRESH_DELAY_MS } from '../../../src/constants'
import { LastWorkedOnController, SWITCH_DEBOUNCE_MS } from '../../../src/statusBar/lastWorkedOnController'

const README = '/repo/README.md'
const INDEX = '/repo/src/index.ts'
const NOW = new Date('2026-10-28T12:00:00.000Z').getTime()
const DAY_MS = 24 * 60 * 60 * 1000

function sessionStartedAgo(milliseconds: number): SessionContext {
  return {
    date: '2026-10-01',
    startedAt: new Date(NOW - milliseconds).toISOString(),
    endedAt: new Date(NOW - milliseconds).toISOString(),
    timeAgo: 'some time ago',
    durationMinutes: 30,
    branch: 'main',
    eventCount: 4,
    summary: null,
  }
}

const OLD_SESSION = sessionStartedAgo(25 * DAY_MS)

/** A fake CLI whose answers the test releases, timers the test fires, and a record of what the item did. */
function harness(options: { hintShown?: boolean } = {}) {
  const pending: { filePath: string; answer: (lookup: SessionLookup) => void }[] = []
  const timers = new Map<number, { callback: () => void; delayMs: number }>()
  let nextTimer = 1
  const events: string[] = []
  let hintShown = options.hintShown ?? false

  const controller = new LastWorkedOnController('/usr/local/bin/workscribe', {
    query: (_binaryPath, filePath) =>
      new Promise<SessionLookup>((resolve) => pending.push({ filePath, answer: resolve })),
    show: (_session, filePath) => events.push(`show ${filePath}`),
    hide: () => events.push('hide'),
    schedule: (callback, delayMs) => {
      timers.set(nextTimer, { callback, delayMs })
      return nextTimer++
    },
    cancel: (handle) => timers.delete(handle as number),
    isHintShown: () => hintShown,
    markHintShown: () => {
      hintShown = true
      events.push('mark hint')
    },
    showHint: (_session, filePath) => events.push(`hint ${filePath}`),
    now: () => NOW,
  })

  return {
    controller,
    pending,
    events,
    /** Fires every pending timer scheduled with this delay */
    fire(delayMs: number) {
      for (const [handle, timer] of [...timers]) {
        if (timer.delayMs !== delayMs) continue
        timers.delete(handle)
        timer.callback()
      }
    },
    /** Lets the controller's awaited answer run */
    settle: () => new Promise((resolve) => setImmediate(resolve)),
  }
}

suite('LastWorkedOnController', () => {
  test('shows a file last worked on more than a day ago, a moment after you switch to it', async () => {
    const { controller, pending, events, fire, settle } = harness({ hintShown: true })

    controller.editorChanged(README)
    assert.strictEqual(pending.length, 0)
    fire(SWITCH_DEBOUNCE_MS)
    pending[0].answer({ kind: 'found', session: OLD_SESSION })
    await settle()

    assert.deepStrictEqual(events, ['hide', `show ${README}`])
  })

  test('makes one query for quick switches between files', () => {
    const { controller, pending, fire } = harness()

    controller.editorChanged(README)
    controller.editorChanged(INDEX)
    controller.editorChanged(README)
    fire(SWITCH_DEBOUNCE_MS)

    assert.deepStrictEqual(
      pending.map((request) => request.filePath),
      [README],
    )
  })

  test('hides the item at once on a switch, so it never points at the previous file', async () => {
    const { controller, pending, events, fire, settle } = harness({ hintShown: true })
    controller.editorChanged(README)
    fire(SWITCH_DEBOUNCE_MS)
    pending[0].answer({ kind: 'found', session: OLD_SESSION })
    await settle()

    controller.editorChanged(INDEX)

    assert.strictEqual(events.at(-1), 'hide')
  })

  test("doesn't let a slow answer about a previous file replace the current one", async () => {
    const { controller, pending, events, fire, settle } = harness({ hintShown: true })
    controller.editorChanged(README)
    fire(SWITCH_DEBOUNCE_MS)
    controller.editorChanged(INDEX)
    fire(SWITCH_DEBOUNCE_MS)

    pending[1].answer({ kind: 'found', session: OLD_SESSION })
    await settle()
    pending[0].answer({ kind: 'found', session: OLD_SESSION })
    await settle()

    assert.deepStrictEqual(
      events.filter((event) => event.startsWith('show')),
      [`show ${INDEX}`],
    )
  })

  test('asks again 2 s after a save of the active file, and only that file', () => {
    const { controller, pending, fire } = harness()
    controller.editorChanged(README)
    fire(SWITCH_DEBOUNCE_MS)

    controller.fileSaved(INDEX)
    controller.fileSaved(README)
    fire(SAVE_REFRESH_DELAY_MS)

    assert.deepStrictEqual(
      pending.map((request) => request.filePath),
      [README, README],
    )
  })

  test('hides the item when there is nothing worth showing', async () => {
    const answers: SessionLookup[] = [
      { kind: 'none' },
      { kind: 'failed' },
      { kind: 'found', session: sessionStartedAgo(2 * 60 * 60 * 1000) },
    ]
    for (const answer of answers) {
      const { controller, pending, events, fire, settle } = harness()
      controller.editorChanged(README)
      fire(SWITCH_DEBOUNCE_MS)
      pending[0].answer(answer)
      await settle()

      assert.deepStrictEqual(events, ['hide', 'hide'], `for ${JSON.stringify(answer)}`)
    }
  })

  test('asks nothing for an editor that is not a file on disk', () => {
    const { controller, pending, events, fire } = harness()

    controller.editorChanged(null)
    fire(SWITCH_DEBOUNCE_MS)

    assert.strictEqual(pending.length, 0)
    assert.deepStrictEqual(events, ['hide'])
  })

  test('shows the hint the first time the item appears, remembering it first, and never again', async () => {
    const { controller, pending, events, fire, settle } = harness()
    controller.editorChanged(README)
    fire(SWITCH_DEBOUNCE_MS)
    pending[0].answer({ kind: 'found', session: OLD_SESSION })
    await settle()
    controller.editorChanged(INDEX)
    fire(SWITCH_DEBOUNCE_MS)
    pending[1].answer({ kind: 'found', session: OLD_SESSION })
    await settle()

    assert.deepStrictEqual(
      events.filter((event) => event.includes('hint')),
      ['mark hint', `hint ${README}`],
    )
  })

  test('never shows the hint when the item is hidden', async () => {
    const { controller, pending, events, fire, settle } = harness()
    controller.editorChanged(README)
    fire(SWITCH_DEBOUNCE_MS)
    pending[0].answer({ kind: 'none' })
    await settle()

    assert.ok(!events.some((event) => event.includes('hint')))
  })
})
