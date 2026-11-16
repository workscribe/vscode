import * as assert from 'node:assert'
import type { FileDetails, SessionContext } from '../../../src/cli/context'
import { fileChangesOf, LAST_WORKED_ON_THRESHOLD_MS, shouldSurface, threadOf } from '../../../src/cli/context'
import {
  CLI_ALONGSIDE,
  FILE_AGENT_NO_RECAP,
  FILE_AGENT_ONLY,
  FILE_EDITOR_ONLY,
  FILE_MALFORMED_CHANGES,
  FILE_WITH_AGENT_AND_RECAP,
} from '../threadFixtures'

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

const FILE_BEFORE_3_3: FileDetails = {
  path: '/Users/dev/api/README.md',
  relativePath: 'README.md',
  firstSavedAt: '2026-10-28T09:12:00.000Z',
  lastSavedAt: '2026-10-28T10:30:00.000Z',
  saveCount: 3,
  branch: 'main',
  commits: [],
  editedAlongside: { files: [], total: 0 },
}

suite('fileChangesOf', () => {
  test('reads who changed the file, and what the agent said', () => {
    const changes = fileChangesOf({ ...FILE_BEFORE_3_3, ...FILE_WITH_AGENT_AND_RECAP })

    assert.deepStrictEqual(changes, {
      editorSaves: 4,
      agentEdits: 2,
      linesAdded: 97,
      linesRemoved: 14,
      changedBy: FILE_WITH_AGENT_AND_RECAP.changedBy,
      agentSessions: FILE_WITH_AGENT_AND_RECAP.agentSessions,
    })
  })

  test('is null from a CLI before 3.3, which sends none of the new fields', () => {
    assert.strictEqual(fileChangesOf(FILE_BEFORE_3_3), null)
  })

  test('is null when only one of the two counts is there', () => {
    assert.strictEqual(fileChangesOf({ ...FILE_BEFORE_3_3, editorSaves: 3 }), null)
  })

  test('is a view, not null, for a file no agent touched', () => {
    const changes = fileChangesOf({ ...FILE_BEFORE_3_3, ...FILE_EDITOR_ONLY })

    assert.strictEqual(changes?.agentEdits, 0)
    assert.deepStrictEqual(changes?.agentSessions, [])
  })

  test('keeps a session with no recap, as one without text', () => {
    const changes = fileChangesOf({ ...FILE_BEFORE_3_3, ...FILE_AGENT_NO_RECAP })

    assert.strictEqual(changes?.agentSessions[0].recap, null)
  })

  test('keeps an agent-only answer as it is', () => {
    const changes = fileChangesOf({ ...FILE_BEFORE_3_3, ...FILE_AGENT_ONLY })

    assert.deepStrictEqual(
      changes?.changedBy.map((who) => who.agent),
      ['Claude Code'],
    )
  })

  test('drops an entry that is not an object or has no count, keeping the rest', () => {
    const changes = fileChangesOf({ ...FILE_BEFORE_3_3, ...FILE_MALFORMED_CHANGES })

    assert.deepStrictEqual(
      changes?.changedBy.map((who) => who.agent),
      ['<script>alert(1)</script>', 'Claude Code'],
    )
  })

  test('keeps an entry that has a count but no line counts, with its lines unknown', () => {
    const changes = fileChangesOf({ ...FILE_BEFORE_3_3, ...FILE_MALFORMED_CHANGES })

    assert.deepStrictEqual(changes?.changedBy[1], {
      source: 'claude-code',
      agent: 'Claude Code',
      count: 2,
      linesAdded: null,
      linesRemoved: null,
    })
  })

  test('drops a session with no start or a recap that is not text, keeping the rest', () => {
    const changes = fileChangesOf({ ...FILE_BEFORE_3_3, ...FILE_MALFORMED_CHANGES })

    assert.deepStrictEqual(
      changes?.agentSessions.map((agentSession) => agentSession.agent),
      ['<b>Cursor</b>'],
    )
  })

  test('reads line counts that are not numbers as unknown', () => {
    const changes = fileChangesOf({ ...FILE_BEFORE_3_3, ...FILE_MALFORMED_CHANGES })

    assert.strictEqual(changes?.linesAdded, null)
    assert.strictEqual(changes?.linesRemoved, null)
  })

  test('does not throw when the lists are not lists', () => {
    const file = {
      ...FILE_BEFORE_3_3,
      editorSaves: 1,
      agentEdits: 0,
      changedBy: 'x',
      agentSessions: 7,
    } as unknown as FileDetails

    assert.deepStrictEqual(fileChangesOf(file)?.changedBy, [])
  })
})
