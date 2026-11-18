# Arena offers, pre-flight and decision follow-up

The arena skill (installed only from `registry.json`, pinned and hash-checked) runs N sub-agents on one task with
different strategy cards, then a single-elimination bracket judged on a written rubric. It is best-of-N with a
verifier, not a debate between different models, so use it rarely and small. master-brain **offers** it; it never
starts it without the owner's yes (`core/SAFETY.md` 12). The `decide` module is optional; these rules hold without it.

## When master-brain offers arena (only then)
- **Rejected twice:** the `STATE.md` Handover line `rejections: <task-id> <n>` reaches 2 for the same task id. A user
  correction or a RESULT the Master sent back each add 1. The third plain retry is replaced by the offer; the last
  rejected answer is the baseline. Route-log `--correction yes` lines are still written but not counted here.
- **Close decision:** two options whose weighted criteria are within 10%, or a `decide` confidence of 60 or less. No baseline.
- **High-risk:** risk tier High in `core/TOKENS.md` section 2. No baseline. Never for routine work, lookups or formatting.
- When the arena skill triggers by itself in a master-brain project ("try again", "bad answer"), the Master still
  follows this file: size 8 by default, the pre-flight below, the owner's yes.

## Size and cost (`bracket.py plan` totals; +1 final check only with a rejected answer; 55-160k tokens per call)
| Agents | Calls (no baseline / baseline) | Tokens |
|---|---|---|
| 4 | 19 / 20 | about 1.0-3.2M |
| **8 (default)** | **43 / 44** | **about 2.4-6.9M / 2.4-7.0M** |
| 16 (needs its own yes) | 91 / 92 | about 5.0-14.7M |
| 100 (only when the owner types it) | 595 / 596 | about 33-95M |

Offer line at size 8: with a rejected answer "44 sub-agent calls, about 2.4-7.0M tokens"; without one "43 sub-agent
calls, about 2.4-6.9M tokens".

## Pre-flight (any failed item = no arena; the script names it)
1. **Before the offer:** `get_usage`, then `node <skill_dir>/scripts/decisions.cjs preflight <master_dir> --five <pct>
   --week <pct>` exits 0 (the arena skill matches its pin; the usage table allows an arena). Then the offer line.
2. **After the owner's yes:** write the task to `<master_dir>/arena/.arena/task.md` (and `baseline.md`), then the same
   command with `--yes`: Python 3.8+, a private arena folder, `.arena/` ignored by git (a plain folder skips this),
   the before snapshot (`arena/before.txt`), and no secrets or denied words (`MB_DENY`) in task and baseline.
3. Show the `bracket.py plan --agents 8` output and the token range; the owner says yes again. 16 needs its own yes;
   100 only when typed.

## The run
- Every arena command is one shell call: `cd "<master_dir>/arena" && python3 <arena>/bracket.py ...`. Never rely on
  a persisted working folder.
- Between waves: `get_usage`, then `decisions.cjs usage-gate --five <pct> --week <pct> --wave`; exit 1 (the 90%
  column) = stop; `ARENA next` resumes later. Accept-edits mode may be suggested for the run only, with a reminder to
  switch back; the Master never changes settings.
- After the run: in a repo, compare `git status --porcelain` with `before.txt`; in a plain folder,
  `decisions.cjs tree-hash <project> --skip <master_dir>/arena`. Report any difference, and any `<project>/.arena`, to
  the human. Results are applied only after the owner's yes.
- Log one line:
  `node <skill_dir>/scripts/route-log.cjs append --log <master_dir>/routing-log.jsonl --task arena --start T1 --result pass|fail --tokens <integer> --rework no --correction no --note "<card>, attacks survived, final-check score or none"`

## Decision follow-up (in ACTION_LOG)
A decision is a DL entry (`templates/ACTION_LOG.md`) with the optional fields Confidence, Review-by and
Failure-signal, and `Arena: <run folder>` when one ran. `decisions.cjs lint` checks them; `decisions.cjs due` lists
entries past Review-by or with `failure-signal seen` in an Outcome line; `/master-brain improve` shows them and the
owner keeps, updates (an Outcome line) or supersedes each (a new entry with `Supersedes: DL-x`). Arena state and the
log stay in the project's private `master-brain/`, never in the skill, an overlay export or a push.
