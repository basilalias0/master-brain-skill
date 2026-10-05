# Onboarding — bootstrapping master-brain onto a project for the first time

Triggered by `SKILL.md` §1 when no project resolves for the current invocation (its
upward-walk and downward-scan both come up empty). Like `PROCEDURE.md`, this file is
deliberately generic — no project-specific paths or names anywhere in it. Its whole job is
to figure those out, live, for whichever project this session turns out to be about, then
draft that project's own `PROJECT_ADAPTER.md`.

**Calibration, same as `PROCEDURE.md`:** a freshly-drafted adapter is a first pass, not a
verified fact sheet. Treat it with the same "confirmed by reading the file" vs. "inferred by
convention" discipline this whole system uses everywhere else — never present a guess as
settled.

---

## Step 0 — resolve the project root

Not always a one-line answer — a workspace can be a single project, a project nested under
an unrelated container folder, or a container holding several independent projects at once.

1. **Walk upward from cwd** (bounded — stop at a drive root or after a handful of levels).
   At each level, check for signs of a single project's own identity: a `.git` folder, a
   package/dependency manifest, an existing master-instructions doc (`CLAUDE.md` or
   equivalent). The *outermost* level that still looks like one project (not a container of
   several) is the root — weigh "where does this project's own master-doc live" alongside
   "where's the `.git`," since these don't always coincide (a project's own root can sit one
   level above its actual git repo, if the repo is nested inside a docs/config wrapper
   folder).
2. **If cwd itself is a container holding several independent projects** (multiple
   subfolders each with their own separate `.git`, unrelated tech stacks or purposes) —
   there is no single right answer. Ask which one this invocation is actually about. Don't
   guess based on which one looks biggest or most recently modified.
3. **No persisted "this cwd means that project" cache gets written.** Root-resolution runs
   live, the same way, every time (see `SKILL.md` §1) — a cached single answer would
   silently mis-route the next request if a workspace ever gains a second onboarded
   project later, which is exactly the scenario this whole system needs to keep working for.

## Step 1 — detect new vs. existing

Does the resolved root have a real, non-trivial codebase already — commits beyond an
initial one, real dependencies, actual source files — or is it freshly planned, empty, or
just scaffolding? This determines which path below to take. If genuinely unclear, ask
rather than guess; the two paths produce very differently-shaped drafts.

## Step 2A — new project, planned but not yet built

1. Find the plan or spec. Don't assume it lives in any one specific place or format — it
   could be a design doc, a written spec, a pasted requirements list, or nothing formal
   handed over yet. Ask where it is if it isn't obvious from what's already in the root.
2. Read it. Extract what the generic cycle (`PROCEDURE.md`) needs bound: the tech stack,
   any stated conventions for structure/testing/validation, anything named about how the
   project will be built or verified.
3. **Anything the plan doesn't decide yet gets marked `TBD — set during the first real
   build`, never guessed.** A project with no code yet often genuinely has no answer for
   "where will credentials live" or "what's the module-collision list" — inventing one
   would be worse than leaving it open, since a wrong guess looks authoritative and a
   `TBD` doesn't.
4. Draft `PROJECT_ADAPTER.md` from what was actually found, in the same generic-role-to-
   binding table shape used everywhere this system is already deployed.

## Step 2B — existing project, not yet using master-brain

A discovery pass over what's actually there — the same kind of pass a human would do
reading into an unfamiliar codebase, generalized into a repeatable checklist. For each item,
tag the finding's confidence: **confirmed** (read the actual file/config that proves it) or
**inferred** (a reasonable guess from convention, not directly verified).

Look for, in roughly this order:
1. **That project's own master-instructions doc(s)**, if any exist (a `CLAUDE.md`,
   `AGENTS.md`, `README.md`, or workspace-specific equivalent) — read them first; they
   often already answer several of the items below directly.
2. **Tech stack** — package/dependency manifest, language, framework.
3. **The type/build gate** — whatever command proves the code compiles/type-checks cleanly,
   if the stack has one.
4. **Existing test setup** — test framework(s) in use, where test files live, how to run
   them, and what (if anything) is already known to be red/broken (don't assume a clean
   baseline without checking).
5. **Validation approach**, if any — a schema library, a manual-checks convention, or
   nothing formal.
6. **Foundational / never-parallelize modules** — auth, the primary data-access layer,
   central registries or config files nearly everything else imports.
7. **Module-collision candidates** — shared files that unrelated features would still both
   need to touch (a central routes file, a shared schema file, a registry pattern) even
   with no logical dependency between those features.
8. **Credential/secrets convention** — where real or test credentials are meant to live
   (env vars, a gitignored file, named constants) — never a literal value, just where the
   convention points.
9. **Git conventions** — default branch, commit message conventions, push policy.
10. **A real status/changelog doc**, if one exists, to bind as the project's status source
    and decision-record target — don't invent a new one if the project already has an
    equivalent.

Draft `PROJECT_ADAPTER.md` from what was found, following the confidence-tagging above.

## Step 3 — verify, then present, then confirm

Not "present the draft and hope it's right." A drafted adapter that's wrong in a way nobody
catches here doesn't fail loudly — it fails later, confusingly, misattributed to "the code
is broken" instead of "the binding is wrong," at a point in the cycle (`PROCEDURE.md`'s own
autonomy rule) that won't automatically re-open to question it.

1. **Mechanically verify every file/path claim in the draft actually exists on disk** before
   showing it to anyone. Mark each row verified or flagged — never present an
   undifferentiated wall of claims where a wrong one looks exactly as confident as a right
   one.
2. **Present the draft using this project's own plan-first convention** if it has one (many
   master-instructions docs state one explicitly), or this system's own established
   pattern otherwise: present once, get one approval covering the whole thing, per
   `PROCEDURE.md` step 1's model — not a separate, invented confirmation ritual.
3. **For every row tagged low-confidence in Step 2B: require the human to react to that
   specific row**, not just bless the document as a whole. A confidence tag nobody has to
   look at isn't a real gate — it's decoration.
4. **On confirmation**, write `PROJECT_ADAPTER.md` into that project's own `master-brain/`
   folder (alongside, not inside, the shared skill files — it's per-project data). First
   check that `master-brain/` is outside the project's git repo or gitignored; if it is
   tracked, say so and fix it before going on. Seed `STATE.md`, `ACTION_LOG.md`,
   `FEATURE_INDEX.md`, `BOARD.md` (with a **Masters** table); create `inbox/`, `archive/`,
   `masters/`, `handoffs/` (+ `archive/`, `pairs/`, a `README.md`) and `locks/`.
   Ask whether the human wants a `LAWS.md` (Master/Worker rules); if yes, copy this skill's
   `templates/LAWS.md`, fill every `{{slot}}` from what Step 2 found, and confirm each law
   with them — never assume their rules. Then run `node scripts/law-lint.cjs stamp` to write
   `LAWS_DIGEST.md` (30 lines or fewer, with its `source_hash`). Seed `MODELS.md` from
   `templates/MODELS.md` and `CAPABILITIES.md` from `templates/CAPABILITIES.md`, running the
   capability probe (load tool schemas through ToolSearch, read-only, no calls) and writing
   UNKNOWN for anything not confirmed. Templates hold no absolute paths; fill them in the
   project's copy only.
5. For an existing project (2B): offer a full first-pass `FEATURE_INDEX.md` population —
   ask whether to do it now or incrementally as features come up; it scales with project
   size and shouldn't be assumed free.
6. Create `overlay/` and run `node scripts/overlay.cjs rebase --dir <master_dir>` (writes `overlay/base.json` with the installed skill version). Also seed `routing-log.jsonl` (empty) and `improve/`. These are local to the project and stay out of git.
7. Write one `DL-001` entry in the new `ACTION_LOG.md` recording the onboarding itself —
   what was found, what was confirmed vs. flagged, what's still `TBD`.
8. `STATE.md` starts by reflecting reality: for a new project (2A), "not yet built — the
   first feature is the initial build itself"; for an existing one (2B), "connected — first
   feature starts the normal cycle."

From here, everything runs through `PROCEDURE.md` exactly as it would for any other project
— onboarding's only job was getting a real `PROJECT_ADAPTER.md` in place so that cycle has
something accurate to bind against.
