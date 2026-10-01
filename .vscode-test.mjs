import { defineConfig } from '@vscode/test-cli'

// Pinned rather than 'stable' (the default): an unpinned version means every
// new VS Code release invalidates the locally/CI-cached download and forces
// a full re-fetch, and tests silently run against whatever shipped that
// morning instead of a known, reproducible target. Bump deliberately.
const VSCODE_TEST_VERSION = '1.140.0'

// A dedicated fixture folder keeps the trusted test run's workspace state
// isolated from a developer's real VS Code trust database.
export default defineConfig([
  {
    label: 'trustedWorkspaceTests',
    files: 'out/test/**/*.test.js',
    workspaceFolder: './test/fixtures/workspace',
    launchArgs: ['--disable-workspace-trust'],
    version: VSCODE_TEST_VERSION,
  },
  // Full Restricted Mode coverage needs a fixture folder pre-seeded as
  // untrusted in the test profile's trust database, which isn't set up yet —
  // see test/suite/extension.test.ts for what's covered today vs. left open.
])
