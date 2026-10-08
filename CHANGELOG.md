# Changelog

## 2.1.0 (2026-10-08; the A/B suite was NOT run, released on the owner's say-so)
- Token rules: two budgets (read-only vs fix worker), hard stop at the cap, one subagent per job, cheaper read-only audits, fresh chat per milestone, status as commands.
- Edit-time check after each edit batch; `tools:` brief field (skip browser/connector tools unless needed); examples in the brief; usage thresholds stated once.
- Comment rule (lean, developer): one line, the why only. Evidence: a one-word CSS fix got a 6-line comment and the user corrected it (2026-10-08).
- procedure part 3: dependency upgrades, migration handoff, partial worker reports.

## 2.0.0
- One skill with modules: research, lean, developer, analyzer, tester. Helpers no longer install separately.
- lean: rewritten from scratch (replaces the earlier minimal-change skill).
- help: `/master-brain help [name]`, a script, no model tokens.
- Router 9821 -> 2636 chars; skill description 272 chars; module sizes at or under the old skills (`budget.json`).
- tester: test guard covers Go, Java/Kotlin, Rust, C#, Ruby and PHP (pattern-tested; only JS/TS and Python are run here); `frameworks.md`.
- update (ff-only), overlay (project-only approved rules), contribute (sanitized export).
- Evidence: A/B run, 34 runs: pass 12/12 vs 11/12, turns -15%, tool calls -13% (see `core/IMPROVE.md` section 5 for the method).
- tester: new rule "pin every character class a pattern names or omits". Evidence: test-writing task missed one broken version in 3 of 3 runs before (and for the old skill and the cheapest tier); with the rule 3 of 3 runs caught all three. Turns 5-7 against 4-9 before; fresh tokens in the same range (cache noise). Module +104 chars, under its cap.
- test guard: now counts skip/todo option forms (found by comparing with the real Node and Python runners).
- test guard: counts verified against the real runners for Go, Java (JUnit), Rust, C# (xUnit), Ruby (RSpec), PHP (PHPUnit), Node and Python; fixed rspec metadata skips, JUnit assumptions, NUnit ignore, PHP requires; added a generic safety net for unlisted skip forms.
