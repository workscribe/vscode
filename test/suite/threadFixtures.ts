// What a CLI on threads (3.0+) adds to a `context --file --json` answer, shared by the tooltip and tab tests: the
// landing-page README's thread, with cli, work outside a repo and vscode worked alongside it.
import type { AlongsideThread, FileDetails, SessionContext } from '../../src/cli/context'

export const CLI_ALONGSIDE: AlongsideThread = {
  repoName: 'workscribe/cli',
  startedAt: '2026-10-28T08:22:00.000Z',
  endedAt: '2026-10-28T17:15:00.000Z',
  eventCount: 369,
  activeMinutes: 280,
}

export const OUTSIDE_A_REPO_ALONGSIDE: AlongsideThread = {
  repoName: null,
  startedAt: '2026-10-28T08:30:00.000Z',
  endedAt: '2026-10-28T16:00:00.000Z',
  eventCount: 30,
  activeMinutes: 80,
}

export const VSCODE_ALONGSIDE: AlongsideThread = {
  repoName: 'workscribe/vscode',
  startedAt: '2026-10-28T09:00:00.000Z',
  endedAt: '2026-10-28T15:00:00.000Z',
  eventCount: 44,
  activeMinutes: 55,
}

export const ON_A_THREAD: Pick<SessionContext, 'schemaVersion' | 'thread' | 'block' | 'alongside'> = {
  schemaVersion: 1,
  thread: { key: 'workscribe/landing-page|2026-10-28T10:13:00.000Z', projectId: 3, activeMinutes: 35 },
  block: { startedAt: '2026-10-28T08:22:00.000Z', endedAt: '2026-10-28T17:15:00.000Z', activeMinutes: 395 },
  alongside: [CLI_ALONGSIDE, OUTSIDE_A_REPO_ALONGSIDE, VSCODE_ALONGSIDE],
}

/** On a thread, with nobody alongside: the file's project was the only one worked in that stretch. */
export const ON_A_THREAD_ALONE: typeof ON_A_THREAD = { ...ON_A_THREAD, alongside: [] }

// What a CLI from 3.3.0 adds to `file` in a `context --file --json` answer: who changed the file and what the agent said.
type ChangeFields = Pick<
  FileDetails,
  'editorSaves' | 'agentEdits' | 'linesAdded' | 'linesRemoved' | 'changedBy' | 'agentSessions'
>

const EDITOR_CHANGES = { source: 'vscode', agent: null, count: 4, linesAdded: 10, linesRemoved: 2 }
const CLAUDE_CHANGES = { source: 'claude-code', agent: 'Claude Code', count: 2, linesAdded: 87, linesRemoved: 12 }
const CLAUDE_SESSION = {
  source: 'claude-code',
  agent: 'Claude Code',
  startedAt: '2026-10-28T09:20:00.000Z',
  endedAt: '2026-10-28T09:50:00.000Z',
}

/** Four saves in the editor and two edits by Claude Code, whose session kept a recap. */
export const FILE_WITH_AGENT_AND_RECAP: ChangeFields = {
  editorSaves: 4,
  agentEdits: 2,
  linesAdded: 97,
  linesRemoved: 14,
  changedBy: [EDITOR_CHANGES, CLAUDE_CHANGES],
  agentSessions: [{ ...CLAUDE_SESSION, recap: 'Added token refresh to the auth middleware' }],
}

/** Only you changed it, so there are no agent sessions. */
export const FILE_EDITOR_ONLY: ChangeFields = {
  editorSaves: 4,
  agentEdits: 0,
  linesAdded: 10,
  linesRemoved: 2,
  changedBy: [EDITOR_CHANGES],
  agentSessions: [],
}

/** Only an agent changed it. */
export const FILE_AGENT_ONLY: ChangeFields = {
  editorSaves: 0,
  agentEdits: 2,
  linesAdded: 87,
  linesRemoved: 12,
  changedBy: [CLAUDE_CHANGES],
  agentSessions: [{ ...CLAUDE_SESSION, recap: 'Added token refresh to the auth middleware' }],
}

/** An agent changed it, and the user doesn't keep recaps (`capture.agentMessages` is off), so there is none to show. */
export const FILE_AGENT_NO_RECAP: ChangeFields = {
  ...FILE_AGENT_ONLY,
  agentSessions: [{ ...CLAUDE_SESSION, recap: null }],
}

/** What a payload that drifted could hold: entries missing a count, a recap that isn't text, markup in a name. */
export const FILE_MALFORMED_CHANGES = {
  editorSaves: 1,
  agentEdits: 1,
  linesAdded: 'many',
  linesRemoved: null,
  changedBy: [
    'not an object',
    { source: 'vscode', agent: null, linesAdded: 1, linesRemoved: 0 },
    { source: 'cursor', agent: '<script>alert(1)</script>', count: 1, linesAdded: 3, linesRemoved: 1 },
    { source: 'claude-code', agent: 'Claude Code', count: 2 },
  ],
  agentSessions: [
    null,
    { ...CLAUDE_SESSION, recap: 42 },
    { source: 'claude-code', agent: 'Claude Code', recap: 'no start' },
    { ...CLAUDE_SESSION, agent: '<b>Cursor</b>', recap: 'Fixed a <script>alert(1)</script> bug' },
  ],
} as unknown as ChangeFields
