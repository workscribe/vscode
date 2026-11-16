# Changelog

## Unreleased

- **Line counts on saves:** with Workscribe CLI 3.3.0 or later, each save also tells the CLI how many lines it
  added and removed, worked out against the last version of the file the extension sent. Files over about 1 MB or
  20,000 lines, and binary files, are sent without counts. A CLI before 3.3.0 is asked first and gets saves exactly
  as before, since it would reject the counts.
- **Who changed the file, and what the agent said:** with CLI 3.3.0 or later, the status bar tooltip says who changed
  the file and by how many lines (you, and each coding agent), and shows what each agent session said it did, when
  you keep recaps with `capture.agentMessages`. The Workscribe tab adds a **Who changed this file** list and each
  recap in full. With an older CLI, both look as they did in 0.3.0.

## 0.3.0

- **The file's own project, and what you worked on alongside it:** with Workscribe CLI 3.0 and later, once its
  data is upgraded, the tooltip and the Workscribe tab describe the file's own project's work, not whichever session
  held its last save. The tooltip names the other projects worked in the same stretch. The tab adds how long the
  project was active, and lists each project alongside it with its time span and active time. With an older CLI,
  both look as they did in 0.2.0.

## 0.2.0

- **Last worked on, clearer:** the status bar item reads **WS · 25 days ago** when you open a file you last worked
  on more than a day ago, and screen readers hear "Workscribe: you last worked on this file 25 days ago". Click it
  to open that session in the Workscribe tab.
- **A tooltip about the file:** when it last changed, how many changes were recorded, its branch, the commits that
  touched it, and the start of the session's summary, with a link to open the session. You can move into it
  without it closing.
- **A one-time hint** the first time the item appears, with **Open session** and **Got it**.
- **Always up to date:** the item asks the `workscribe` CLI again whenever you switch to a file or save it, instead
  of remembering its first answer for the whole window.
- **The Workscribe tab:** a panel next to Problems, Output and Terminal showing the whole session the active file
  was last worked in: repo, time span, branch, events and the full summary. It says why when there's nothing to
  show (Restricted Mode, no CLI, no activity for the file yet).
- **A Workscribe Output channel:** one line for each event the extension sends to the CLI.
- **Capture fix:** a save is recorded against the file's own folder, so files in nested repos land in the right
  project.

## 0.1.1

- The Marketplace listing: a polished README, with the contribution guide moved to `CONTRIBUTING.md`.

## 0.1.0

- First release: captures file saves, debug sessions and tasks into Workscribe, and a status bar item that shows
  when you last worked on a file you haven't touched for a day.
