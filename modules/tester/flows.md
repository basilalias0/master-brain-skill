# Flow testing (load only for a UI or form flow, or a task that touches a schema pair)

## 1. Before the live run: contract diff
When the task touches a field declared on both ends (the validation schema pair in the LAWS project table, an API
type on client and server, a duplicated enum), diff both sides for that field first, from context already loaded.
- Client looser than server: a real bug. The server rejects what the inline check let through, and the user sees a
  generic failure instead of an inline error. One bug for the shared cause, not one per field. On a field the task
  touches, fix it in this change with a test (tester Integrity rules).
- Server looser than client: dead validation on the loose side. Note it; do not block on it.
- A mismatch the schema's own comment marks as intended is not a finding. Anything else unclear:
  `decisions.cjs find` first, then a scoped question.

## 2. On a blocker
- Reproduce it in the browser before fixing. Never fix from the stack trace alone.
- After the fix, replay the steps this flow already passed, then continue from the next one.
- A failing test, new or old, is an edge case nobody mapped, not a flaky test: reproduce it, fix the code, make the
  spec capture the case, and the sweep runs again (law 7).

## 3. Robustness pass (bounded, after the happy path passes)
- Off-script at a few points: back and forward, another tab, a second click on a submitted control, a modal opened
  and dismissed. Pass: no crash, no console error, no stuck state, no duplicate submission.
- Per form, submit with required fields blank. The client shows an inline message (never a silent failure); the
  server returns a 4xx with a clear message (never a 500, never a partial write). Either side wrong is a bug: fix it in this change with a test.
- A required field that is not part of the real business rule: flag it and ask (DL type Requirement-Mismatch).
- This is not every combination of fields and buttons. This bounded pass is the coverage that matters.
