# Releasing (maintainers only)

Only people with write access push the repo. master-brain itself never pushes.

Gate, all must pass:
1. `node --test scripts/*_test.cjs`
2. `node scripts/verify.cjs .` and `node scripts/budget.cjs check .`
3. The A/B suite (`core/IMPROVE.md` section 5): pass rate not lower; turns, tool calls and tokens not higher; at least 3 runs per cell, with a control.
4. A `CHANGELOG.md` entry per changed module with its evidence; bump `VERSION`.
5. Raising a cap in `budget.json` needs a justification with a measured gain.
6. Tag, then push, only after the owner says yes.
