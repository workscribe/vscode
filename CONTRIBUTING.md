# Contributing

```bash
npm install
npm run watch   # esbuild in watch mode
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded.

```bash
npm run lint       # Biome
npm run typecheck  # tsc --noEmit
npm test           # @vscode/test-cli, runs inside a real extension host
npm run package    # vsce package — produces a .vsix for sideloading
```
