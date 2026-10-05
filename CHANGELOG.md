# Changelog

## 2.0.0
- One skill with modules: research, lean, developer, analyzer, tester. Helpers no longer install separately.
- lean: rewritten from scratch (replaces the earlier minimal-change skill).
- help: `/master-brain help [name]`, a script, no model tokens.
- Router 9821 -> 2636 chars; skill description 272 chars; module sizes at or under the old skills (`budget.json`).
- tester: test guard covers Go, Java/Kotlin, Rust, C#, Ruby and PHP (pattern-tested; only JS/TS and Python are run here); `frameworks.md`.
- update (ff-only), overlay (project-only approved rules), contribute (sanitized export).
- Evidence: A/B run, 34 runs: pass 12/12 vs 11/12, turns -15%, tool calls -13% (see `core/IMPROVE.md` section 5 for the method).
