# help

## index
master-brain: Master/Worker orchestration plus helper modules. `help <name>` for detail.
Boot and state: (none) or resume | status | onboard | models
Learning: improve | update | overlay | contribute
Optional: audit (third-party security-audit)

## status
Prints a snapshot of STATE.md and BOARD.md in 15 lines or fewer, with a nudge when enough tasks are logged to run improve.
Use: `/master-brain status`

## onboard
First run on a project: reads it, drafts the project adapter, seeds LAWS, MODELS, CAPABILITIES and the overlay folder, and confirms each with you.
Use: `/master-brain onboard`

## models
Shows the project's tier table (which model each tier maps to, routing, floors). Changes are proposals you approve.
Use: `/master-brain models`

## improve
Reads the routing log and case cards and proposes routing, rule or general changes with evidence (8 or more samples each). Nothing applies without your yes, one change at a time, then verify and re-check.
Use: `/master-brain improve`

## update
Checks the installed skill has no local edits, asks, runs `git pull --ff-only`, then compares your overlay and MODELS.md with the new version and recommends keep or adopt per overlap. It never pushes.
Use: `/master-brain update`

## overlay
Project-only rules, saved in `<project>/master-brain/overlay/` (one file per module), each with an id and its evidence. Added only from an approved proposal; capped in size.
Use: `/master-brain overlay [list|add|retire|check]`

## contribute
Writes a sanitized export (rule text and aggregate stats, no raw logs or paths) of rules you approved as general. You review it and send it yourself, for example as a pull request. Nothing is sent automatically.
Use: `/master-brain contribute`

## audit
Optional third-party security audit skill. Master-run only, never installed automatically. See its own help once installed.
Use: `/master-brain audit [quick|standard|deep] [scope]`
