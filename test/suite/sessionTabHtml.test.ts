import * as assert from 'node:assert'
import type { SessionContext } from '../../src/context'
import { escapeHtml, renderSummary, sessionTabHtml, type TabState } from '../../src/sessionTabHtml'

const NONCE = 'test-nonce'

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
    file: {
      path: '/Users/dev/api/README.md',
      relativePath: 'README.md',
      firstSavedAt: '2026-10-28T09:12:00.000Z',
      lastSavedAt: '2026-10-28T10:30:00.000Z',
      saveCount: 3,
      branch: 'main',
      commits: [],
      editedAlongside: { files: [], total: 0 },
    },
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
