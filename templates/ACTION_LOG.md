# ACTION_LOG: decisions and mistakes (grep-only, never read whole)

Seeded by `scripts/init.cjs`. Grep by keyword or reuse signature and read only the matching entry. Workers write DL
candidates in their handoff; the Master folds them in here, then runs `decisions.cjs archive <this file> --write`: past
200 lines it moves the oldest entries not under review to `ACTION_LOG-YYYY-MM.md` next to this file, where law 6's
`ACTION_LOG*` grep finds it (law 19). Grep the archive only when asked about older history. New entry ids come from
`decisions.cjs next-id <this file>`, which counts the archives too, so no id is used twice.

**Log** a failure that needed a real fix, a choice between viable options no rule already forced, an undocumented
contract mismatch, a new sweep failure, a known-red test turning green (also close its ledger row: an unexplained flip can hide another regression), a costly diagnosis (the ruled-out lead is the
value). **Do not log** routine pattern-following or a restated rule. A repeat of an existing signature with the same fix
is one appended line under that entry: `Recurred: YYYY-MM-DD (<task>)`.

Never delete or rewrite an entry. Add dated lines under it: `Correction YYYY-MM-DD: ...`, `Outcome YYYY-MM-DD: ...`
(write `failure-signal seen` when it is). A reversed decision gets a new entry that says `Supersedes: DL-x`.
`decisions.cjs due` lists entries past Review-by or with the failure signal seen; `decisions.cjs find` gives the top 3.

```
## DL-NNN — <short, greppable signature>
Keywords: <2-6 terms, reused from the project's own docs>
Type: Blocker | Validation-Gap | Requirement-Mismatch | Architecture-Decision | Mistake
First seen: <task or flow>, YYYY-MM-DD
Trigger: <the concrete symptom: error text, failing test, or the decision prompt>
Why it happened: <root cause, or "unknown">
Decision/Fix: <what was done, and why over the alternatives>
Dependencies: <versions, env vars, other DL-#>
Result: <the outcome once applied>
Reuse signature: <the exact pattern to grep for next time>
Confidence: <0-100>            (optional, for decisions)
Review-by: <YYYY-MM-DD>        (optional)
Failure-signal: <what would prove it wrong>   (optional)
```

## Entries
