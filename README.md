# Workscribe for VS Code

Workscribe passively captures your terminal activity into daily work summaries. This extension closes the gap for everything that happens *outside* the terminal — file saves, debug sessions, and build/test tasks — so a summary built entirely in the editor is still accurate.

## What it captures

- **File saves** — every save of an on-disk file
- **Debug sessions** — start and end of each debug session
- **Tasks** — start and end of build/test/watch tasks run through VS Code's task runner

None of this is sent anywhere by this extension. Every event is handed to the `workscribe` CLI via `workscribe _capture`, the same local-first pipeline the shell hook uses — data stays on your machine, subject to whatever AI provider you've configured for `workscribe summary`.

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

## Development

```bash
npm install
npm run watch   # esbuild in watch mode
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

```bash
npm run lint       # Biome
npm run typecheck  # tsc --noEmit
npm test           # @vscode/test-cli, runs inside a real extension host
```

## License

MIT
