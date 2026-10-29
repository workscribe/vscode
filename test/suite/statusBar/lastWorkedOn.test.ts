import * as assert from 'node:assert'
import type { SessionContext } from '../../../src/cli/context'
import {
  accessibilityLabel,
  escapeMarkdown,
  sessionExcerpt,
  showSessionLink,
  statusText,
  tooltipMarkdown,
} from '../../../src/statusBar/lastWorkedOn'

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
})
