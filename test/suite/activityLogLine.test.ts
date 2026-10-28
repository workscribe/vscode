import * as assert from 'node:assert'
import { formatCaptureStatus, formatLogLine } from '../../src/activityLogLine'

const TIME = new Date(2026, 9, 28, 9, 41, 7)

suite('formatLogLine', () => {
  test('time, "sent", the event as people say it, and what it was about — aligned', () => {
    assert.strictEqual(
      formatLogLine({ time: TIME, type: 'code_edit', target: 'README.md' }),
      '09:41:07  sent  save         README.md',
    )
    assert.strictEqual(
      formatLogLine({ time: TIME, type: 'debug_start', target: 'api' }),
      '09:41:07  sent  debug start  api',
    )
    assert.strictEqual(
      formatLogLine({ time: TIME, type: 'task_run', target: '/abs/folder' }),
      '09:41:07  sent  task end     /abs/folder',
    )
  })
})

suite('formatCaptureStatus', () => {
  test('says whether capture is on, and why not', () => {
    assert.strictEqual(
      formatCaptureStatus({ kind: 'on', binaryPath: '/usr/local/bin/workscribe' }),
      'Capture on — events go to /usr/local/bin/workscribe',
    )
    assert.strictEqual(
      formatCaptureStatus({ kind: 'restricted' }),
      'Capture off — this workspace is in Restricted Mode',
    )
    assert.strictEqual(formatCaptureStatus({ kind: 'no-cli' }), 'Capture off — Workscribe CLI not found')
  })
})
