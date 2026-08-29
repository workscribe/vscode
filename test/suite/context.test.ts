import * as assert from 'node:assert'
import type { SessionContext } from '../../src/context'
import { LAST_WORKED_ON_THRESHOLD_MS, shouldSurface } from '../../src/context'

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
