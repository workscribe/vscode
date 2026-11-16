import * as assert from 'node:assert'
import type { SessionContext } from '../../../src/cli/context'
import { RECAP_TOOLTIP_MAX_CHARS } from '../../../src/constants'
import {
  accessibilityLabel,
  escapeMarkdown,
  sessionExcerpt,
  showSessionLink,
  statusText,
  tooltipMarkdown,
} from '../../../src/statusBar/lastWorkedOn'
import {
  CLI_ALONGSIDE,
  FILE_AGENT_NO_RECAP,
  FILE_AGENT_ONLY,
  FILE_EDITOR_ONLY,
  FILE_MALFORMED_CHANGES,
  FILE_WITH_AGENT_AND_RECAP,
  ON_A_THREAD,
  ON_A_THREAD_ALONE,
} from '../threadFixtures'

const FILE = '/Users/dev/api/src/auth.ts'

const STORY_SUMMARY = [
  '## api (main, feat/auth) — 1h 26m',
  '- Note: blocked on staging creds',
  'On main:',
  '- Committed: fix: token refresh race',
  '- Tests now passing',
  'On feat/auth:',
  '- Committed: feat: add auth middleware',
  'With an AI coding assistant (3 commands) · 1 file save in the editor',
].join('\n')

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    date: '2026-10-03',
    startedAt: '2026-10-03T09:00:00.000Z',
    endedAt: '2026-10-03T10:26:00.000Z',
    timeAgo: '25 days ago',
    durationMinutes: 86,
    branch: 'feat/auth',
    eventCount: 12,
    summary: STORY_SUMMARY,
    ...overrides,
  }
}

const FILE_DETAILS = {
  path: FILE,
  relativePath: 'src/auth.ts',
  firstSavedAt: '2026-10-03T09:10:00.000Z',
  lastSavedAt: '2026-10-03T10:20:00.000Z',
  saveCount: 6,
  branch: 'feat/auth',
  commits: [{ hash: 'a1b2c3d', subject: 'feat: add auth middleware' }],
  editedAlongside: { files: [], total: 0 },
}

suite('statusText and accessibilityLabel', () => {
  test('reads "WS · 25 days ago", spelled out for screen readers', () => {
    assert.strictEqual(statusText(session()), 'WS · 25 days ago')
    assert.strictEqual(accessibilityLabel(session()), 'Workscribe: you last worked on this file 25 days ago')
  })
})

suite('sessionExcerpt', () => {
  test('takes the heading and the first 3 bullets, skipping branch and activity lines', () => {
    assert.deepStrictEqual(sessionExcerpt(STORY_SUMMARY), {
      heading: 'api (main, feat/auth) — 1h 26m',
      bullets: ['Note: blocked on staging creds', 'Committed: fix: token refresh race', 'Tests now passing'],
    })
  })

  test('reads a summary the agent skill saved', () => {
    const skillSummary = '## api (main) — 1h\n- Fixed the token refresh race (a1b2c3d)\n- Added regression tests'

    assert.deepStrictEqual(sessionExcerpt(skillSummary), {
      heading: 'api (main) — 1h',
      bullets: ['Fixed the token refresh race (a1b2c3d)', 'Added regression tests'],
    })
  })

  test('has no heading for text without one', () => {
    assert.deepStrictEqual(sessionExcerpt('just a line'), { heading: null, bullets: [] })
  })
})

suite('escapeMarkdown', () => {
  test('shows data as itself, never as a link or formatting', () => {
    assert.strictEqual(
      escapeMarkdown('[click](command:evil) *bold* `code` # x'),
      '\\[click\\]\\(command:evil\\) \\*bold\\* \\`code\\` \\# x',
    )
  })

  test('escapes a backslash once, before anything else', () => {
    assert.strictEqual(escapeMarkdown('a\\*b'), 'a\\\\\\*b')
  })
})

suite('showSessionLink', () => {
  test('passes the file to workscribe.showSession, encoded', () => {
    const link = showSessionLink('/a b/(c).ts')

    assert.ok(link.startsWith('command:workscribe.showSession?'))
    const argument = decodeURIComponent(link.slice('command:workscribe.showSession?'.length))
    assert.deepStrictEqual(JSON.parse(argument), ['/a b/(c).ts'])
  })
})

suite('tooltipMarkdown', () => {
  test('tells the file, its commits, the session and how to open it', () => {
    const markdown = tooltipMarkdown(session({ file: FILE_DETAILS }), FILE)

    assert.ok(markdown.startsWith('**Workscribe** · you last worked on this file 25 days ago'))
    assert.ok(markdown.includes('**About this file**'))
    assert.ok(markdown.includes('- Changes recorded: 6 (one per file per 30 s)'))
    assert.ok(markdown.includes('- Branch: feat/auth'))
    assert.ok(markdown.includes('- `a1b2c3d` feat: add auth middleware'))
    assert.ok(markdown.includes('**From the session**'))
    assert.ok(markdown.includes('- Tests now passing'))
    assert.ok(!markdown.includes('On main'))
    assert.ok(markdown.endsWith(`[Open session in Workscribe](${showSessionLink(FILE)})`))
  })

  test('shows the session part only with an older CLI that sends no file details', () => {
    const markdown = tooltipMarkdown(session(), FILE)

    assert.ok(!markdown.includes('About this file'))
    assert.ok(!markdown.includes('**Commits**'))
    assert.ok(markdown.includes('**From the session**'))
  })

  test('lists at most 3 commits, then how many more', () => {
    const commits = ['one', 'two', 'three', 'four', 'five'].map((subject, index) => ({
      hash: `a1b2c3${index}`,
      subject,
    }))

    const markdown = tooltipMarkdown(session({ file: { ...FILE_DETAILS, commits } }), FILE)

    assert.ok(markdown.includes('- `a1b2c32` three'))
    assert.ok(!markdown.includes('four'))
    assert.ok(markdown.includes('- and 2 more'))
  })

  test('escapes commit subjects and summary lines, so they cannot add links', () => {
    const file = { ...FILE_DETAILS, commits: [{ hash: 'a1b2c3d', subject: '[x](command:evil)' }] }
    const markdown = tooltipMarkdown(session({ file, summary: '## api\n- see [docs](https://evil)' }), FILE)

    assert.ok(markdown.includes('\\[x\\]\\(command:evil\\)'))
    assert.ok(markdown.includes('see \\[docs\\]\\(https://evil\\)'))
    assert.ok(!markdown.includes('](command:evil)'))
  })

  test('leaves the session part out when there is no summary', () => {
    assert.ok(!tooltipMarkdown(session({ summary: null }), FILE).includes('From the session'))
  })

  test('names the projects worked alongside, after the session and before the link — not work outside a repo', () => {
    const markdown = tooltipMarkdown(session({ file: FILE_DETAILS, ...ON_A_THREAD }), FILE)

    assert.ok(markdown.includes('**Worked alongside** workscribe/cli, workscribe/vscode'))
    assert.ok(!markdown.includes('null'))
    assert.ok(markdown.indexOf('**From the session**') < markdown.indexOf('**Worked alongside**'))
    assert.ok(markdown.endsWith(`[Open session in Workscribe](${showSessionLink(FILE)})`))
  })

  test('names at most 3 projects alongside, then how many more, escaped', () => {
    const named = ['a/one', 'b/[two](command:evil)', 'c/three', 'd/four', 'e/five'].map((repoName) => ({
      ...CLI_ALONGSIDE,
      repoName,
    }))

    const markdown = tooltipMarkdown(session({ ...ON_A_THREAD, alongside: named }), FILE)

    assert.ok(markdown.includes('a/one, b/\\[two\\]\\(command:evil\\), c/three and 2 more'))
    assert.ok(!markdown.includes('d/four'))
  })

  test('is exactly as before on a thread with nobody alongside', () => {
    assert.strictEqual(
      tooltipMarkdown(session({ file: FILE_DETAILS, ...ON_A_THREAD_ALONE }), FILE),
      tooltipMarkdown(session({ file: FILE_DETAILS }), FILE),
    )
  })

  test('is exactly as before when the CLI answered from sessions, or sends no thread at all', () => {
    const before = tooltipMarkdown(session({ file: FILE_DETAILS }), FILE)

    assert.strictEqual(
      tooltipMarkdown(session({ file: FILE_DETAILS, thread: null, block: null, alongside: null }), FILE),
      before,
    )
    assert.ok(!before.includes('Worked alongside'))
  })
})

suite('tooltipMarkdown: who changed the file', () => {
  const withChanges = (changes: object) => tooltipMarkdown(session({ file: { ...FILE_DETAILS, ...changes } }), FILE)

  test('says who changed the file and by how many lines, in place of "Changes recorded"', () => {
    const markdown = withChanges(FILE_WITH_AGENT_AND_RECAP)

    assert.ok(
      markdown.includes('- Changes: 4 saves in your editor (+10 \u22122), 2 edits by Claude Code (+87 \u221212)'),
    )
    assert.ok(!markdown.includes('Changes recorded'))
  })

  test('shows what the agent said, after the commits and before the session', () => {
    const markdown = withChanges(FILE_WITH_AGENT_AND_RECAP)

    assert.ok(markdown.includes('**What the agent said**\n- Claude Code: Added token refresh to the auth middleware'))
    assert.ok(markdown.indexOf('**Commits**') < markdown.indexOf('**What the agent said**'))
    assert.ok(markdown.indexOf('**What the agent said**') < markdown.indexOf('**From the session**'))
  })

  test('names only you when only you changed the file, with no section for the agent', () => {
    const markdown = withChanges(FILE_EDITOR_ONLY)

    assert.ok(markdown.includes('- Changes: 4 saves in your editor (+10 \u22122)\n'))
    assert.ok(!markdown.includes('What the agent said'))
  })

  test('names only the agent when only an agent changed the file', () => {
    assert.ok(withChanges(FILE_AGENT_ONLY).includes('- Changes: 2 edits by Claude Code (+87 \u221212)\n'))
  })

  test('has no "What the agent said" section when no recap was kept', () => {
    const markdown = withChanges(FILE_AGENT_NO_RECAP)

    assert.ok(markdown.includes('2 edits by Claude Code'))
    assert.ok(!markdown.includes('What the agent said'))
  })

  test('says "1 save" and "1 edit", and leaves out line counts that are not known', () => {
    const markdown = withChanges({
      ...FILE_EDITOR_ONLY,
      changedBy: [{ source: 'vscode', agent: null, count: 1, linesAdded: null, linesRemoved: null }],
    })

    assert.ok(markdown.includes('- Changes: 1 save in your editor\n'))
  })

  test('shows a recap as one line, cut with an ellipsis at the limit', () => {
    const recap = `${'word '.repeat(60)}\nsecond line`

    const markdown = withChanges({
      ...FILE_AGENT_ONLY,
      agentSessions: [{ ...FILE_AGENT_ONLY.agentSessions?.[0], recap }],
    })

    const shown = markdown.split('\n').find((line) => line.startsWith('- Claude Code: ')) ?? ''
    assert.ok(shown.endsWith('\\\u2026') === false && shown.endsWith('\u2026'))
    assert.ok(shown.length - '- Claude Code: '.length <= RECAP_TOOLTIP_MAX_CHARS)
    assert.ok(!shown.includes('second line'))
  })

  test('escapes a recap, so it cannot add links or formatting', () => {
    const markdown = withChanges({
      ...FILE_AGENT_ONLY,
      agentSessions: [{ ...FILE_AGENT_ONLY.agentSessions?.[0], recap: 'Fixed *bold* [x](http://evil)\nand `code`' }],
    })

    assert.ok(markdown.includes('- Claude Code: Fixed \\*bold\\* \\[x\\]\\(http://evil\\) and \\`code\\`'))
  })

  test('escapes the agent names, and drops entries that are not well formed', () => {
    const markdown = withChanges(FILE_MALFORMED_CHANGES)

    assert.ok(markdown.includes('1 edit by \\<script\\>alert\\(1\\)\\</script\\> (+3 \u22121)'))
    assert.ok(!markdown.includes('<script>'))
    assert.ok(!markdown.includes('<b>'))
  })

  test('falls back to the counts when the CLI sent the fields but none of its entries were usable', () => {
    const markdown = withChanges({ ...FILE_WITH_AGENT_AND_RECAP, changedBy: [] })

    assert.ok(markdown.includes('- Changes: 4 saves in your editor, 2 edits by a coding agent\n'))
    assert.ok(!markdown.includes('Changes recorded'))
  })

  test('says how many changes were recorded when the CLI sent the fields but there was nothing to count', () => {
    const markdown = withChanges({ ...FILE_EDITOR_ONLY, editorSaves: 0, changedBy: [] })

    assert.ok(markdown.includes('- Changes recorded: 6 (one per file per 30 s)'))
  })

  test('is exactly as before with a CLI before 3.3, which sends none of the new fields', () => {
    const markdown = tooltipMarkdown(session({ file: FILE_DETAILS }), FILE)

    assert.ok(markdown.includes('- Changes recorded: 6 (one per file per 30 s)'))
    assert.ok(!markdown.includes('What the agent said'))
  })
})
