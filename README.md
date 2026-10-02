# Workscribe for VS Code

<!-- TODO: screenshot or short GIF of the "last worked on" status bar item here -->

[Workscribe](https://workscribe.co) turns your terminal and editor activity into a daily work summary, written automatically — no manual logging, no end-of-day scramble to remember what you did.

This extension captures what happens *in the editor* — file saves, debug sessions, build and test tasks — the activity pure terminal capture misses entirely.

## What it captures

- **File saves** — every save of an on-disk file
- **Debug sessions** — start and end of each debug session
- **Tasks** — start and end of build/test/watch tasks run through VS Code's task runner

None of this is sent anywhere by this extension. Every event is handed to the `workscribe` CLI via `workscribe _capture`, the same local-first pipeline the shell hook uses — data stays on your machine, subject to whatever AI provider you've configured for `workscribe summary`.

## Last worked on

When you switch to a file you last touched more than 24 hours ago, a `$(history)` status bar item shows how long it's been and, if one exists, the summary from that session — point-of-need recall for "what was I doing here" without digging through git log.

Files you've touched more recently show nothing — the point is surfacing genuinely stale context, not restating something you already know from having just edited the file.

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
