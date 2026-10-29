// What the "last worked on" status bar item says: its text, its spoken label and its tooltip. Pure — no `vscode` —
// so it's tested directly; statusBar.ts turns the markdown into a MarkdownString.

import type { FileDetails, SessionContext } from '../cli/context'
import { SHOW_SESSION_COMMAND } from '../constants'
import { formatDayAndTime } from '../shared/sessionTime'

const MAX_TOOLTIP_COMMITS = 3
const MAX_EXCERPT_BULLETS = 3
// Everything markdown could read as formatting or a link; the backslash goes first so it isn't escaped twice
const MARKDOWN_SPECIAL = /[\\`*_{}[\]()#+\-.!|<>&~]/g

/** Text from data (summaries, commit subjects, branch names) shown as itself, never as markdown. */
export function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SPECIAL, (character) => `\\${character}`)
}

/** "WS · 25 days ago" — the logo's letters, since status bar icons need a vector glyph the logo doesn't have yet. */
export function statusText(session: Pick<SessionContext, 'timeAgo'>): string {
  return `WS · ${session.timeAgo}`
}

/** What a screen reader says: "WS" alone means nothing read aloud. */
export function accessibilityLabel(session: Pick<SessionContext, 'timeAgo'>): string {
  return `Workscribe: you last worked on this file ${session.timeAgo}`
}

export interface SessionExcerpt {
  heading: string | null
  bullets: string[]
}

/**
 * The session's heading and its first few bullets. Plain lines — `On <branch>:` groups, the closing activity line —
 * are skipped: a short excerpt reads better as outcomes alone.
 */
export function sessionExcerpt(summary: string): SessionExcerpt {
  const lines = summary.split('\n').map((line) => line.trim())
  const headingLine = lines.find((line) => line.startsWith('## '))
  const bullets = lines
    .filter((line) => line.startsWith('- '))
    .slice(0, MAX_EXCERPT_BULLETS)
    .map((line) => line.slice(2))
  return { heading: headingLine ? headingLine.slice(3) : null, bullets }
}

/** A `command:` link that opens the tab on this file's session. */
export function showSessionLink(filePath: string): string {
  return `command:${SHOW_SESSION_COMMAND}?${encodeURIComponent(JSON.stringify([filePath]))}`
}

function fileSection(file: FileDetails): string[] {
  const facts = [
    `- Last changed: ${escapeMarkdown(formatDayAndTime(file.lastSavedAt))}`,
    // Capture keeps one change per file per 30 s, so this isn't every keystroke save
    `- Changes recorded: ${file.saveCount} (one per file per 30 s)`,
    ...(file.branch ? [`- Branch: ${escapeMarkdown(file.branch)}`] : []),
  ]
  return ['**About this file**', ...facts]
}

function commitsSection(file: FileDetails): string[] {
  if (file.commits.length === 0) return []
  const shown = file.commits
    .slice(0, MAX_TOOLTIP_COMMITS)
    .map((commit) => `- \`${commit.hash}\` ${escapeMarkdown(commit.subject)}`)
  const hiddenCount = file.commits.length - MAX_TOOLTIP_COMMITS
  return ['**Commits**', ...shown, ...(hiddenCount > 0 ? [`- and ${hiddenCount} more`] : [])]
}

function sessionSection(summary: string | null): string[] {
  if (!summary) return []
  const { heading, bullets } = sessionExcerpt(summary)
  if (!heading && bullets.length === 0) return []
  return [
    '**From the session**',
    ...(heading ? [`*${escapeMarkdown(heading)}*`] : []),
    ...bullets.map((bullet) => `- ${escapeMarkdown(bullet)}`),
  ]
}

/**
 * The tooltip: about the file first (CLI 2.1+), then the session it was last worked in, then a link to open it in
 * the Workscribe tab. An older CLI sends no file details, so the tooltip is the session part alone.
 */
export function tooltipMarkdown(session: SessionContext, filePath: string): string {
  const sections = [
    [`**Workscribe** · you last worked on this file ${escapeMarkdown(session.timeAgo)}`],
    ...(session.file ? [fileSection(session.file), commitsSection(session.file)] : []),
    sessionSection(session.summary),
    [`[Open session in Workscribe](${showSessionLink(filePath)})`],
  ].filter((section) => section.length > 0)
  return sections.map((section) => section.join('\n')).join('\n\n')
}
