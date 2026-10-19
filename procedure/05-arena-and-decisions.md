<!-- Part 5 of [PROCEDURE.md](../PROCEDURE.md) — added in 2.4.0. Loaded on demand: arena or decision bank. -->
## Arena and the private decision bank

The arena skill (installed only from `registry.json`, pinned and hash-checked) runs N sub-agents on one task with
different strategy cards, then a single-elimination bracket judged on a written rubric. It is best-of-N with a
verifier, not a debate between different models, so use it rarely and small. master-brain **offers** it; it never
starts it without the owner's yes (law 20). The `decide` module is optional; these rules hold without it.

### When master-brain offers arena (only then)
- **Rejected twice:** the `STATE.md` Handover line `rejections: <task-id> <n>` reaches 2 for the same task id. A user
  correction or a RESULT the Master sent back each add 1. The third plain retry is replaced by the offer; the last
  rejected answer is the baseline. Route-log `--correction yes` lines are still written but not counted here.
- **Close decision:** a decision with two options whose weighted criteria are within 10%, or a `decide` confidence of
  60 or less. No baseline.
- **High-risk:** risk tier High in `core/TOKENS.md` section 2. No baseline. Never for routine work, lookups or formatting.
- When the arena skill triggers by itself in a master-brain project ("try again", "bad answer"), the Master still
  follows this file: size 8 by default, the pre-flight below, the owner's yes.

### Size and cost (`bracket.py plan` totals; +1 final check only with a rejected answer; 55-160k tokens per call)
| Agents | Calls (no baseline / baseline) | Tokens |
|---|---|---|
| 4 | 19 / 20 | about 1.0-3.2M |
| **8 (default)** | **43 / 44** | **about 2.4-6.9M / 2.4-7.0M** |
| 16 (needs its own yes) | 91 / 92 | about 5.0-14.7M |
| 100 (only when the owner types it) | 595 / 596 | about 33-95M |

Offer line at size 8: with a rejected answer "44 sub-agent calls, about 2.4-7.0M tokens"; without one "43 sub-agent
calls, about 2.4-6.9M tokens".

### Pre-flight (any failed item = no arena; name the item)
*Phase A, before the offer (no model tokens):*
1. `node scripts/install-skill.cjs --check arena` exits 0.
2. `get_usage`, then `node scripts/decisions.cjs usage-gate --five <pct> --week <pct>` exits 0 (the "no arena" column
   of the `core/TOKENS.md` section 6 table; a missing, failed or non-numeric value counts as 90). Then the offer line.

*Phase B, after the owner's yes:*
3. `python3 --version` (or `python --version`) is 3.8 or newer.
4. `<master_dir>/arena/` exists (create it); `node scripts/decisions.cjs check-private <master_dir>/arena --skill <skill root>`
   exits 0.
5. In a git repo (`git rev-parse --is-inside-work-tree` exits 0): the project `.gitignore` has `.arena/` (added once,
   with the owner's yes) and `git check-ignore -q .arena` exits 0. In a plain folder: skip this item and say so.
6. Before snapshot: in a repo, `git status --porcelain > <master_dir>/arena/before.txt`; in a plain folder,
   `node scripts/decisions.cjs tree-hash <project> --skip <master_dir>/arena > <master_dir>/arena/before.txt`.
7. `node scripts/decisions.cjs scan-task <master_dir>/arena/.arena` exits 0. It scans `task.md` and, when present,
   `baseline.md` (every sub-agent sees it) for secrets and denied words (`MB_DENY`), and accepts only this project's
   cards or `owner-wide` cards. It exits 2 when `task.md` is missing.

*Phase C, the run:*
8. Show the `bracket.py plan --agents 8` output and the token range; the owner says yes again. 16 needs its own yes;
   100 only when typed.
9. Every arena command is one shell call: `cd "<master_dir>/arena" && python3 <arena>/bracket.py ...`. Never rely on
   a persisted working folder.
10. Between waves: `get_usage`, then `usage-gate ... --wave`; exit 1 (the 90% column) = stop; `ARENA next` resumes
    later. Accept-edits mode may be suggested for the run only, with a reminder to switch back; the Master never
    changes settings (`core/SAFETY.md`).
11. After the run: the same snapshot command again, compared with `before.txt`. Any difference, and any
    `<project>/.arena`, is reported to the human. Results are applied only after the owner's yes.
12. Log one line:
    `node scripts/route-log.cjs append --log <master_dir>/routing-log.jsonl --task arena --start T1 --result pass|fail --tokens <integer> --rework no --correction no --note "<card>, attacks survived, final-check score or none"`
    The first real runs record the measured cost; that evidence sets the default size.

### The decision bank (private)
- Where: `<project>/master-brain/decisions/` (outside git or ignored, as onboarding requires) and, optionally, an
  owner-wide bank at `~/.claude/master-brain-private/decisions/`. Never under a `skills` folder, never in the skill,
  `overlay.cjs export`, `contribute` or any push. Check: `decisions.cjs check-private <bank> --skill <skill root>`.
- A card is `DC-NNN.md` and extends the `procedure/02` DL format. Heading `DC-NNN — <signature>` (level 2), then one
  line each: Keywords, Date, Question, Options, Criteria, Evidence, Inspired-by (public sources only), Decision,
  Confidence (0-100), Arena (run folder or none), Review-by (date), Failure-signal, Share (`project` by default, or
  `owner-wide`), Supersedes (a card id or none). A DL entry links to it with `See: DC-NNN`.
- Append-only. The head (everything above the first Status or Outcome line) is hash-recorded in `<bank>/.index.json`
  by `decisions.cjs lint`. Changes are appended: `Status YYYY-MM-DD: active|under-review|superseded-by DC-x|failed — note`
  and `Outcome YYYY-MM-DD: ...` (write `failure-signal seen` when it is). A failed decision gets a new card with
  `Supersedes`.
- Other projects see only `owner-wide` cards (`decisions.cjs find <owner bank> <keywords> --shared`).
- Commands: `lint <bank>` (exit 0 required after every write), `due <bank>`, `find <bank> <keywords>` (top 3, no model
  tokens), `check-private`, `scan-task`, `usage-gate`, `tree-hash`.

### Improve loop
`/master-brain improve` also runs `decisions.cjs due <bank>` and shows the due cards with their evidence. The owner
chooses keep, update (append a Status line) or supersede. The report adds "decisions changed since last run". A lesson
enters the skill only as a mechanism: `overlay.cjs` refuses a general rule that cites a card.
