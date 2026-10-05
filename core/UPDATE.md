# update, overlay, contribute

The installed skill is read-only. It changes only by `git pull --ff-only`. Your project's own rules live in `<master_dir>/overlay/`.

## update
1. `node scripts/update.cjs --dir <master_dir>` shows the new commits (dry run). Stops if the skill folder has local edits.
2. Tell the user what is new and ask. Only on a yes: `node scripts/update.cjs --dir <master_dir> --yes`.
3. It then prints one line per overlay rule: keep, adopt or both. Show them and let the user decide; retire adopted rules with `overlay.cjs retire <id>`.
4. Fast-forward impossible: nothing changes. Tell the user. Never merge, reset or force.

## overlay
`node scripts/overlay.cjs add <module> --rule "..." --evidence "..." [--scope general] --dir <master_dir>`. Also `list`, `retire <id>`, `check`.
- Add only from an improvement proposal the user approved. One line of rule, one line of evidence (counts, dates, no paths).
- Cap 1500 characters of rules per module. Rules that relax safety, tests, locks, approvals or floors are rejected.
- A module run reads its overlay file after `MODULE.md`. Retire a rule when upstream adopts it or the evidence goes stale.

## contribute
`node scripts/overlay.cjs export --out FILE --dir <master_dir>` writes only `general`-scope rules (rule text, no evidence text, no paths, no logs). Show the user the file. They send it themselves (for example a pull request). Never push, post or upload it.
