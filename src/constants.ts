// Setting and command ids, and timings, used in more than one place.

export const BINARY_PATH_SETTING = 'workscribe.binaryPath'
export const OPEN_SETTINGS_COMMAND = 'workbench.action.openSettings'
export const MANAGE_TRUST_COMMAND = 'workbench.trust.manage'

// Capture is a detached process: give it time to write a save before asking the CLI about the file again
export const SAVE_REFRESH_DELAY_MS = 2000
