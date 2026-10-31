import * as assert from 'node:assert'
import type { SessionContext } from '../../../src/cli/context'
import { LAST_WORKED_ON_THRESHOLD_MS, shouldSurface, threadOf } from '../../../src/cli/context'
import { CLI_ALONGSIDE } from '../threadFixtures'

function makeContext(startedAt: string): SessionContext {
  return {
    date: '2026-08-20',
    startedAt,
    endedAt: startedAt,
    timeAgo: 'irrelevant for this test',
    durationMinutes: 60,
    branch: 'main',
    eventCount: 10,
    summary: null,
  }
}

suite('shouldSurface', () => {
  const now = new Date('2026-08-28T12:00:00.000Z').getTime()

  test('does not surface a session from a few minutes ago', () => {
    const startedAt = new Date(now - 5 * 60 * 1000).toISOString()
    assert.strictEqual(shouldSurface(makeContext(startedAt), now), false)
  })

  test('does not surface a session from a few hours ago', () => {
    const startedAt = new Date(now - 6 * 60 * 60 * 1000).toISOString()
    assert.strictEqual(shouldSurface(makeContext(startedAt), now), false)
  })

  test('surfaces a session from several days ago', () => {
    const startedAt = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString()
    assert.strictEqual(shouldSurface(makeContext(startedAt), now), true)
  })

  test('does not surface exactly 1ms under the threshold', () => {
    const startedAt = new Date(now - (LAST_WORKED_ON_THRESHOLD_MS - 1)).toISOString()
    assert.strictEqual(shouldSurface(makeContext(startedAt), now), false)
  })

  test('surfaces exactly at the threshold boundary', () => {
    const startedAt = new Date(now - LAST_WORKED_ON_THRESHOLD_MS).toISOString()
    assert.strictEqual(shouldSurface(makeContext(startedAt), now), true)
  })
})

suite('threadOf', () => {
  test('reads the thread and the projects alongside from a CLI on threads', () => {
    const session = {
      ...makeContext('2026-10-28T10:13:00.000Z'),
      schemaVersion: 1,
      thread: { key: 'workscribe/landing-page|2026-10-28T10:13:00.000Z', projectId: 3, activeMinutes: 35 },
      block: { startedAt: '2026-10-28T08:22:00.000Z', endedAt: '2026-10-28T17:15:00.000Z', activeMinutes: 395 },
      alongside: [CLI_ALONGSIDE],
    }

    assert.deepStrictEqual(threadOf(session), { activeMinutes: 35, alongside: [CLI_ALONGSIDE] })
  })

  test('is null from a CLI before threads, or one that answered from sessions', () => {
    assert.strictEqual(threadOf(makeContext('2026-10-28T10:13:00.000Z')), null)
    assert.strictEqual(
      threadOf({ ...makeContext('2026-10-28T10:13:00.000Z'), thread: null, block: null, alongside: null }),
      null,
    )
  })

  test("drops an alongside entry that isn't well formed, keeping the rest", () => {
    const session = {
      ...makeContext('2026-10-28T10:13:00.000Z'),
      thread: { key: 'k', projectId: 3, activeMinutes: 35 },
      alongside: [CLI_ALONGSIDE, { repoName: 42 }, null, 'workscribe/vscode'] as unknown as SessionContext['alongside'],
    }

    assert.deepStrictEqual(threadOf(session)?.alongside, [CLI_ALONGSIDE])
  })
})
