<!-- Part 2/2 of [PROCEDURE.md](../PROCEDURE.md) — split verbatim 2026-10-01, LAWS law 19. -->
## Decision/mistake log — format

```
## DL-NNN — <short, greppable signature>
Keywords: <2-6 free-text terms, reused verbatim from the project's own docs where possible>
Type: Blocker | Validation-Gap | Requirement-Mismatch | Architecture-Decision | Mistake
First seen: <feature/flow reference>, YYYY-MM-DD
Trigger: <the concrete symptom — error text, failing test name, or the decision prompt>
Why it happened: <root cause if known, else "unknown — see investigation notes below">
Decision/Fix: <what was decided/done, and why this over the alternatives considered>
Dependencies: <what this assumes — a package version, an env var, another DL-#>
Result: <the outcome once applied; if it turned out wrong, what was actually wrong and how
that was caught>
Reuse signature: <the exact pattern step 6 should grep for next time>
```

If an entry's original diagnosis later turns out wrong, **never delete or rewrite it** —
append a dated `Correction:` line underneath, pointing at what actually happened. The wrong
turn is real teaching data, not noise to clean up.

### What's worth logging (the noise judgment call)

**Log an entry when:** a test/walkthrough failed and needed a real fix; a genuine choice was
made between two-plus viable approaches that no existing rule/doc already forced (following
an established pattern for a new-but-similar case is not a decision — deviating from that
pattern, or resolving something no doc covers, is); the schema/contract diff found an
undocumented mismatch; the regression sweep found a new failure; a known-red test
unexpectedly flips green; something cost real back-and-forth to diagnose even if the eventual
fix was trivial — the value is in the false lead that got ruled out along the way, not the
final one-line fix.

**Don't log:** routine pattern-following with no surprises (this is most of building, and
logging all of it drowns the real signal); anything that would just restate an existing
documented rule; a repeat hit of an *existing* signature with the same resolution — that's a
one-line "Recurred" append to the existing entry, not a new one.

---

## Self-study pass (periodic — never per-feature)

Triggered every ~8–10 new decision-log entries since the last pass (tracked via a one-line
footer marker in the log itself), or whenever the human explicitly asks — deliberately never
at per-feature frequency, since unverified self-reflection at high frequency is exactly the
failure mode the calibration note at the top of this file describes.

1. Read only the decision log entries since the last pass's marker — not the codebase, not
   other project docs.
2. Group by reuse signature. Keep only signatures with 2 or more occurrences (an original
   entry plus at least one "Recurred" note). One occurrence is an incident, not a pattern —
   discard it from this pass.
3. For each qualifying signature, draft exactly one proposed rule, fix, or process change.
   State which specific entries it would have prevented and its realistic blast radius.
4. **Present the proposal to the human. Never self-apply.** A rule change alters future
   procedure — that's the same plan-first territory as any other multi-step change, not an
   exemption from it.
5. On approval: apply it, write one decision-log entry (Type: Architecture-Decision) closing
   the loop over the entries it resolves. If it's a rule worth defending long-term, promote
   it into the project's own durable architecture-decision record (if one exists) rather
   than leaving it only in the fast, terse decision log.
6. Move the footer marker forward. **The only claim being tracked**: does this exact
   signature recur a 3rd time after the fix shipped? If yes, the fix didn't work — that's an
   ordinary new log entry, not a crisis, and not evidence the whole approach is broken. If it
   goes quiet, the fix worked. This is the entire, honest, checkable claim this mechanism
   makes — there is no global accuracy score anywhere in this design, because nothing here
   produces one.

---

## Cross-session coordination

No assumption is made that separate sessions can message each other live — this procedure
is written assuming the only reliable cross-session channel is plain files any session can
read/write by an explicit, absolute path, regardless of that session's own working
directory or start time. Coordination is therefore pull-based and eventually consistent, not
live — state that honestly if asked, rather than implying more real-time coordination than
a file can actually provide.

1. Every session working under this procedure — whichever one the human is actively
   driving, or a worker — reads the coordination board in full before claiming anything.
2. Claiming a module sets its status to `claimed`, tagged with a short session identifier
   (date + module name is enough) and its isolation branch/worktree if one was used.
3. Before claiming, re-check the candidate module's touched-file set against every other
   currently `claimed`/`in-progress` row's touched-file set (the same check as step 3a).
   Overlap → don't claim it in parallel; flag it and sequence instead.
4. Status progresses `claimed` → `in-progress` → `blocked` (with a pointer to the relevant
   decision-log entry) → `done`.
5. On `done`, append the outcome plus pointers to any decision-log entries produced, so the
   next session doesn't have to re-open flow records to know what happened.
6. Whichever session is asked "how's everything going" is the reconciliation point: re-read
   the whole board, summarize, proactively flag anything stuck or colliding. That's the
   entire coordination mechanism — not a separate running process, just this file plus
   whoever last read it.

---

## Keeping lookups cheap as the log grows

- The live-state snapshot is a rewritten-in-place pointer, not an append log — it stays
  small regardless of project age because it only ever describes what's in flight *right
  now*, never history.
- Decision-log and action-log entries are deliberately terse and pointer-heavy — they link
  to a project's fuller docs/commit history for the long version rather than re-narrating it.
- Lookups are grep-first, never read-first: search by keyword across the log (and any
  rotated/archived older log files) and only read the matching entries — never load the
  whole log into context to answer one question.
- Old entries rotate out of the live log into a dated archive once the live log passes a
  size threshold; the live-state snapshot never points into the archive — it's an opt-in
  read for explicit "history older than X" requests only, essentially never touched at
  session start.
