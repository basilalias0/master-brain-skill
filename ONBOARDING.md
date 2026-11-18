# Onboarding: first run of master-brain on a project

Runs when boot finds no `master-brain/STATE.md` walking up from the cwd. Generic: it finds the project's paths and
names live, then fills the project-specific section of that project's `LAWS.md`. Every finding is tagged
**confirmed** (read the file that proves it) or **inferred** (by convention); never present a guess as settled.

## Step 0: resolve the project root
1. Walk up from the cwd (a few levels at most) for one project's signs: `.git`, a dependency manifest, a `CLAUDE.md` or
   similar. The outermost level that is still one project is the root (its master doc may sit above a nested repo).
2. A container of several independent projects: ask which one. Never guess by size or recency.
3. Nothing is cached: root resolution runs live every time, so a second onboarded project never mis-routes.

## Step 1: new or existing
A real codebase (commits, dependencies, sources) takes 2B; a plan or scaffold takes 2A. Unclear: ask.

## Step 2A: new project
Find the plan or spec (ask where it is), read it, and take what the LAWS project section needs: stack, conventions for
structure, tests and validation. Anything the plan does not decide is `TBD — set during the first real build`, never
guessed: a wrong guess looks authoritative, a `TBD` does not.

## Step 2B: existing project
Read, in order, and tag each finding: (1) its own instruction docs (`CLAUDE.md`, `AGENTS.md`, `README.md`) first;
(2) stack; (3) the type or build gate; (4) the test setup, how to run it, and what is already red (never assume clean);
(5) validation (a schema library, manual checks or none); (6) foundational modules (auth, data access, central
config); (7) collision files unrelated features both touch (routes file, shared schema, registry); (8) where
credentials are meant to live (never a value); (9) git conventions and push policy; (10) an existing status or
changelog doc to bind, not a new one.

## Step 3: verify, present, confirm
1. Check every path in the draft exists on disk; mark each row verified or flagged.
2. Present it once, in the project's own plan-first convention if it has one; one approval covers the whole draft.
3. Every inferred row needs the human's reaction to that row, not a blessing of the whole.

## Step 4: seed
1. The `master-brain/` folder must be outside the project's git or ignored; if tracked, say so and fix it first.
2. Run `node <skill_dir>/scripts/init.cjs <master_dir>`: it seeds STATE, ACTION_LOG, FEATURE_INDEX, BOARD (with the
   Masters table), the folders, `routing-log.jsonl`, the overlay base, and copies MODELS and CAPABILITIES. It never
   overwrites a file.
3. Ask whether the human wants `LAWS.md`. If yes: copy `templates/LAWS.md`, fill every `{{slot}}` and the
   project-specific table from step 2, confirm each law with them (never assume their rules), ask once about law 25
   (the footer, off unless they say yes), then run
   `node <skill_dir>/scripts/law-lint.cjs digest <master_dir>/LAWS.md <master_dir>/LAWS_DIGEST.md`.
4. Capability probe: load tool schemas through ToolSearch (read-only, no calls), write UNKNOWN for anything not
   confirmed in `CAPABILITIES.md`, then run its probe check (`caps.cjs diff`); re-run it on a new host or app version.
   Templates hold no absolute paths; fill them in the project's copy only.

## Step 5: options (ask once each)
- Existing project: a full first-pass `FEATURE_INDEX.md` now, or as features come up (it scales with size).
- The test gate: a Stop hook (`scripts/stop-gate.cjs`, setup in its header) that keeps a worker from saying "done"
  while the quick check fails. It is a settings edit: add it to `.claude/settings.json` only on their yes.
- If they use the arena skill: add `.arena/` to the project `.gitignore`, with their yes.

## Step 6: close
Write `DL-001` in `ACTION_LOG.md`: what was found, confirmed versus flagged, what is `TBD`. Set `STATE.md`: 2A "not yet
built: the first feature is the initial build"; 2B "connected: the first feature starts the normal pipeline". Then
boot (`scripts/boot.cjs`): it calibrates `CAPACITY.md` for this machine; say the budget in one line.
