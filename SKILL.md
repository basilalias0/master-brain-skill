---
name: master-brain
description: Cross-session build/test/decision-log orchestration layer — the FIRST thing any new or resumed session should invoke on a project already using it, and the thing that bootstraps a project onto it on first use. Resolves which project the current session is about, reads a small live-state snapshot for it (never the full history), reports what's in flight and what's next, identifies which candidate features are dependency-independent so they can be built in parallel across separate worker sessions, drafts the copy-pasteable prompt for each worker, and folds worker results back into a running action log (what/how/why/modules/keywords) so a future session can grep it before asking the human or researching from scratch. If no project data resolves yet, runs onboarding instead — drafts that project's bindings from its plan or its existing code, confirms with the human, then bootstraps it. Delegates — never duplicates — actual work: building to a project's own dev-building skill/workflow, blast-radius analysis to a code-analysis skill, external research to a research skill, post-build browser-testing + regression specs to a testing skill. Use for "catch me up", "what's the status", "what should I work on next", "resume", "what can run in parallel", "log this", "master brain", or when starting master-brain on a project for the first time.
---

# master-brain

The entry point for any build+test cycle on whichever project the current session is
about. This file is a small router, loaded every invocation — it stays this short on
purpose. The actual step-by-step cycle lives in `PROCEDURE.md` (generic, identical across
every project) and that project's own `PROJECT_ADAPTER.md` (its specific paths/modules that
plug into `PROCEDURE.md`) — read those only when a build/test cycle is actually starting,
not every time this file loads. First-time setup for a project lives in `ONBOARDING.md`.

This skill is a companion to a thorough, all-docs project-orientation skill if this
workspace has one (e.g. a `know-your-project`-style skill) — that kind of skill = thorough,
all-docs, decision-guarding, every invocation; `master-brain` = fast, recent-activity,
bounded, for "what's happening right now and what's next," not full project context. Run
the fuller one too when you need the bigger picture.

## 0. Master boot — a chat that types `/master-brain` becomes a Master

Resolve the project first (§1, step 1–2 only). If its `master-brain/LAWS.md` exists, it is
binding: read it **first**, in full, and follow it over anything below that disagrees. Then:
1. Read `BOARD.md` (QUEUE + **Masters** table) and every `masters/M*.md` LAST block.
2. Take an id: the one the user named, else the lowest M# with no live chat (`ListAgents`).
   Add/refresh your row in BOARD's Masters table (id, lanes, chat name).
3. If `masters/RESUME.md` exists (law 14 left it), read it, act on it, then delete it.
4. `ListAgents` (workers busy/idle/waiting) + `get_usage` (5-hour window, own context).
5. Report to the user: each worker's state (% + ETA), the queue, what waits on them.
`/master-brain resume` = the same boot, then continue the queue. A **worker** chat never
runs this boot; it reads `LAWS.md` + its `handoffs/W#.md` from its brief instead.
§4–§5 below (inbox folding, paste-prompts) are the pre-LAWS mechanism: with LAWS present,
workers report by `SendMessage` + `handoffs/W#.md`, and `inbox/` is only the fallback.

## 1. Resolve the project, then read its STATE.md

No project name or path is hardcoded here — this file is identical in every project. Work
out which project this invocation is about, live, each time:

1. **Walk upward from the current working directory** (bounded — stop at a drive root or
   after a handful of levels). At each level, check for `<level>/master-brain/STATE.md`.
   First hit → that's the project. Read it, stop searching. This covers both "the cwd IS
   the project root" (zero steps up) and "the cwd is a subfolder of the project root" (e.g.
   sitting inside that project's own git repo, one or more levels below where its own
   `master-brain/` folder actually lives).
2. **Nothing found walking up** → scan the cwd's *immediate children* for existing
   `*/master-brain/` folders (the cwd is a container for one or more projects, not a
   project itself).
   - **Zero found** → nothing is bootstrapped reachable from here yet. Read `ONBOARDING.md`
     and run that instead of the rest of this file.
   - **Exactly one found** → use it — unless something in the current request plainly
     names a different project, in which case treat it as the next case instead of
     silently resolving to the one that happens to exist.
   - **More than one found** (or the one-found case was overridden above) → genuinely
     ambiguous, and there is no cached answer to fall back on (a workspace can gain new
     onboarded projects over time, so a "remembered" answer would eventually mis-route).
     If the request clearly names one candidate, use it and say which one was picked —
     never silently. Otherwise ask which project this is about.
3. Once resolved, `STATE.md` is the only mandatory read. It's a rewritten-in-place snapshot
   (target under ~150 lines) of what's currently in flight for that project, plus pointers
   to its action log and feature index — it never restates their content, so this stays
   cheap regardless of how much history has accumulated.

If that project's `master-brain/inbox/` has any files in it, fold them in now (§4) before
reporting status — a worker session may have finished since `STATE.md` was last refreshed.

## 2. Report — a snapshot, not a dump

Don't paste `STATE.md` back verbatim. Give a short, scannable answer to whatever was
actually asked — what's in flight, what's next, whether anything's blocked, whether
there's a parallelizable batch available right now.

## 3. Routing — delegate, don't duplicate

| The ask is… | Do this |
|---|---|
| "What's the status / catch me up / resume" | §1 + §2. Nothing else unless asked. |
| No project resolves at all for this session (§1 case 2, zero found) | Read `ONBOARDING.md`, run it. |
| "Build/implement `<feature>`" | Open that project's `PROCEDURE.md` + `PROJECT_ADAPTER.md`, start at `PROCEDURE.md` step 1 (Intake). Get the one approval per that step's rule, then run the cycle through to close-out without re-asking except where that step names an explicit re-ask trigger. |
| "What can run in parallel right now" | Check the project's `FEATURE_INDEX.md` + `BOARD.md` for candidates with no logical dependency and no overlap in `PROJECT_ADAPTER.md`'s module-collision list. Propose the split; do not spawn or claim anything until the human approves it. |
| "Log this" / a decision was just made outside the normal flow | Append one entry to that project's `ACTION_LOG.md` (format in `PROCEDURE.md`'s decision-log section) directly — don't route through `inbox/` for same-session work, that's only for genuinely separate worker sessions (§4). |
| Anything needing a full test-strategy report, unrelated to an in-flight feature build | Route to this workspace's own testing skill if one exists — master-brain's own testing step is narrower (post-build verification of one specific feature), not a general test-planning tool. |
| Anything needing external research the log doesn't already answer | Route to this workspace's own research skill if one exists — but check the project's `ACTION_LOG.md` + `archive/` (`Grep` by keyword, not a full read) and `FEATURE_INDEX.md` first. If the answer's already there, use it and say so instead of re-researching. |

## 4. Folding in worker results (`inbox/`)

Worker sessions never edit `STATE.md`, `ACTION_LOG.md`, or `BOARD.md` directly — no file
locking exists across independent Claude Code processes, so two workers finishing at once
would race on the same append. Instead each drops one small file in
`<project>/master-brain/inbox/<timestamp>-<slug>.md`. Whenever this skill runs and finds
files there: read each, fold its content into `ACTION_LOG.md` (prepend — newest-first) and
update `BOARD.md`'s matching row to `done`, refresh `STATE.md`, then delete the inbox file.
This is self-healing — it happens automatically on the next invocation even if nobody
manually closed the loop.

## 5. Dispatching a worker session

Master-brain cannot open another chat window itself. For an approved parallel batch, draft
one copy-pasteable prompt per worker, each starting with:

```
This session is about the same project as before. Resolve it the normal way (walk upward
from cwd for a master-brain/STATE.md, or check cwd's immediate children) and read that
STATE.md first, before anything else.

Then: <the scoped feature/module, exactly as approved>

When done, write ONE new file to that project's master-brain/inbox/ describing what you
did, how, why, what modules you touched, and the keywords for it (see PROCEDURE.md's
decision-log format). Do not edit STATE.md, ACTION_LOG.md, or BOARD.md directly.
```

A worker resolves its own project root the same way §1 does — it is never told a fixed
path, so this template needs no per-project edits either.

Within a single session, prefer the `Agent` tool (subagents) over drafting a worker prompt
for the human to paste elsewhere — it's the more capable native mechanism where it applies,
and it doesn't depend on the human manually running multiple chats. Default to a mid-tier
model for routine build/test subagent work, matching whatever model policy this workspace
documents (its own master-instructions doc, if one exists) — not the top-tier model by
default. Reserve multi-chat worker dispatch for genuinely large batches, or when the human
asks for it by name.
