<!-- Part 3 of [PROCEDURE.md](../PROCEDURE.md) — added 2026-10-06 from the overnight run. -->
## Dependency upgrades, migrations and partial reports

**Dependency upgrade.** Give it its own worktree and branch with its own install. A worktree's `node_modules` can be a junction to main's, so upgrading in place changes the running app. Merge order: finish the other workers, merge the upgrade branch onto the integration branch, resolve conflicts in generated files by taking the upgrade side and regenerating (for Prisma: `db:generate`), then type-check, run unit tests, rebuild and run the full sweep. Before merging, detach the junction (delete the link only, never its target), run the clean install, and confirm main's `node_modules` is unchanged. Major-version bumps with breaking toolchain changes are listed as skipped, not forced.

**Migration handoff.** The agent is blocked from `migrate deploy` against a remote database. The Master reads the SQL (additive only: nullable column, no backfill), checks `migrate status`, then gives the human the exact command for their shell (PowerShell 5.1 has no `&&`: use `Set-Location ...; command`). Continue only after the human confirms. A sweep must not start before it: code that reads a new column fails on the old schema.

**Partial worker report.** If a worker reports fewer items than briefed, record which are done (by commit), then re-dispatch only the missing items with the done commits listed as context. Never redo finished items. A skipped item needs a one-line reason and goes to the human as a decision.
