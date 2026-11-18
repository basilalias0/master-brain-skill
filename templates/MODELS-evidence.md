# MODELS evidence (lazy: read only when re-checking a default in `MODELS.md`)

## Escalation
A failed cheap run cost over 4x a good one (Anthropic's Model Routing Playbook). Here a failed T0 test-writing run cost
126k tokens against 55k for T1 directly, so T0 starts only where tests catch its mistakes.

## Cache note
The older T0 model did not cache prompts under 4,096 tokens; re-check this for the current T0 before relying on cache
for small jobs. Prefer a script for mechanical lookups; use T0 for judgment-light reading.

## A/B ladder (2026-10-05, small synthetic tasks, 1-2 runs each; the older T0)
The T0 model changed on 2026-10-19, so the T0 numbers below must be re-run before they are trusted (method:
`core/IMPROVE.md` §5, at least 3 runs per cell). Not re-run yet.
- The cheapest tier passed 6 of 7 tasks; it failed only test writing (caught 2 of 3 broken versions).
- On multi-step work it used 2-4 times the turns of the standard tier (34 against 9 on a 3-caller bug fix), so it saves
  only if its price per token is lower by more than that.
- A single-file fix cost about a third of the standard tier's tokens on the cheapest tier.
- The deep tier passed everything it was given, but the standard tier already did: no quality gain on these tasks, so
  the build default stays until a larger run says otherwise.
