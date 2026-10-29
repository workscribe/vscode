import * as assert from 'node:assert'
import { formatSessionDuration, formatSessionSpan } from '../../../src/shared/sessionTime'

/** An ISO timestamp for a local date and time, so the tests pass in any time zone. */
function local(year: number, month: number, day: number, hours: number, minutes: number): string {
  return new Date(year, month - 1, day, hours, minutes).toISOString()
}

suite('formatSessionSpan', () => {
  test('one day: the day, then the start and end times', () => {
    assert.strictEqual(
      formatSessionSpan(local(2026, 10, 28, 9, 10), local(2026, 10, 28, 10, 40)),
      'Wed 28 Oct, 09:10–10:40',
    )
  })

  test('past midnight: both days', () => {
    assert.strictEqual(
      formatSessionSpan(local(2026, 10, 28, 23, 30), local(2026, 10, 29, 0, 45)),
      'Wed 28 Oct, 23:30 – Thu 29 Oct, 00:45',
    )
  })
})

suite('formatSessionSpan — bad timestamps', () => {
  test('shows timestamps that do not parse as they came, not NaN', () => {
    assert.strictEqual(
      formatSessionSpan('yesterday', '2026-10-28T10:00:00.000Z'),
      'yesterday – 2026-10-28T10:00:00.000Z',
    )
  })
})

suite('formatSessionDuration', () => {
  test('under a minute, minutes, hours, and both', () => {
    assert.strictEqual(formatSessionDuration(0.4), 'under a minute')
    assert.strictEqual(formatSessionDuration(45), '45m')
    assert.strictEqual(formatSessionDuration(120), '2h')
    assert.strictEqual(formatSessionDuration(134), '2h 14m')
  })
})
