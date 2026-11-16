import * as assert from 'node:assert'
import type { FileDetails, SessionContext } from '../../../src/cli/context'
import { escapeHtml, renderSummary, sessionTabHtml, type TabState } from '../../../src/sessionTab/sessionTabHtml'
import { formatSessionSpan } from '../../../src/shared/sessionTime'
import {
  CLI_ALONGSIDE,
  FILE_AGENT_NO_RECAP,
  FILE_EDITOR_ONLY,
  FILE_MALFORMED_CHANGES,
  FILE_WITH_AGENT_AND_RECAP,
  ON_A_THREAD,
  ON_A_THREAD_ALONE,
} from '../threadFixtures'

const NONCE = 'test-nonce'

const FILE_DETAILS: FileDetails = {
  path: '/Users/dev/api/README.md',
  relativePath: 'README.md',
  firstSavedAt: '2026-10-28T09:12:00.000Z',
  lastSavedAt: '2026-10-28T10:30:00.000Z',
  saveCount: 3,
  branch: 'main',
  commits: [],
  editedAlongside: { files: [], total: 0 },
}

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    repoName: 'acme/api',
    date: '2026-10-28',
    startedAt: '2026-10-28T09:10:00.000Z',
    endedAt: '2026-10-28T10:40:00.000Z',
    timeAgo: '2 hours ago',
    durationMinutes: 90,
    branch: 'main',
    eventCount: 12,
    summary: '## api (main) — 1h 30m\n- Fixed the token refresh race (a1b2c3d)\n- Added tests',
    file: FILE_DETAILS,
    ...overrides,
  }
}

const page = (state: TabState) => sessionTabHtml(state, { nonce: NONCE })

suite('escapeHtml', () => {
  test('escapes every character that could start markup or break out of an attribute', () => {
    assert.strictEqual(
      escapeHtml(`<a href="x" onclick='y'>&</a>`),
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })
})

suite('renderSummary', () => {
  test('turns headings, bullets and paragraphs into HTML, grouping bullets into one list', () => {
    assert.strictEqual(
      renderSummary('## api (main)\n- one\n- two\n\nA closing note'),
      '<h3>api (main)</h3>\n<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<p>A closing note</p>',
    )
  })

  test('only `## ` lines are headings — `#tag`, `# Title` and `### x` stay text', () => {
    assert.strictEqual(renderSummary('#tag\n# Title\n### x'), '<p>#tag</p>\n<p># Title</p>\n<p>### x</p>')
  })

  test('renders code spans, escaped', () => {
    assert.strictEqual(
      renderSummary('- ran `npm test <ci>`'),
      '<ul>\n<li>ran <code>npm test &lt;ci&gt;</code></li>\n</ul>',
    )
  })

  test('never lets summary text become markup', () => {
    const html = renderSummary('## <script>alert(1)</script>\n- <img src=x onerror=alert(1)>\n<b>bold</b>')
    assert.ok(!html.includes('<script'))
    assert.ok(!html.includes('<img'))
    assert.ok(!html.includes('<b>'))
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'))
  })
})

suite('sessionTabHtml — the page', () => {
  test('locks the page down: no scripts, styles only with this page’s nonce', () => {
    const html = page({ kind: 'no-file' })
    assert.ok(html.includes(`content="default-src 'none'; style-src 'nonce-${NONCE}';"`))
    assert.ok(html.includes(`<style nonce="${NONCE}">`))
    assert.ok(!html.includes('<script'))
    assert.ok(!/ style="/.test(html), 'no inline style attributes — the CSP blocks them')
  })

  test('shows the whole session with the file it was opened from', () => {
    const html = page({ kind: 'session', session: session(), filePath: '/Users/dev/api/README.md' })
    assert.ok(html.includes('<h2>acme/api</h2>'))
    assert.ok(html.includes('1h 30m'))
    assert.ok(html.includes('on main'))
    assert.ok(html.includes('12 events'))
    assert.ok(html.includes('Last worked on with <code>README.md</code>'))
    assert.ok(html.includes('<li>Fixed the token refresh race (a1b2c3d)</li>'))
  })

  test('escapes every CLI value in the session view', () => {
    const html = page({
      kind: 'session',
      session: session({
        repoName: '<script>repo</script>',
        branch: '"><img onerror=1>',
        file: null,
        summary: '<iframe>',
      }),
      filePath: '/tmp/<evil>.ts',
    })
    for (const markup of ['<script>repo', '<img', '<iframe', '<evil>']) {
      assert.ok(!html.includes(markup), `${markup} should be escaped`)
    }
  })

  test('works with CLI 2.0 answers: no repo name, no file details', () => {
    const html = page({
      kind: 'session',
      session: session({ repoName: undefined, file: undefined, summary: null, branch: null, eventCount: 1 }),
      filePath: '/Users/dev/api/src/index.ts',
    })
    assert.ok(html.includes('<h2>This session</h2>'))
    assert.ok(html.includes('Last worked on with <code>index.ts</code>'))
    assert.ok(html.includes('1 event'))
    assert.ok(html.includes('No summary yet.'))
  })

  test('shows the thread: its active time, and each project worked alongside with when and how long', () => {
    const html = page({ kind: 'session', session: session(ON_A_THREAD), filePath: '/Users/dev/api/README.md' })

    assert.ok(html.includes('35m active'))
    assert.ok(html.includes('<h3>Worked alongside</h3>'))
    assert.ok(html.includes('<strong>workscribe/cli</strong>'))
    assert.ok(html.includes('4h 40m active'))
    assert.ok(html.includes('369 events'))
    assert.ok(html.includes('<strong>Outside a repo</strong>'))
    assert.ok(html.indexOf('workscribe/cli') < html.indexOf('Outside a repo'))
  })

  test('shows the active time and no alongside section when the project was the only one worked', () => {
    const html = page({ kind: 'session', session: session(ON_A_THREAD_ALONE), filePath: '/Users/dev/api/README.md' })

    assert.ok(html.includes('35m active'))
    assert.ok(!html.includes('Worked alongside'))
  })

  test('names a project with an empty name as outside a repo', () => {
    const alongside = [{ ...CLI_ALONGSIDE, repoName: '' }]
    const html = page({ kind: 'session', session: session({ ...ON_A_THREAD, alongside }), filePath: '/a.ts' })

    assert.ok(html.includes('<strong>Outside a repo</strong>'))
  })

  test('escapes the names of projects worked alongside', () => {
    const alongside = [{ ...CLI_ALONGSIDE, repoName: '<script>x</script>' }]
    const html = page({ kind: 'session', session: session({ ...ON_A_THREAD, alongside }), filePath: '/a.ts' })

    assert.ok(!html.includes('<script>x'))
  })

  test('is exactly as before when the CLI answered from sessions', () => {
    const state = (extra: Partial<SessionContext>): TabState => ({
      kind: 'session',
      session: session(extra),
      filePath: '/Users/dev/api/README.md',
    })

    const answeredFromSessions = page(state({ thread: null, block: null, alongside: null }))

    assert.strictEqual(answeredFromSessions, page(state({})))
    // The 0.2.0 facts line and body, exactly: no active time, nothing alongside
    const span = formatSessionSpan('2026-10-28T09:10:00.000Z', '2026-10-28T10:40:00.000Z')
    assert.ok(answeredFromSessions.includes(`<p class="facts">${span} · 1h 30m · on main · 12 events</p>`))
    assert.ok(!answeredFromSessions.includes('m active'))
    assert.ok(!answeredFromSessions.includes('Worked alongside'))
  })

  test('explains each empty state, with a link where there is something to do', () => {
    const expectations: [TabState, string, string?][] = [
      [{ kind: 'resolving' }, 'Looking for the Workscribe CLI'],
      [{ kind: 'restricted' }, 'off in Restricted Mode', 'href="command:workbench.trust.manage"'],
      [
        { kind: 'no-cli' },
        '<code>npm install -g @workscribe/cli</code>',
        'href="command:workbench.action.openSettings?',
      ],
      [{ kind: 'no-file' }, 'Open a file to see the session'],
      [{ kind: 'loading' }, 'Loading'],
      [{ kind: 'none' }, 'No saved activity for this file yet'],
      [{ kind: 'failed' }, 'Workscribe didn&#39;t answer just now'],
    ]
    for (const [state, text, link] of expectations) {
      const html = page(state)
      assert.ok(html.includes(text), `${state.kind}: ${text}`)
      if (link) assert.ok(html.includes(link), `${state.kind}: ${link}`)
    }
  })

  test('the settings link opens the binary path setting', () => {
    const html = page({ kind: 'no-cli' })
    const encodedArgument = encodeURIComponent(JSON.stringify(['workscribe.binaryPath']))
    assert.ok(html.includes(`command:workbench.action.openSettings?${encodedArgument}`))
  })
})

suite('sessionTabHtml: who changed the file', () => {
  const pageWithChanges = (changes: object) =>
    page({
      kind: 'session',
      session: session({ file: { ...FILE_DETAILS, ...changes } }),
      filePath: '/Users/dev/api/README.md',
    })

  test('lists you and each agent with how many changes and lines', () => {
    const html = pageWithChanges(FILE_WITH_AGENT_AND_RECAP)

    assert.ok(html.includes('<h3>Who changed this file</h3>'))
    assert.ok(html.includes('<li><strong>You</strong> · 4 saves · +10 \u22122</li>'))
    assert.ok(html.includes('<li><strong>Claude Code</strong> · 2 edits · +87 \u221212</li>'))
  })

  test('shows what the agent said in full, after the summary', () => {
    const html = pageWithChanges(FILE_WITH_AGENT_AND_RECAP)

    assert.ok(html.includes('<h3>What the agent said</h3>'))
    assert.ok(html.includes('<p class="recap-text">Added token refresh to the auth middleware</p>'))
    assert.ok(html.indexOf('class="summary"') < html.indexOf('Who changed this file'))
  })

  test('does not cut a long recap', () => {
    const recap = `${'word '.repeat(100)}end`

    const html = pageWithChanges({
      ...FILE_WITH_AGENT_AND_RECAP,
      agentSessions: [{ ...FILE_WITH_AGENT_AND_RECAP.agentSessions?.[0], recap }],
    })

    assert.ok(html.includes(`${recap}</p>`))
  })

  test('shows no recap section when only you changed the file', () => {
    const html = pageWithChanges(FILE_EDITOR_ONLY)

    assert.ok(html.includes('<li><strong>You</strong> · 4 saves · +10 \u22122</li>'))
    assert.ok(!html.includes('What the agent said'))
  })

  test('shows no recap section when the agent kept none', () => {
    const html = pageWithChanges(FILE_AGENT_NO_RECAP)

    assert.ok(html.includes('<strong>Claude Code</strong>'))
    assert.ok(!html.includes('What the agent said'))
  })

  test('escapes every value, and drops entries that are not well formed', () => {
    const html = pageWithChanges(FILE_MALFORMED_CHANGES)

    assert.ok(!html.includes('<script>'))
    assert.ok(!html.includes('<b>Cursor</b>'))
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
    assert.ok(html.includes('&lt;b&gt;Cursor&lt;/b&gt;'))
  })

  test('is exactly as before with a CLI before 3.3, which sends none of the new fields', () => {
    const html = page({ kind: 'session', session: session(), filePath: '/Users/dev/api/README.md' })

    assert.ok(!html.includes('Who changed this file'))
    assert.ok(!html.includes('What the agent said'))
  })

  test('still locks the page down: no inline styles, and scripts only with the nonce', () => {
    const html = pageWithChanges(FILE_WITH_AGENT_AND_RECAP)

    assert.ok(!/ style="/.test(html))
    assert.ok(!html.includes('<script'))
  })
})
