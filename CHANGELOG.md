# Changelog

## 2.11.0 (2026-11-27, owner request; not A/B tested)
- **Extra skills are offered, not hidden.** The human cannot know they exist.
  - `boot.cjs` now lists every registry skill for the Master and Chief, as installed, not installed or declined.
  - When a task matches one that is not installed (a dashboard or any UI: unslop; a security review: security-audit;
    a close decision: arena), the Master shows `install-skill.cjs --offer <name>` unasked. The offer says the skill is
    not part of master-brain and lists its features, size, author, licence and pinned source. It explains the scan and
    that threats are removed into a local copy that is never uploaded. It ends with "Shall I download it?".
  - **Yes:** `--yes --clean`.
  - **No:** `--decline`, and it is not offered again in that project.
  - `--if-needed` prints the offer and exits 5 when the skill is missing. unslop is no longer auto-installed.
- **security-audit** (cloudflare/security-audit-skill, MIT) is now in the registry, pinned at c1c8a8c with 20 file
  hashes. It scanned with 0 high findings; its only subprocess and delete calls are in its own tests.
  Every entry now has `features`, `when`, `short` and `sizeKB`.
- **Hash check:** a copy with CRLF line endings still matches its pin.
- **Scanner:** a reference file counts as used when any file of the skill names it, linked or not.

## 2.10.0 (2026-11-27, owner request; not A/B tested)
- **unslop runs alongside the UI rules.** `registry.json` lists heydamir/unslop (CC BY 4.0, credited) pinned at
  620163e with all 16 file hashes and `auto: true`. `ui.md` has the developer run `install-skill.cjs unslop --if-needed`
  on any screen people see. It installs once, then reuses the copy. A new screen uses `signs.md` and `tokens.md`
  (about 4k tokens) instead of the full 8k-token SKILL.md. ui.md wins on behaviour and access, unslop on looks.
- **Every third-party skill is scanned** on download, update and local change (`scripts/skill-scan.cjs`).
  - **High findings block the install:** secret reading, a network call next to a secret read, obfuscated code,
    npm lifecycle scripts, hooks, settings or skill edits, start-up persistence, prompt injection, hidden characters,
    executables, and files whose content does not match their extension.
  - **Medium findings are shown:** network calls, subprocesses and deletes.
  - **Optimization notes:** tokens per use, description length, big files and unlinked references.
  - **A threat stops the install** (exit 4) and the human is told. Only with their yes, `--clean` writes a copy
    without the threats to `local/<name>`, which is git-ignored, never pushed, and never touches the upstream repo.
  - `--latest` scans a new upstream commit before the pin moves.
  - The installer now checks every pinned file hash, not only SKILL.md.
- **unslop scan:** 0 high findings. The network calls are in `snapshot.mjs` and fetch only the page the user names.
  `story.mjs` serves files on 127.0.0.1 with a path guard and runs ffmpeg. Arena also rescanned clean.
- RESULT: a worker writes `test-guard: Master's`; only a chat that ran the script reports `ok` (found by A/B t12).

## 2.9.0 (2026-11-24, owner request)
- A/B 2026-11-25, new task t12 (`plans/ab-2026-11-25.md`): worker side only. 3/3 pass in every cell (all runs
  tested only their change and skipped the slow suite); v2.9.0 alone flagged `scope: wide` for the shared file (3/3);
  tokens level with 2.8.0 (68.6k vs 69.1k). Found: 4 of 6 skill runs reported `test-guard: ok` without running it.
- **Each chat tests only its own scope** (law 7, rewritten). A worker or subagent tests only its change (type-check, affected
  tests, own flow), never the full suite. A Master tests its module at merge, once per wave. The Chief, or a single Master
  with no Chief, runs the one full-app E2E after the Masters' merges and always before main is pushed. Shared-file changes
  are `scope: wide` in the RESULT and get tested one level up before that merge. A red full run is split by Master merge
  (bisection) and goes back to its owner. Laws 4 and 13, RESULT, TOKENS, SCALE, CHIEF, tester and developer updated.
- **Every project follows the current laws.** `law-lint.cjs sync <LAWS> [--apply]` and `templates/laws-history.json`
  (every earlier template text, from git): a project law equal to an earlier template text is outdated and is rewritten
  with the project's own placeholder values; one the human edited is reported, never changed; new laws past the last are
  added. `boot.cjs` runs it on every boot (old copy `LAWS.prev.md`, digest regenerated) and says what changed. On a
  real project copy: laws 4, 5, 7, 13 and 21 updated, commands and branch kept, nothing else touched. A file with
  fewer than half the laws recognised is skipped. RELEASING 4 runs `history-add` when the template changes.
- `test-guard.cjs compare --expect-new`: a build or bugfix that adds no test is a violation (law 21). In the 2026-11-23
  A/B none of 9 runs added tests.
- Law 5: a closed worker's merged worktree and branch are removed. SCALE §3: merge in finish order, one branch at a
  time, after comparing the shared contracts the wave touched (conflicting choices that both compile).

## 2.8.0 (2026-11-23, owner request)
- `scripts/worker.cjs choose` (tests): subagent or worker chat per task, by formula. Hard rules first: the human must step in or the work must outlive the Master -> chat; the Master within 20k of its rollover point -> roll over first (a clear or new chat ends running subagents); the subagent cap reached -> chat; XL -> scale mode. Otherwise the cheaper of subagent = boot + work + 0.1 x Master context + 0.1 x report x later Master steps, and chat = boot + work + 0.1 x Master context x 3 wake-ups + 0.1 x reused history x steps. Defaults (boot 40k subagent, 100k chat) are uncalibrated until 3 logged tasks each (`route-log --worker sub|chat --boot N`). SCALE §1 and TOKENS point to it.
- `modules/developer/ui.md`, read only for frontend work (pages, templates, artifacts, components): 17 UX laws
  (Doherty, Hick, Zeigarnik, Postel, Peak-End, Fitts, Jakob and more) as code rules, a baseline every interactive
  component must pass (states, 48 px targets, keyboard, contrast, 150 ms motion), a reference dropdown (edge flip,
  keyboard, search past 10 options, debounce, infinite scroll), rules for about 50 components (grids pin short key columns), and when to use optimistic updates (like, checkbox,
  toggle) and never (payments, orders, irreversible actions). `MODULE.md` points
  to it; router size unchanged. A/B 2026-11-23, new task t11 (`plans/ab-2026-11-23.md`): 3/3 pass against 0/3 for 2.7.1
  and 0/3 with no skill; about 16% more agent tokens (87.2k vs 74.9k), so the token leg of RELEASING 3 is not met.

Older releases: `changelog/2.5-to-2.7.md` (2.5.0 to 2.7.1) and `changelog/2.4-and-earlier.md`.
