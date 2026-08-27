import { defineConfig } from '@vscode/test-cli'

// A dedicated fixture folder keeps the trusted test run's workspace state
// isolated from a developer's real VS Code trust database.
export default defineConfig([
  {
    label: 'trustedWorkspaceTests',
    files: 'out/test/**/*.test.js',
    workspaceFolder: './test/fixtures/workspace',
    launchArgs: ['--disable-workspace-trust'],
  },
  // Full Restricted Mode coverage needs a fixture folder pre-seeded as
  // untrusted in the test profile's trust database, which isn't set up yet —
  // see test/suite/extension.test.ts for what's covered today vs. left open.
])
