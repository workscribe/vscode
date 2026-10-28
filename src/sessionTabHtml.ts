// The Workscribe tab's HTML. Pure: the state in, a full page out.
//
// Summaries are written by the agent skill or by hand, so everything from the CLI is escaped, and the only markup is
// what renderSummary builds from a known shape (## headings, - bullets, `code`). The page runs no scripts; its
// links are command links VS Code allows by name (see sessionTab.ts).
import path from 'node:path'
import { BINARY_PATH_SETTING, MANAGE_TRUST_COMMAND, OPEN_SETTINGS_COMMAND } from './constants'
import type { SessionContext } from './context'
import type { CliState } from './sessionTabController'
import { formatSessionDuration, formatSessionSpan } from './sessionTime'

/** What the tab shows: why it can't ask the CLI yet (any CLI state but ready), or what it found. */
export type TabState =
  | Exclude<CliState, { kind: 'ready' }>
  | { kind: 'no-file' }
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'failed' }
  | { kind: 'session'; session: SessionContext; filePath: string }

const OPEN_BINARY_PATH_SETTING = `command:${OPEN_SETTINGS_COMMAND}?${encodeURIComponent(JSON.stringify([BINARY_PATH_SETTING]))}`
const MANAGE_WORKSPACE_TRUST = `command:${MANAGE_TRUST_COMMAND}`

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Escapes a line, then turns `code` spans into <code>. */
function renderInlineMarkup(text: string): string {
  return escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>')
}

/** A summary as HTML: `## ` headings, `- ` bullets (grouped into lists), any other line as a paragraph. */
export function renderSummary(summary: string): string {
  const html: string[] = []
  let listOpen = false
  const closeList = () => {
    if (listOpen) html.push('</ul>')
    listOpen = false
  }
  for (const rawLine of summary.split('\n')) {
    const line = rawLine.trim()
    if (line.startsWith('- ')) {
      if (!listOpen) html.push('<ul>')
      listOpen = true
      html.push(`<li>${renderInlineMarkup(line.slice(2))}</li>`)
      continue
    }
    closeList()
    if (line.startsWith('## ')) html.push(`<h3>${renderInlineMarkup(line.slice(3))}</h3>`)
    else if (line) html.push(`<p>${renderInlineMarkup(line)}</p>`)
  }
  closeList()
  return html.join('\n')
}

function renderMessage(text: string, link?: { href: string; label: string }): string {
  const action = link ? ` <a href="${link.href}">${escapeHtml(link.label)}</a>` : ''
  return `<p class="message">${renderInlineMarkup(text)}${action}</p>`
}

/** The file as the session saw it: the CLI's repo-relative path (2.1+), else just its name. */
function describeFile(session: SessionContext, filePath: string): string {
  return session.file?.relativePath ?? path.basename(filePath)
}

function renderSessionBody(session: SessionContext, filePath: string): string {
  const facts = [
    formatSessionSpan(session.startedAt, session.endedAt),
    formatSessionDuration(session.durationMinutes),
    session.branch ? `on ${session.branch}` : null,
    `${session.eventCount} event${session.eventCount === 1 ? '' : 's'}`,
  ].filter((fact): fact is string => fact !== null)
  return [
    '<header>',
    `<h2>${escapeHtml(session.repoName ?? 'This session')}</h2>`,
    `<p class="facts">${facts.map(escapeHtml).join(' · ')}</p>`,
    `<p class="subtitle">Last worked on with <code>${escapeHtml(describeFile(session, filePath))}</code></p>`,
    '</header>',
    session.summary
      ? `<section class="summary">${renderSummary(session.summary)}</section>`
      : renderMessage('No summary yet.'),
  ].join('\n')
}

function renderBody(state: TabState): string {
  switch (state.kind) {
    case 'resolving':
      return renderMessage('Looking for the Workscribe CLI…')
    case 'restricted':
      return renderMessage(
        'Workscribe is off in Restricted Mode. Trust this workspace to capture your work and see its sessions.',
        {
          href: MANAGE_WORKSPACE_TRUST,
          label: 'Manage workspace trust',
        },
      )
    case 'no-cli':
      return renderMessage(
        'Workscribe CLI not found. Install it with `npm install -g @workscribe/cli`, or set its path.',
        {
          href: OPEN_BINARY_PATH_SETTING,
          label: 'Set the path',
        },
      )
    case 'no-file':
      return renderMessage('Open a file to see the session you last worked on it in.')
    case 'loading':
      return renderMessage('Loading…')
    case 'none':
      return renderMessage(
        'No saved activity for this file yet. Workscribe records a file when you save it in VS Code.',
      )
    case 'failed':
      return renderMessage("Workscribe didn't answer just now. It tries again when you switch files or save.")
    case 'session':
      return renderSessionBody(state.session, state.filePath)
  }
}

// Theme colours and fonts are set here rather than left to VS Code's injected defaults, which the nonce-only CSP
// may block. Classes only: the CSP also blocks inline style="" attributes.
const STYLES = `
body { color: var(--vscode-foreground); background: var(--vscode-panel-background, transparent);
  font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); padding: 0 12px 12px; line-height: 1.5; }
h2 { font-size: 1.15em; margin: 12px 0 2px; }
h3 { font-size: 1em; margin: 12px 0 4px; }
.facts, .subtitle, .message { color: var(--vscode-descriptionForeground); margin: 2px 0; }
.message { margin-top: 12px; }
ul { margin: 4px 0; padding-left: 20px; }
code { font-family: var(--vscode-editor-font-family); background: var(--vscode-textCodeBlock-background); padding: 0 3px; border-radius: 3px; }
a { color: var(--vscode-textLink-foreground); }
a:hover { color: var(--vscode-textLink-activeForeground); }
`

/** The whole page for a state. `nonce` must be fresh per page: it's the only thing the CSP lets style the page. */
export function sessionTabHtml(state: TabState, options: { nonce: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${options.nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style nonce="${options.nonce}">${STYLES}</style>
</head>
<body>
${renderBody(state)}
</body>
</html>`
}
