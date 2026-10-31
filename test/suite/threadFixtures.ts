// What a CLI on threads (2.2+) adds to a `context --file --json` answer, shared by the tooltip and tab tests: the
// landing-page README's thread, with cli, work outside a repo and vscode worked alongside it.
import type { AlongsideThread, SessionContext } from '../../src/cli/context'

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
