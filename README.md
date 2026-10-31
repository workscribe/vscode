# Workscribe for VS Code

<!-- TODO: screenshot or short GIF of the "last worked on" status bar item here -->

[Workscribe](https://workscribe.co) turns your terminal and editor activity into a daily work summary, written automatically — no manual logging, no end-of-day scramble to remember what you did.

This extension captures what happens *in the editor* — file saves, debug sessions, build and test tasks — the activity pure terminal capture misses entirely.

## What it captures

- **File saves** — every save of an on-disk file
- **Debug sessions** — start and end of each debug session
- **Tasks** — build, test and watch tasks run through VS Code's task runner, captured when a task ends

None of this is sent anywhere by this extension. Every event is handed to the `workscribe` CLI via `workscribe _capture`, the same local-first pipeline the shell hook uses, so your data stays on your machine.

## Last worked on

When you open a file you last worked on more than a day ago, the status bar shows **WS · 25 days ago**. Point-of-need recall for "what was I doing here", without digging through git log. Files you worked on today show nothing: the point is surfacing context you've lost, not restating what you just did.

- **Hover it** for what Workscribe knows about the file: when it last changed, how many changes were recorded (one per file per 30 seconds), its branch, the commits that touched it, and the start of that session's summary. You can move into the tooltip without it closing.
- **Worked alongside:** with a Workscribe CLI that works in threads (2.2 and later, once its data is upgraded), the tooltip is about the file's own project. If you were working in other repos in the same stretch, it names them: **Worked alongside** workscribe/cli, workscribe/vscode.
- **Click it**, or **Open session in Workscribe** in the tooltip, to open that session in the Workscribe tab.
- The first time it appears, a one-time hint explains it.

It asks the CLI again whenever you switch to a file or save it, so it never shows a stale answer.

## Workscribe tab

The **Workscribe** panel, next to Problems, Output and Terminal, shows the whole session the active file was last worked in: the repo, when it ran, its branch, how many events it had, and its full summary. With a CLI that works in threads (2.2 and later), it also shows how long the file's project was active, and lists every project worked alongside it, with when and for how long. Unlike the status bar item, it shows the latest session even if it was today. When there's nothing to show, it says why: Restricted Mode, the CLI not found, or no activity recorded for the file yet.

## Output channel

**Output → Workscribe** lists each event the extension sends to the CLI, one line each: when, what, and the file or folder. It reads "sent", because the CLI can still drop an event (a repeated save, or while capture is paused).

## Requirements

- The [`workscribe` CLI](https://www.npmjs.com/package/@workscribe/cli) installed and on your `PATH` (`npm install -g @workscribe/cli`)
- No `workscribe init` required — the extension activates and starts capturing on its own

If the CLI can't be found, a `$(warning) Workscribe` status bar item appears — click it to configure `workscribe.binaryPath`. It stays visible for the session; no repeated pop-ups.

## Workspace Trust

Capture is disabled in untrusted (Restricted Mode) workspaces, since it spawns subprocesses derived from files in the workspace. It starts automatically once you grant trust.

## Configuration

| Setting | Description |
|---|---|
| `workscribe.binaryPath` | Explicit path to the `workscribe` binary, if it isn't discoverable on `PATH` |

## Contributing

See [CONTRIBUTING.md](https://github.com/workscribe/vscode/blob/main/CONTRIBUTING.md) for local development setup, testing, and packaging. (Not bundled in the published extension — `vsce` only ships README, LICENSE, and CHANGELOG by default.)

## License

MIT
