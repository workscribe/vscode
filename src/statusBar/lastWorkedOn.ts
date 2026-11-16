// What the "last worked on" status bar item says: its text, its spoken label and its tooltip. Pure — no `vscode` —
// so it's tested directly; statusBar.ts turns the markdown into a MarkdownString.

import {
  type FileChangedBy,
  type FileChanges,
  type FileDetails,
  fileChangesOf,
  type SessionContext,
  threadOf,
} from '../cli/context'
import { RECAP_TOOLTIP_MAX_CHARS, SHOW_SESSION_COMMAND } from '../constants'
import { formatDayAndTime } from '../shared/sessionTime'

const MAX_TOOLTIP_COMMITS = 3
const MAX_EXCERPT_BULLETS = 3
const MAX_TOOLTIP_ALONGSIDE = 3
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

/** " (+87 −12)", or nothing when the counts aren't known. */
function linesSuffix({ linesAdded, linesRemoved }: Pick<FileChangedBy, 'linesAdded' | 'linesRemoved'>): string {
  return linesAdded === null || linesRemoved === null ? '' : ` (+${linesAdded} \u2212${linesRemoved})`
}

function countOf(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** "4 saves in your editor (+10 −2)" or "2 edits by Claude Code (+87 −12)". */
function changedByPhrase(who: FileChangedBy): string {
  if (who.agent === null) return `${countOf(who.count, 'save')} in your editor${linesSuffix(who)}`
  return `${countOf(who.count, 'edit')} by ${escapeMarkdown(who.agent)}${linesSuffix(who)}`
}

/** The counts alone, for an answer whose `changedBy` had nothing usable: "4 saves in your editor, 2 edits by an agent". */
function changesFromCounts({ editorSaves, agentEdits }: FileChanges): string[] {
  return [
    ...(editorSaves > 0 ? [`${countOf(editorSaves, 'save')} in your editor`] : []),
    ...(agentEdits > 0 ? [`${countOf(agentEdits, 'edit')} by a coding agent`] : []),
  ]
}

/** What changed the file, in phrases: who and how much with a CLI that says (3.3+), else only the counts. */
function changePhrases(changes: FileChanges | null): string[] {
  if (!changes) return []
  if (changes.changedBy.length === 0) return changesFromCounts(changes)
  return changes.changedBy.map(changedByPhrase)
}

function changesFact(file: FileDetails, changes: FileChanges | null): string {
  const phrases = changePhrases(changes)
  if (phrases.length > 0) return `- Changes: ${phrases.join(', ')}`
  // Capture keeps one change per file per 30 s, so this isn't every keystroke save
  return `- Changes recorded: ${file.saveCount} (one per file per 30 s)`
}

function fileSection(file: FileDetails, changes: FileChanges | null): string[] {
  const facts = [
    `- Last changed: ${escapeMarkdown(formatDayAndTime(file.lastSavedAt))}`,
    changesFact(file, changes),
    ...(file.branch ? [`- Branch: ${escapeMarkdown(file.branch)}`] : []),
  ]
  return ['**About this file**', ...facts]
}

/** A recap as one short line: its whitespace collapsed, and cut with an ellipsis when it is longer than the limit. */
function recapLine(recap: string): string {
  const oneLine = recap.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= RECAP_TOOLTIP_MAX_CHARS) return oneLine
  return `${oneLine.slice(0, RECAP_TOOLTIP_MAX_CHARS - 1).trimEnd()}\u2026`
}

/** What each agent session that edited the file said it did; nothing when none kept a recap. */
function agentSaidSection(changes: FileChanges | null): string[] {
  const recaps = (changes?.agentSessions ?? []).flatMap((agentSession) => {
    const line = agentSession.recap === null ? '' : recapLine(agentSession.recap)
    return line === '' ? [] : [`- ${escapeMarkdown(agentSession.agent ?? 'An agent')}: ${escapeMarkdown(line)}`]
  })
  return recaps.length === 0 ? [] : ['**What the agent said**', ...recaps]
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

/** The projects worked in the same stretch (CLI 3.0+), named in one line. Work outside a repo isn't a project. */
function alongsideSection(session: SessionContext): string[] {
  const names = (threadOf(session)?.alongside ?? []).flatMap((other) => (other.repoName ? [other.repoName] : []))
  if (names.length === 0) return []
  const shown = names.slice(0, MAX_TOOLTIP_ALONGSIDE).map(escapeMarkdown).join(', ')
  const hiddenCount = names.length - MAX_TOOLTIP_ALONGSIDE
  return [`**Worked alongside** ${shown}${hiddenCount > 0 ? ` and ${hiddenCount} more` : ''}`]
}

/**
 * The tooltip: about the file first (CLI 2.1+), then the session it was last worked in, then a link to open it in
 * the Workscribe tab. A CLI on threads (3.0+) adds the projects worked alongside. An older CLI sends no file details,
 * so the tooltip is the session part alone.
 */
export function tooltipMarkdown(session: SessionContext, filePath: string): string {
  const changes = session.file ? fileChangesOf(session.file) : null
  const sections = [
    [`**Workscribe** · you last worked on this file ${escapeMarkdown(session.timeAgo)}`],
    ...(session.file ? [fileSection(session.file, changes), commitsSection(session.file)] : []),
    agentSaidSection(changes),
    sessionSection(session.summary),
    alongsideSection(session),
    [`[Open session in Workscribe](${showSessionLink(filePath)})`],
  ].filter((section) => section.length > 0)
  return sections.map((section) => section.join('\n')).join('\n\n')
}
