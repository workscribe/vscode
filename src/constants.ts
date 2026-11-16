// Setting and command ids, and timings, used in more than one place.

export const BINARY_PATH_SETTING = 'workscribe.binaryPath'
export const OPEN_SETTINGS_COMMAND = 'workbench.action.openSettings'
export const MANAGE_TRUST_COMMAND = 'workbench.trust.manage'
// Opens the Workscribe tab on a file's session (registered in sessionTab.ts)
export const SHOW_SESSION_COMMAND = 'workscribe.showSession'

// Capture is a detached process: give it time to write a save before asking the CLI about the file again
export const SAVE_REFRESH_DELAY_MS = 2000

// The line diff that counts what a save changed: how long it may take before it settles for an overstated count
export const DIFF_DEADLINE_MS = 20
// A long pass of the diff looks at the clock this often, not only between passes
export const DIFF_CLOCK_CHECK_EVERY = 256

// Which files the extension keeps a copy of (the last version it sent), so a save can be line-diffed
export const MAX_TRACKED_FILES = 100
export const MAX_TRACKED_FILE_CHARS = 1_000_000
export const MAX_TRACKED_LINES = 20_000

// Asking the installed CLI whether `_capture` takes line counts: how long to wait, and when to ask again after a no
export const SUPPORT_PROBE_TIMEOUT_MS = 2000
export const SUPPORT_RETRY_MS = 30_000
