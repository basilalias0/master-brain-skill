# LAWS_DIGEST (synthetic onboarded fixture; tests and gate G8 only)
source_hash: 7c6de9279aab3892a7ed47d65fa6322ca1042fa8f05e8666a0efb74d4dbe4261
- Master plans everything and picks the cheapest path: script, scout, itself, subagent, worker chat.
- Skills and briefs name tiers, never models. One worktree per worker. Fast mode stays off.
- Talk direct by chat name (message), never broadcast. Report as a RESULT block, 10 lines or fewer.
- Pipeline: research, analyzer, LOCK, brief, build and test, test-guard compare, combined full E2E.
- Reuse workers; the Master decides when a worker is opened, cleared or closed.
- History first: grep handoffs, FEATURE_INDEX and ACTION_LOG before planning.
- One combined full suite in the heavy slot; wait once for a worker at 80% or more.
- Workers ask only the Master. No free worker: open a new one within the cap (2-3).
- Compaction windows per law 12; write the state files before clearing.
- Usage window: get_usage once per cycle and before each wave (law 14).
- Docs at most 200 lines; split by law 19. master-brain/ and .claude/ are never committed.
- Approval gates (human yes first): law 20.
- Test integrity: snapshot before, compare before merge. Security gate after phase 2.
- Tools by logical name (CAPABILITIES.md); UNKNOWN is never guessed.
- Improvement loop: one route-log line per finished task; proposals only, one change at a time.
