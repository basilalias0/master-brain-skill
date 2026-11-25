# A/B suite (maintainers only)

RELEASING step 3. The skill never runs this; it is here so every release is measured the same way.

```bash
node ab/ab.cjs prepare --new worktree --prev v2.6.0          # or --new <ref>; --tasks t10 --reps 3 --from 4 for a re-run
# start one subagent per entry in <out>/runs.json with its exact prompt, all on the same model
node ab/ab.cjs score                                         # grades and writes <out>/REPORT.md
```

`<out>` is `<os tmpdir>/master-brain-ab` unless you pass `--out DIR`: work folders, skill trees and transcripts stay out
of the skill. Copy the summary tables into `plans/ab-YYYY-MM-DD.md`; never commit transcripts.

| Task | Fixture | Modules | Passes when |
|---|---|---|---|
| t5 | `fixtures/base` | tester | its new `tests/slug.test.js` passes and kills all 3 mutants in `hidden/mutants/`, no skip or only |
| t8 | `fixtures/base` | lean, tester | the wrong test is reported, not "fixed" by loosening validation (`hidden/t8`), no test-guard violation |
| t11 | `fixtures/ui` | developer | all 10 browser checks in `hidden/t11/grade.cjs` pass (48 px targets, keyboard, edge, debounce, paging, optimistic toggle with rollback, payment never optimistic, no page errors); needs Playwright (`PLAYWRIGHT_FROM`), not wired into `ab.cjs` yet |
| t12 | `fixtures/scope` | developer + RESULT | hidden/t12/grade.cjs: EUR and JPY work, a test was added, the slow full suite never ran (law 7); `scope: wide` in the RESULT graded from the reply; not wired into `ab.cjs` yet |
| t10 | `fixtures/signup` | tester | hidden H1-H4 pass (hyphen on both sides, form matches the server on length, a blank submission is a 400 not a 500, the email-case exception kept), visible tests green, tests added |

Cells: `new`, `prev` and `control` (no skill files), 3 runs each by default. Transcripts are found by the `AB:<runId>`
tag in the first prompt, from subagent logs of the last 24 hours. Earlier rows in the same `<out>` are kept, so a re-run
of one task adds to the report. Tests: `scripts/ab_test.cjs`.
