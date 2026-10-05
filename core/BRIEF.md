# Brief: what a Master sends a worker (40 lines or fewer)

All paths are ABSOLUTE. A worktree does not contain the gitignored `master-brain/` folder. Fill every field; write `none` where empty.

```
task_id:      W#-slug
goal:         one sentence
locks:        [agreed LOCK items]
touches:      [file:line-range or symbol, from the code map or analyzer]
lane:         <BOARD lane>   (edit nothing outside it; list out-of-lane needs)
history:      [handoffs/ files, ACTION_LOG DL-#, FEATURE_INDEX rows]
master_dir:   <absolute path of the project's master-brain folder>
skill_dir:    <absolute path of the skills folder>
base_commit:  <SHA>  (verify with git merge-base --is-ancestor; commits are never pushed)
skills:       [names]  (read <skill_dir>/<name>/SKILL.md; one missing: report, never install)
model_tier:   T0|T1|T2   effort: low|medium|high   (Master applies; you never set them)
budget:       files read N, tool calls N   (at the limit: needs-master + partial progress)
params:       research depth | tester phase | developer mode | ponytail level | audit profile
port / slot:  <dev port>; heavy slot only through scripts/lock.cjs
invocation:   worker (never run the Master boot)
reply:        handoffs/W#.md (LAST block on top), then SendMessage Master the RESULT (core/RESULT.md)
```

The worker reads `LAWS_DIGEST.md` and this brief, then starts. Questions go to the Master only.
