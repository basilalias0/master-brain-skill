# Changelog

## 2.2.0 (2026-10-08)
- Plans: every plan is a visual layout plan plus the same plan section by section (`core/PLAN-FORMAT.md`; pointers in the router and the developer module).
- A/B (developer module, planning task on a small fixture, 3 runs per cell, control = 2.1.0 module text, mid tier): pass rule = visual file with layout, reuse, build order and decisions, plus a text plan with 4+ sections, no code written. New 3/3, control 0/3 (text only). Cost: tokens avg 66,083 vs 62,547 (+5.7%), tool calls avg 12.0 vs 9.3. The release gate "tokens and tool calls not higher" is not met; the owner accepted it on 2026-10-08 because the extra is the second deliverable the rule asks for and planning is the core of a task. One task and one fixture only.
- Developer module line is one sentence, to stay under its budget cap (2,945 of 3,014).

## 2.1.0 (2026-10-08)
- A/B (lean, 3 runs per cell, control = 2.0.0 text, one-line CSS fix): pass 3/3 vs 3/3; 4 tool calls each; tokens 58,070 vs 58,098 avg (new not higher). No-regression result only: no run in either cell wrote a comment, so this task cannot show the comment rule changing behaviour. The wider A/B for the earlier token-rule items was not run.
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
